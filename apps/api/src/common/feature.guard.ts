import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FeatureKey } from "@manarah/shared";
import { FEATURE_KEY } from "./decorators";
import { PLATFORM_ROLES, resolveTenantFeatures, type AuthedRequest } from "./types";
import { PrismaService } from "../prisma/prisma.service";

/**
 * يمنع الوصول لأي مسار مُعلَّم بـ @Feature إذا كانت الميزة معطّلة لمؤسسة المستخدم.
 * مسارات بلا @Feature تمر دون فحص؛ أدوار المنصة (بلا مؤسسة) تتجاوز الفحص دائمًا.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureKey | undefined>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const { user } = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!user || PLATFORM_ROLES.includes(user.role) || !user.tenantId) return true;

    const rows = await this.prisma.tenantFeature.findMany({
      where: { tenantId: user.tenantId },
      select: { key: true, enabled: true },
    });
    const resolved = resolveTenantFeatures(rows);
    if (!resolved[required]) {
      throw new ForbiddenException("This feature is not enabled for your school.");
    }
    return true;
  }
}
