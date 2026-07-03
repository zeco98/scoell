import type { Role } from "@manarah/shared";
import type { Request } from "express";

/** سياق التدقيق من الطلب — يُستخرج مرة واحدة بدل تكراره في كل متحكم */
export function auditCtx(req: Request): { ip?: string; userAgent?: string } {
  return { ip: req.ip, userAgent: req.headers["user-agent"] as string | undefined };
}

/** احتساب حالة القسط — مصدر واحد يمنع تضارب المنطق بين الخدمات */
export function computeFeeStatus(total: number, paid: number, dueDate: string): "paid" | "partial" | "overdue" {
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  return dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "partial";
}

// حمولة الـ JWT بعد التحقق — تُحقن في req.user
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
}

export interface AuthedRequest extends Request {
  user: AuthUser;
}

// أدوار المنصة (خارج أي مؤسسة) — ترى كل المستأجرين للقراءة
export const PLATFORM_ROLES: Role[] = ["SUPER_ADMIN", "AUDITOR"];

/**
 * شرط العزل بين المستأجرين: يُضاف لكل استعلام Prisma.
 * أدوار المنصة تقرأ الكل؛ أي دور آخر بلا tenantId يُرفض فورًا.
 */
export function tenantWhere(user: AuthUser): { tenantId?: string } {
  if (PLATFORM_ROLES.includes(user.role)) return {};
  if (!user.tenantId) throw new Error("مستخدم بلا مؤسسة — رفض العملية");
  return { tenantId: user.tenantId };
}

/** tenantId إلزامي للكتابة — حتى SUPER_ADMIN يكتب باسم مؤسسة محددة */
export function requireTenant(user: AuthUser, explicit?: string): string {
  const t = user.tenantId ?? explicit;
  if (!t) throw new Error("العملية تتطلب تحديد المؤسسة");
  return t;
}
