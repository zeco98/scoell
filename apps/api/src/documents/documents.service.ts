import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { tenantWhere, ownStudentWhere, type AuthUser } from "../common/types";
import {
  renderCertificateHtml,
  renderTranscriptHtml,
  renderStatementHtml,
  type CertificateModel,
} from "../pdf/templates";
import { documentSerial, verificationCode } from "./verify";

// ============================================================================
// خدمة الوثائق الرسمية — شهادة / بيان درجات / كشف حساب.
// تطبّق نفس فحوص ownership المُدقَّقة في تدقيق RBAC: PARENT→أبناؤه،
// STUDENT→سجله، TEACHER→طلاب شعبه (للبيان)، والبقية حسب عزل المؤسسة.
// كل وثيقة تحمل رقمًا تسلسليًا ورمز تحقق HMAC مشتقًّا من حقولها الثابتة.
// ============================================================================

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** يؤرشف إصدار الوثيقة (upsert بالرقم التسلسلي) لتمكين بوابة التحقق العامة */
  private async record(
    user: AuthUser,
    kind: string,
    serial: string,
    verifyCode: string,
    student: { id: string; tenantId: string; name: string },
    summary: Record<string, unknown>,
  ) {
    const summaryJson = JSON.stringify({ ...summary, kind, name0: student.name.charAt(0) });
    await this.prisma.documentIssue.upsert({
      where: { serial },
      create: { tenantId: student.tenantId, studentId: student.id, kind, serial, verifyCode, summary: summaryJson, issuedById: user.id },
      update: { verifyCode, summary: summaryJson },
    });
  }

  /** بوابة تحقق عامة: يعيد صحة الوثيقة وملخصًا غير حسّاس (بلا أي PII) */
  async verify(serial: string, code: string) {
    const doc = await this.prisma.documentIssue.findUnique({ where: { serial } });
    if (!doc) return { valid: false, reason: "الوثيقة غير موجودة" };
    // مقارنة زمن-ثابت للرمز
    const a = Buffer.from(doc.verifyCode);
    const b = Buffer.from((code || "").toUpperCase());
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
    if (diff !== 0) return { valid: false, reason: "رمز التحقق غير مطابق" };
    const summary = JSON.parse(doc.summary || "{}");
    const KIND_AR: Record<string, string> = {
      certificate: "شهادة رسمية",
      transcript: "بيان درجات",
      statement: "كشف حساب",
      report_card: "كشف درجات",
      receipt: "سند قبض",
    };
    return {
      valid: true,
      kind: KIND_AR[doc.kind] ?? doc.kind,
      serial: doc.serial,
      issuedAt: doc.createdAt,
      summary, // نوع/سنة/أول حرف فقط — لا اسم كامل ولا درجات
    };
  }

  /**
   * يجلب سجل الطالب مع فرض الملكية حسب الدور. `requireOwnSection` يقصر المعلم
   * على طلاب شعبه (للبيان/الكشف الأكاديمي) بدل كل طلاب المؤسسة.
   */
  private async resolveStudent(user: AuthUser, studentId: string, requireOwnSection: boolean) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...tenantWhere(user) },
      include: { section: true, tenant: true },
    });
    if (!student) throw new NotFoundException("الطالب غير موجود");

    if (user.role === "PARENT" && student.guardianUserId !== user.id) {
      throw new ForbiddenException("لا تملك صلاحية إصدار وثيقة لهذا الطالب");
    }
    if (user.role === "STUDENT" && student.studentUserId !== user.id) {
      throw new ForbiddenException("لا تملك صلاحية إصدار وثيقة لهذا الطالب");
    }
    if (user.role === "TEACHER") {
      if (requireOwnSection) {
        const owns = student.sectionId
          ? await this.prisma.section.findFirst({
              where: { id: student.sectionId, teacherId: user.id, ...tenantWhere(user) },
              select: { id: true },
            })
          : null;
        if (!owns) throw new ForbiddenException("الطالب خارج شعبك");
      } else {
        // المعلم لا يصدر شهادات/كشوف حساب رسمية
        throw new ForbiddenException("لا تملك صلاحية إصدار هذا النوع من الوثائق");
      }
    }
    return student;
  }

  // ------------------------------------------------------------------- شهادة
  async certificate(user: AuthUser, studentId: string, kind: CertificateModel["kind"], year: string): Promise<string> {
    const student = await this.resolveStudent(user, studentId, false);

    // معدل تراكمي من نتائج الطالب في العام (لشهادات الإتمام/التخرّج)
    const results = await this.prisma.examResult.findMany({
      where: { studentId: student.id, exam: { year } },
      select: { total: true },
    });
    const average = results.length ? results.reduce((a, r) => a + r.total, 0) / results.length : null;
    const grade =
      average == null ? null : average >= 90 ? "امتياز" : average >= 80 ? "جيد جدًا" : average >= 70 ? "جيد" : average >= 60 ? "متوسط" : average >= 50 ? "مقبول" : "راسب";

    const serial = documentSerial("certificate", student.tenantId, student.id, `${kind}${year}`);
    const verify = verificationCode(serial, {
      name: student.name,
      code: student.code,
      year,
      kind,
      avg: average != null ? average.toFixed(1) : "",
    });
    await this.record(user, "certificate", serial, verify, student, { year, kind });

    return renderCertificateHtml({
      kind,
      tenant: { name: student.tenant.name, city: student.tenant.city },
      student: {
        name: student.name,
        code: student.code,
        section: student.section,
        guardianName: student.guardianName,
      },
      year,
      average,
      grade,
      issuedAt: new Date(),
      serial,
      verifyCode: verify,
    });
  }

  // ------------------------------------------------------------- بيان الدرجات
  async transcript(user: AuthUser, studentId: string, year: string): Promise<string> {
    const student = await this.resolveStudent(user, studentId, true);

    const results = await this.prisma.examResult.findMany({
      where: { studentId: student.id, exam: { year } },
      include: { exam: { select: { name: true, subject: true, createdAt: true } } },
      orderBy: { createdAt: "asc" },
    });
    const rows = results.map((r) => ({
      exam: r.exam.name,
      subject: r.exam.subject,
      total: r.total,
      grade: r.grade,
      date: r.exam.createdAt,
    }));
    const cumulativeAverage = rows.length ? rows.reduce((a, r) => a + r.total, 0) / rows.length : 0;
    const resultLabel = !rows.length
      ? "غير محدد"
      : rows.some((r) => r.total < 50)
        ? "مكمل"
        : "ناجح";

    const serial = documentSerial("transcript", student.tenantId, student.id, year);
    const verify = verificationCode(serial, {
      name: student.name,
      code: student.code,
      year,
      avg: cumulativeAverage.toFixed(1),
      n: rows.length,
    });
    await this.record(user, "transcript", serial, verify, student, { year });

    return renderTranscriptHtml({
      tenant: { name: student.tenant.name, city: student.tenant.city },
      student: { name: student.name, code: student.code, section: student.section, enrolledAt: student.enrolledAt },
      year,
      rows,
      cumulativeAverage,
      resultLabel,
      serial,
      verifyCode: verify,
    });
  }

  // -------------------------------------------------------------- كشف الحساب
  async statement(user: AuthUser, studentId: string): Promise<string> {
    // نطاق مالي: المحاسب/المدير/المنصة + ولي الأمر/الطالب لسجله فقط (لا المعلم)
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...tenantWhere(user), ...ownStudentWhere(user) },
      include: {
        section: true,
        tenant: true,
        feeRecords: { orderBy: { dueDate: "asc" } },
        payments: { where: { voidedAt: null }, orderBy: [{ year: "desc" }, { seq: "desc" }] },
      },
    });
    if (!student) throw new NotFoundException("الطالب غير موجود");
    if (user.role === "TEACHER") throw new ForbiddenException("لا تملك صلاحية عرض كشف الحساب المالي");

    const serial = documentSerial("statement", student.tenantId, student.id, ymd(new Date()));
    const totalDue = student.feeRecords.reduce((a, f) => a + f.total, 0);
    const totalPaid = student.feeRecords.reduce((a, f) => a + f.paid, 0);
    const verify = verificationCode(serial, {
      name: student.name,
      code: student.code,
      due: totalDue,
      paid: totalPaid,
    });
    await this.record(user, "statement", serial, verify, student, { date: ymd(new Date()) });

    return renderStatementHtml({
      tenant: { name: student.tenant.name, city: student.tenant.city },
      student: {
        name: student.name,
        code: student.code,
        section: student.section,
        guardianName: student.guardianName,
      },
      feeRecords: student.feeRecords.map((f) => ({
        plan: f.plan,
        total: f.total,
        paid: f.paid,
        dueDate: f.dueDate,
        status: f.status,
      })),
      payments: student.payments.map((p) => ({
        receiptNo: p.receiptNo,
        amount: p.amount,
        method: p.method,
        createdAt: p.createdAt,
      })),
      serial,
      verifyCode: verify,
      issuedAt: new Date(),
    });
  }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
