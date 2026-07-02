import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import type { AuthUser } from "../common/types";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// hash سريع للـ refresh tokens (قيمة عشوائية 256-bit — لا تحتاج KDF بطيء)
function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private refreshTtlMs() {
    return Number(process.env.REFRESH_TTL_DAYS ?? 7) * 24 * 60 * 60 * 1000;
  }

  private async issueTokens(user: { id: string; name: string; email: string; role: string; tenantId: string | null }, family?: string) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    const refreshToken = randomBytes(32).toString("hex");
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        family: family ?? randomUUID(),
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });
    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, ctx: AuditContext) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // رسالة واحدة لكل حالات الفشل — لا نكشف وجود البريد من عدمه
    const invalid = () => new UnauthorizedException("بيانات الدخول غير صحيحة");

    if (!user) throw invalid();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`الحساب مقفل مؤقتًا بعد محاولات فاشلة — أعد المحاولة بعد ${mins} دقيقة`);
    }

    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      const failed = user.failedAttempts + 1;
      const lock = failed >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      if (lock) {
        await this.audit.log({
          user: null,
          tenantId: user.tenantId,
          action: `قفل حساب بعد ${MAX_FAILED_ATTEMPTS} محاولات دخول فاشلة`,
          entity: "Auth",
          entityId: user.email,
          severity: "warning",
          ctx,
        });
      }
      throw invalid();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const tokens = await this.issueTokens(user);
    await this.audit.log({
      user: { id: user.id, name: user.name, email: user.email, role: user.role as AuthUser["role"], tenantId: user.tenantId },
      action: "تسجيل دخول",
      entity: "Auth",
      entityId: user.email,
      ctx,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        avatarColor: user.avatarColor,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * تدوير الـ refresh token: القديم يُبطل ويصدر جديد من نفس العائلة.
   * إعادة استخدام token مُبطل = مؤشر سرقة → إبطال العائلة كلها.
   */
  async refresh(refreshToken: string, ctx: AuditContext) {
    if (!refreshToken) throw new UnauthorizedException("لا يوجد refresh token");
    const hash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException("جلسة غير صالحة");

    if (stored.revokedAt) {
      // إعادة استخدام — إبطال كل العائلة
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        user: null,
        tenantId: stored.user.tenantId,
        action: "محاولة إعادة استخدام refresh token مُبطل — إبطال كل جلسات العائلة",
        entity: "Auth",
        entityId: stored.user.email,
        severity: "critical",
        ctx,
      });
      throw new UnauthorizedException("جلسة غير صالحة — سجّل الدخول مجددًا");
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException("انتهت الجلسة — سجّل الدخول مجددًا");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, stored.family);
  }

  async logout(refreshToken: string | undefined, user: AuthUser | null, ctx: AuditContext) {
    if (refreshToken) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: sha256(refreshToken) },
      });
      if (stored) {
        await this.prisma.refreshToken.updateMany({
          where: { family: stored.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    if (user) {
      await this.audit.log({ user, action: "تسجيل خروج", entity: "Auth", entityId: user.email, ctx });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? "المنصة",
      avatarColor: user.avatarColor,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async changePassword(user: AuthUser, current: string, next: string, ctx: AuditContext) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const ok = await argon2.verify(dbUser.passwordHash, current).catch(() => false);
    if (!ok) throw new UnauthorizedException("كلمة المرور الحالية غير صحيحة");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(next), mustChangePassword: false },
    });
    await this.audit.log({
      user,
      action: "تغيير كلمة المرور",
      entity: "User",
      entityId: user.id,
      severity: "warning",
      ctx,
    });
    return { ok: true };
  }
}
