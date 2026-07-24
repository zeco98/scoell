import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PAYMENT_GATEWAY_LABELS, type CreateCheckoutDto, type CreatePaymentDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { StubPaymentProvider, renderGatewayPage } from "./payment-provider";
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
    private readonly notifications: NotificationsService,
    private readonly gateway: StubPaymentProvider,
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
   * إصدار سند قبض داخل معاملة واحدة — قلب الترقيم التسلسلي بلا فراغات.
   * يُعاد استخدامه من الدفع اليدوي (createPayment) والدفع الإلكتروني (confirmIntent).
   * يعمل ضمن معاملة مُمرَّرة (tx) إن وُجدت، وإلا يفتح معاملته الخاصة.
   */
  private async issueReceipt(
    args: {
      tenantId: string;
      fee: { id: string; total: number; paid: number; dueDate: string; studentId: string };
      amount: number;
      method: string;
      note?: string | null;
      receivedById: string;
      receivedBy: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (t: Prisma.TransactionClient) => {
      const year = new Date().getFullYear();
      const counter = await t.receiptCounter.upsert({
        where: { tenantId_year: { tenantId: args.tenantId, year } },
        create: { tenantId: args.tenantId, year, value: 1 },
        update: { value: { increment: 1 } },
      });
      const seq = counter.value;
      const receiptNo = `RC-${year}-${String(1000 + seq)}`;
      const created = await t.payment.create({
        data: {
          tenantId: args.tenantId,
          year,
          seq,
          receiptNo,
          feeRecordId: args.fee.id,
          studentId: args.fee.studentId,
          amount: args.amount,
          method: args.method,
          note: args.note,
          receivedById: args.receivedById,
          receivedBy: args.receivedBy,
        },
      });
      const newPaid = args.fee.paid + args.amount;
      await t.feeRecord.update({
        where: { id: args.fee.id },
        data: { paid: newPaid, status: feeStatus(args.fee.total, newPaid, args.fee.dueDate) },
      });
      return created;
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  /**
   * سند قبض يدوي (نقدًا/تحويل/بطاقة) — يصدره المحاسب/المدير.
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

    const payment = await this.issueReceipt({
      tenantId,
      fee,
      amount: dto.amount,
      method: dto.method,
      note: dto.note,
      receivedById: user.id,
      receivedBy: user.name,
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

  // =========================================================================
  // الدفع الإلكتروني (بوابة عراقية) — checkout → callback → سند تسلسلي
  // =========================================================================

  /**
   * بدء دفع إلكتروني لقسط. ولي الأمر/الطالب يدفع لسجله فقط؛ المحاسب/المدير لأي
   * قسط في مؤسسته. يُنشئ نية دفع ويعيد رابط بوابة (زين كاش…). لا سند بعد.
   */
  async createCheckout(user: AuthUser, dto: CreateCheckoutDto, baseUrl: string, ctx: AuditContext) {
    const scope = OWN_SCOPE_ROLES.includes(user.role) ? ownStudentRelationWhere(user) : tenantWhere(user);
    const fee = await this.prisma.feeRecord.findFirst({
      where: { id: dto.feeRecordId, ...scope },
      include: { student: true, tenant: { select: { name: true } } },
    });
    if (!fee) throw new NotFoundException("القسط غير موجود");
    const remaining = fee.total - fee.paid;
    if (remaining <= 0) throw new BadRequestException("القسط مسدّد بالكامل");
    if (dto.amount > remaining) {
      throw new BadRequestException(`المبلغ أكبر من المتبقي (${remaining.toLocaleString("en")} د.ع)`);
    }

    const providerRef = `PI-${randomUUID().slice(0, 18)}`;
    const intent = await this.prisma.paymentIntent.create({
      data: {
        tenantId: fee.tenantId,
        studentId: fee.studentId,
        feeRecordId: fee.id,
        amount: dto.amount,
        gateway: dto.gateway,
        providerRef,
        createdById: user.id,
      },
    });
    const checkout = await this.gateway.createCheckout({
      providerRef,
      amount: dto.amount,
      gateway: dto.gateway,
      studentName: fee.student.name,
      description: `قسط ${fee.plan} — ${fee.student.name}`,
      baseUrl,
    });
    await this.audit.log({
      user,
      tenantId: fee.tenantId,
      action: `بدء دفع إلكتروني (${PAYMENT_GATEWAY_LABELS[dto.gateway]}) ${dto.amount.toLocaleString("en")} د.ع — ${fee.student.name}`,
      entity: "PaymentIntent",
      entityId: intent.id,
      after: { amount: dto.amount, gateway: dto.gateway },
      ctx,
    });
    return { intentId: intent.id, providerRef, checkoutUrl: checkout.checkoutUrl, amount: dto.amount, gateway: dto.gateway };
  }

  /** صفحة بوابة محاكاة (زر تأكيد يستدعي الـ callback بتوقيع صحيح) */
  async gatewayPage(providerRef: string, baseUrl: string): Promise<string> {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { providerRef } });
    if (!intent) throw new NotFoundException("عملية الدفع غير موجودة");
    const student = await this.prisma.student.findUnique({ where: { id: intent.studentId }, select: { name: true } });
    const signature = this.gateway.sign(providerRef);
    const done = intent.status !== "pending";
    return renderGatewayPage({
      providerRef,
      signature,
      amount: intent.amount,
      gateway: intent.gateway,
      studentName: student?.name ?? "",
      baseUrl,
      done,
      status: intent.status,
    });
  }

  /**
   * callback البوابة — يؤكد النية ويصدر سندًا تسلسليًا داخل معاملة، ثم يُشعر
   * ولي الأمر عبر واتساب/داخلي. idempotent: نية مؤكَّدة مسبقًا لا تُكرَّر.
   */
  async confirmCallback(providerRef: string, signature: string, outcome: "paid" | "failed") {
    if (!this.gateway.verifySignature(providerRef, signature)) {
      throw new ForbiddenException("توقيع غير صالح");
    }
    const intent = await this.prisma.paymentIntent.findUnique({ where: { providerRef } });
    if (!intent) throw new NotFoundException("عملية الدفع غير موجودة");
    if (intent.status === "confirmed") return { ok: true, alreadyConfirmed: true, paymentId: intent.paymentId };
    if (intent.status !== "pending") throw new BadRequestException("عملية الدفع منتهية");

    if (outcome === "failed") {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "failed" } });
      return { ok: false, status: "failed" };
    }

    const fee = await this.prisma.feeRecord.findUnique({
      where: { id: intent.feeRecordId },
      include: { student: { select: { id: true, name: true, guardianUserId: true, guardianPhone: true } } },
    });
    if (!fee) throw new NotFoundException("القسط غير موجود");
    // الحد الأقصى المتبقي وقت التأكيد (قد يكون دُفع جزئيًا يدويًا بين البدء والتأكيد)
    const amount = Math.min(intent.amount, fee.total - fee.paid);
    if (amount <= 0) {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "expired" } });
      return { ok: false, status: "expired" };
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await this.issueReceipt(
        {
          tenantId: fee.tenantId,
          fee,
          amount,
          method: "ONLINE",
          note: `دفع إلكتروني — ${PAYMENT_GATEWAY_LABELS[intent.gateway as keyof typeof PAYMENT_GATEWAY_LABELS] ?? intent.gateway}`,
          receivedById: intent.createdById,
          receivedBy: PAYMENT_GATEWAY_LABELS[intent.gateway as keyof typeof PAYMENT_GATEWAY_LABELS] ?? intent.gateway,
        },
        tx,
      );
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "confirmed", paymentId: created.id } });
      return created;
    });

    await this.audit.log({
      user: null,
      tenantId: fee.tenantId,
      action: `دفع إلكتروني مؤكَّد ${payment.receiptNo}: ${amount.toLocaleString("en")} د.ع — ${fee.student.name}`,
      entity: "Payment",
      entityId: payment.receiptNo,
      after: { amount, gateway: intent.gateway, providerRef },
    });

    // إشعار ولي الأمر: داخلي (لحساب ولي الأمر إن وُجد) + واتساب لرقمه المسجّل
    const shortBody = `تم استلام دفعة ${amount.toLocaleString("en")} د.ع للطالب ${fee.student.name}. رقم السند: ${payment.receiptNo}.`;
    if (fee.student.guardianUserId) {
      await this.notifications.notify(fee.student.guardianUserId, {
        title: "تأكيد دفع القسط",
        body: shortBody,
        kind: "payment",
      });
    }
    // واتساب — القناة الأولى للعراق. رقم ولي الأمر مخزّن على سجل الطالب مباشرة
    const guardianPhone = fee.student.guardianPhone?.trim();
    if (guardianPhone) {
      await this.notifications.sendExternal(
        "WHATSAPP",
        guardianPhone,
        "تأكيد دفع القسط",
        `${shortBody} شكرًا لكم — منارة.`,
      );
    }

    return { ok: true, status: "confirmed", receiptNo: payment.receiptNo, paymentId: payment.id };
  }

  /**
   * تنفيذ الإلغاء الفعلي (تأثير الدفتر/السند) — دالة داخلية مشتركة.
   * تُستدعى فقط من: (أ) SUPER_ADMIN كتجاوز مباشر، (ب) SCHOOL_ADMIN عند الموافقة على طلب إلغاء.
   * لا يجوز للمحاسب استدعاؤها مباشرة — هو يطلب فقط عبر requestVoid.
   */
  private async executeVoid(
    user: AuthUser,
    payment: { id: string; tenantId: string; receiptNo: string; amount: number; feeRecordId: string; feeRecord: { paid: number; total: number; dueDate: string } },
    reason: string,
    ctx: AuditContext,
    approval?: { requestedById: string; approvedById: string },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          voidedAt: new Date(),
          voidStatus: "VOIDED",
          ...(approval
            ? { voidApprovedById: approval.approvedById, voidApprovedAt: new Date() }
            : {}),
        },
      });
      const newPaid = payment.feeRecord.paid - payment.amount;
      await tx.feeRecord.update({
        where: { id: payment.feeRecordId },
        data: { paid: newPaid, status: feeStatus(payment.feeRecord.total, newPaid, payment.feeRecord.dueDate) },
      });
    });
    await this.audit.log({
      user,
      tenantId: payment.tenantId,
      action: approval
        ? `موافقة على إلغاء سند قبض ${payment.receiptNo} (الطلب: ${approval.requestedById}) — السبب: ${reason}`
        : `إلغاء سند قبض ${payment.receiptNo} — السبب: ${reason}`,
      entity: "Payment",
      entityId: payment.receiptNo,
      before: { amount: payment.amount, voidedAt: null },
      after: { voidedAt: new Date().toISOString() },
      severity: "critical",
      ctx,
    });
    return this.prisma.payment.findFirst({
      where: { id: payment.id },
      include: { student: { select: { id: true, name: true } } },
    });
  }

  /** إلغاء منطقي مباشر — SUPER_ADMIN فقط (تجاوز)، بقيد تدقيق حرج. لا حذف نهائي أبدًا. */
  async voidPayment(user: AuthUser, id: string, reason: string, ctx: AuditContext) {
    if (user.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("إلغاء السندات المباشر صلاحية المدير العام حصرًا");
    }
    // نطاق صريح: SUPER_ADMIN بلا tenant يرى الكل، لكن الاستعلام يبقى ضمن tenantWhere دفاعيًا
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...tenantWhere(user) },
      include: { feeRecord: true },
    });
    if (!payment || payment.voidedAt) throw new NotFoundException("السند غير موجود أو ملغى");
    return this.executeVoid(user, payment, reason, ctx);
  }

  /** طلب إلغاء — ACCOUNTANT فقط. لا يُنفّذ الإلغاء، ينتظر موافقة مدير المدرسة. */
  async requestVoid(user: AuthUser, id: string, reason: string, ctx: AuditContext) {
    const payment = await this.prisma.payment.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!payment) throw new NotFoundException("السند غير موجود");
    if (payment.voidedAt || payment.voidStatus !== "NONE") {
      throw new BadRequestException("يوجد طلب إلغاء سابق أو أن السند ملغى بالفعل");
    }
    await this.prisma.payment.update({
      where: { id },
      data: {
        voidStatus: "PENDING",
        voidRequestedById: user.id,
        voidRequestedAt: new Date(),
        voidReason: reason,
      },
    });
    await this.audit.log({
      user,
      tenantId: payment.tenantId,
      action: `طلب إلغاء سند قبض ${payment.receiptNo} — بانتظار موافقة مدير المدرسة — السبب: ${reason}`,
      entity: "Payment",
      entityId: payment.receiptNo,
      before: { voidStatus: "NONE" },
      after: { voidStatus: "PENDING" },
      severity: "warning",
      ctx,
    });
    return this.prisma.payment.findFirst({
      where: { id: payment.id },
      include: { student: { select: { id: true, name: true } } },
    });
  }

  /** موافقة على طلب إلغاء — SCHOOL_ADMIN فقط. ينفّذ الإلغاء الفعلي. */
  async approveVoid(user: AuthUser, id: string, ctx: AuditContext) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...tenantWhere(user) },
      include: { feeRecord: true },
    });
    if (!payment) throw new NotFoundException("السند غير موجود");
    if (payment.voidStatus !== "PENDING") {
      throw new BadRequestException("لا يوجد طلب إلغاء بانتظار الموافقة لهذا السند");
    }
    return this.executeVoid(user, payment, payment.voidReason ?? "", ctx, {
      requestedById: payment.voidRequestedById ?? "",
      approvedById: user.id,
    });
  }

  /** رفض طلب إلغاء — SCHOOL_ADMIN فقط. يعيد الحالة إلى NONE بدون تنفيذ الإلغاء. */
  async rejectVoid(user: AuthUser, id: string, ctx: AuditContext) {
    const payment = await this.prisma.payment.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!payment) throw new NotFoundException("السند غير موجود");
    if (payment.voidStatus !== "PENDING") {
      throw new BadRequestException("لا يوجد طلب إلغاء بانتظار الموافقة لهذا السند");
    }
    await this.prisma.payment.update({
      where: { id },
      data: {
        voidStatus: "NONE",
        voidRequestedById: null,
        voidRequestedAt: null,
        voidReason: null,
      },
    });
    await this.audit.log({
      user,
      tenantId: payment.tenantId,
      action: `رفض طلب إلغاء سند قبض ${payment.receiptNo}`,
      entity: "Payment",
      entityId: payment.receiptNo,
      before: { voidStatus: "PENDING" },
      after: { voidStatus: "NONE" },
      severity: "info",
      ctx,
    });
    return this.prisma.payment.findFirst({
      where: { id: payment.id },
      include: { student: { select: { id: true, name: true } } },
    });
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
