import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreatePaymentDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import {
  tenantWhere,
  requireTenant,
  ownStudentRelationWhere,
  computeFeeStatus as feeStatus,
  type AuthUser,
} from "../common/types";
import { verificationCode } from "../documents/verify";

const OWN_SCOPE_ROLES: AuthUser["role"][] = ["PARENT", "STUDENT"];

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listRecords(user: AuthUser, q: { status?: string; query?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 20));
    const where = {
      ...(OWN_SCOPE_ROLES.includes(user.role) ? ownStudentRelationWhere(user) : tenantWhere(user)),
      ...(q.status && q.status !== "all" ? { status: q.status } : {}),
      ...(q.query ? { student: { name: { contains: q.query } } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feeRecord.findMany({
        where,
        include: { student: { select: { id: true, name: true, code: true } } },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.feeRecord.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async stats(user: AuthUser) {
    const where = tenantWhere(user);
    const [agg, paymentsThisMonth, overdueCount] = await Promise.all([
      this.prisma.feeRecord.aggregate({ where, _sum: { total: true, paid: true } }),
      this.prisma.payment.count({
        where: {
          ...where,
          voidedAt: null,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.feeRecord.count({ where: { ...where, status: "overdue" } }),
    ]);
    const total = agg._sum.total ?? 0;
    const paid = agg._sum.paid ?? 0;
    return {
      collected: paid,
      outstanding: total - paid,
      collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
      receiptsThisMonth: paymentsThisMonth,
      overdueCount,
    };
  }

  async listPayments(user: AuthUser, q: { page?: number; pageSize?: number; query?: string }) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 20));
    const where = {
      ...(OWN_SCOPE_ROLES.includes(user.role) ? ownStudentRelationWhere(user) : tenantWhere(user)),
      voidedAt: null,
      ...(q.query
        ? { OR: [{ receiptNo: { contains: q.query } }, { student: { name: { contains: q.query } } }] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { student: { select: { id: true, name: true } } },
        orderBy: [{ year: "desc" }, { seq: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** قسط جديد لطالب — أساس المطالبة المالية */
  async createRecord(
    user: AuthUser,
    dto: { studentId: string; plan: string; total: number; dueDate: string },
    ctx: AuditContext,
  ) {
    const tenantId = requireTenant(user);
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException("الطالب غير موجود");
    const record = await this.prisma.feeRecord.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        plan: dto.plan,
        total: dto.total,
        dueDate: dto.dueDate,
        status: feeStatus(dto.total, 0, dto.dueDate),
      },
      include: { student: { select: { id: true, name: true, code: true } } },
    });
    await this.audit.log({
      user,
      tenantId,
      action: `قسط جديد للطالب ${student.name}: ${dto.total.toLocaleString("en")} د.ع (${dto.plan})`,
      entity: "FeeRecord",
      entityId: record.id,
      after: { plan: dto.plan, total: dto.total, dueDate: dto.dueDate },
      ctx,
    });
    return record;
  }

  /**
   * سند قبض جديد — الترقيم التسلسلي بلا فراغات مضمون بمعاملة واحدة:
   * زيادة العدّاد وإنشاء السند وتحديث القسط تنجح كلها أو تفشل كلها.
   */
  async createPayment(user: AuthUser, dto: CreatePaymentDto, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    const fee = await this.prisma.feeRecord.findFirst({
      where: { id: dto.feeRecordId, tenantId },
      include: { student: true },
    });
    if (!fee) throw new NotFoundException("القسط غير موجود");
    const remaining = fee.total - fee.paid;
    if (dto.amount > remaining) {
      throw new BadRequestException(`المبلغ أكبر من المتبقي (${remaining.toLocaleString("en")} د.ع)`);
    }

    const year = new Date().getFullYear();
    const payment = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.receiptCounter.upsert({
        where: { tenantId_year: { tenantId, year } },
        create: { tenantId, year, value: 1 },
        update: { value: { increment: 1 } },
      });
      const seq = counter.value;
      const receiptNo = `RC-${year}-${String(1000 + seq)}`;
      const created = await tx.payment.create({
        data: {
          tenantId,
          year,
          seq,
          receiptNo,
          feeRecordId: fee.id,
          studentId: fee.studentId,
          amount: dto.amount,
          method: dto.method,
          note: dto.note,
          receivedById: user.id,
          receivedBy: user.name,
        },
      });
      const newPaid = fee.paid + dto.amount;
      await tx.feeRecord.update({
        where: { id: fee.id },
        data: { paid: newPaid, status: feeStatus(fee.total, newPaid, fee.dueDate) },
      });
      return created;
    });

    await this.audit.log({
      user,
      tenantId,
      action: `سند قبض ${payment.receiptNo}: ${dto.amount.toLocaleString("en")} د.ع من ${fee.student.name}`,
      entity: "Payment",
      entityId: payment.receiptNo,
      after: { amount: dto.amount, method: dto.method, student: fee.student.name },
      ctx,
    });

    const fullyPaid = fee.paid + dto.amount >= fee.total;
    return { ...payment, student: fee.student, fullyPaid };
  }

  /** إلغاء منطقي — SUPER_ADMIN فقط، بقيد تدقيق حرج. لا حذف نهائي أبدًا. */
  async voidPayment(user: AuthUser, id: string, reason: string, ctx: AuditContext) {
    if (user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("إلغاء السندات صلاحية المدير العام حصرًا");
    }
    // نطاق صريح: SUPER_ADMIN بلا tenant يرى الكل، لكن الاستعلام يبقى ضمن tenantWhere دفاعيًا
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...tenantWhere(user) },
      include: { feeRecord: true },
    });
    if (!payment || payment.voidedAt) throw new NotFoundException("السند غير موجود أو ملغى");
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { voidedAt: new Date() } });
      const newPaid = payment.feeRecord.paid - payment.amount;
      await tx.feeRecord.update({
        where: { id: payment.feeRecordId },
        data: { paid: newPaid, status: feeStatus(payment.feeRecord.total, newPaid, payment.feeRecord.dueDate) },
      });
    });
    await this.audit.log({
      user,
      tenantId: payment.tenantId,
      action: `إلغاء سند قبض ${payment.receiptNo} — السبب: ${reason}`,
      entity: "Payment",
      entityId: payment.receiptNo,
      before: { amount: payment.amount, voidedAt: null },
      after: { voidedAt: new Date().toISOString() },
      severity: "critical",
      ctx,
    });
    return { ok: true };
  }

  async receiptData(user: AuthUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        ...(OWN_SCOPE_ROLES.includes(user.role) ? ownStudentRelationWhere(user) : tenantWhere(user)),
      },
      include: {
        student: { include: { section: true } },
        feeRecord: true,
        tenant: { select: { name: true, city: true } },
      },
    });
    if (!payment) throw new NotFoundException("السند غير موجود");
    // رمز تحقق للسند (يمنع تزوير المبلغ/الرقم) — مشتق من الحقول الثابتة
    const verifyCode = verificationCode(payment.receiptNo, {
      amount: payment.amount,
      student: payment.student.code,
      date: payment.createdAt.toISOString().slice(0, 10),
    });
    return { ...payment, verifyCode };
  }

  async createDiscount(
    user: AuthUser,
    dto: { studentId: string; percent: number; reason: string },
    ctx: AuditContext,
  ) {
    const tenantId = requireTenant(user);
    if (dto.percent < 1 || dto.percent > 100) throw new BadRequestException("نسبة الخصم بين 1 و100");
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId } });
    if (!student) throw new NotFoundException("الطالب غير موجود");
    const discount = await this.prisma.discount.create({
      data: { tenantId, studentId: dto.studentId, percent: dto.percent, reason: dto.reason, grantedById: user.id },
    });
    // تطبيق الخصم على الأقساط غير المسددة
    const fees = await this.prisma.feeRecord.findMany({
      where: { studentId: dto.studentId, tenantId, status: { not: "paid" } },
    });
    for (const f of fees) {
      const newTotal = Math.round((f.total * (100 - dto.percent)) / 100);
      await this.prisma.feeRecord.update({
        where: { id: f.id },
        data: { total: newTotal, status: feeStatus(newTotal, f.paid, f.dueDate) },
      });
    }
    await this.audit.log({
      user,
      tenantId,
      action: `منح خصم ${dto.percent}% للطالب ${student.name} (${dto.reason})`,
      entity: "Discount",
      entityId: discount.id,
      after: { percent: dto.percent, reason: dto.reason },
      severity: "warning",
      ctx,
    });
    return discount;
  }
}
