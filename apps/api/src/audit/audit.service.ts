import { Injectable } from "@nestjs/common";
import type { AuditSeverity } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/types";
import { tenantWhere } from "../common/types";

export interface AuditContext {
  ip?: string;
  userAgent?: string;
}

export interface AuditEntryInput {
  user: AuthUser | null;
  tenantId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  severity?: AuditSeverity;
  ctx?: AuditContext;
}

/**
 * خدمة التدقيق المركزية — كل عملية حساسة تمرّ من هنا.
 * append-only: لا يوجد أي مسار حذف أو تعديل لسجلاتها.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(e: AuditEntryInput) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: e.tenantId ?? e.user?.tenantId ?? null,
        userId: e.user?.id ?? null,
        userName: e.user?.name ?? "system",
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        before: e.before === undefined ? null : JSON.stringify(e.before),
        after: e.after === undefined ? null : JSON.stringify(e.after),
        ip: e.ctx?.ip,
        userAgent: e.ctx?.userAgent,
        severity: e.severity ?? "info",
      },
    });
  }

  async query(
    user: AuthUser,
    q: {
      query?: string;
      severity?: string;
      entity?: string;
      userId?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 20));
    const where = {
      ...tenantWhere(user),
      ...(q.severity && q.severity !== "all" ? { severity: q.severity } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(`${q.to}T23:59:59`) } : {}),
            },
          }
        : {}),
      ...(q.query
        ? {
            OR: [
              { action: { contains: q.query } },
              { userName: { contains: q.query } },
              { entityId: { contains: q.query } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
