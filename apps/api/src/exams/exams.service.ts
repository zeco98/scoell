import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { gradeFor, type UpsertExamResultDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import { tenantWhere, requireTenant, type AuthUser } from "../common/types";
import { renderReportCardHtml } from "../pdf/templates";
import { documentSerial, verificationCode } from "../documents/verify";

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(user: AuthUser) {
    // نطاق المعلم: امتحانات شعبه فقط (وإلا يرى درجات طلاب خارج مسؤوليته)
    const teacherScope = user.role === "TEACHER" ? { section: { teacherId: user.id } } : {};
    return this.prisma.exam.findMany({
      where: { ...tenantWhere(user), ...teacherScope },
      include: { section: true, _count: { select: { results: true } } },
      orderBy: { createdAt: "desc" },
      take: 200, // سقف أمان
    });
  }

  async create(
    user: AuthUser,
    dto: { name: string; subject: string; sectionId: string; year: string },
    ctx: AuditContext,
  ) {
    const tenantId = requireTenant(user);
    const section = await this.prisma.section.findFirst({ where: { id: dto.sectionId, tenantId } });
    if (!section) throw new BadRequestException("الشعبة غير موجودة");
    // نطاق المعلم: شعبه فقط (المدير يملك كل شعب المؤسسة)
    if (user.role === "TEACHER" && section.teacherId !== user.id) {
      throw new ForbiddenException("لا تملك صلاحية إنشاء امتحان لهذه الشعبة");
    }
    const exam = await this.prisma.exam.create({
      data: { tenantId, name: dto.name, subject: dto.subject, sectionId: dto.sectionId, year: dto.year, createdById: user.id },
      include: { section: true },
    });
    await this.audit.log({
      user,
      action: `إنشاء امتحان: ${dto.name} — ${dto.subject} (${section.stage}/${section.name})`,
      entity: "Exam",
      entityId: exam.id,
      after: { name: dto.name, subject: dto.subject },
      ctx,
    });
    return exam;
  }

  /** نتائج امتحان مرتبة + حجب عند الديون للطالب/ولي الأمر حسب سياسة المؤسسة */
  async results(user: AuthUser, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, ...tenantWhere(user) },
      include: { section: true, tenant: true },
    });
    if (!exam) throw new NotFoundException("الامتحان غير موجود");
    // نطاق المعلم: نتائج شعبه فقط (لا يرى درجات طلاب معلم آخر)
    if (user.role === "TEACHER" && exam.section.teacherId !== user.id) {
      throw new ForbiddenException("لا تملك صلاحية عرض نتائج هذه الشعبة");
    }

    const raw = await this.prisma.examResult.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, name: true, code: true, guardianUserId: true, studentUserId: true } },
      },
      orderBy: { total: "desc" },
    });

    // الترتيب يُحتسب على الشعبة كاملة أولًا — يبقى صحيحًا حتى بعد تقييد العرض لاحقًا لـ PARENT/STUDENT
    let results = raw.map((r, i) => ({ ...r, rank: i + 1 }));
    const classSize = raw.length;

    // سياسة حجب النتائج عند الديون — تُطبَّق server-side على أدوار العرض
    if (user.role === "PARENT" || user.role === "STUDENT") {
      const settings = JSON.parse(exam.tenant.settings || "{}");
      // C2 — كان الطالب يمرّ بشرط `true` أي يرى كشف الشعبة كاملًا (كل الأسماء والدرجات)؛
      // الآن يُقيَّد بسجله الخاص فقط عبر studentUserId، تمامًا كما PARENT عبر guardianUserId.
      results = results.filter((r) =>
        user.role === "PARENT" ? r.student.guardianUserId === user.id : r.student.studentUserId === user.id,
      );
      if (settings.blockResultsOnDebt) {
        const ids = results.map((r) => r.studentId);
        const fees = await this.prisma.feeRecord.groupBy({
          by: ["studentId"],
          where: { studentId: { in: ids } },
          _sum: { total: true, paid: true },
        });
        const inDebt = new Set(
          fees.filter((f) => (f._sum.total ?? 0) > (f._sum.paid ?? 0)).map((f) => f.studentId),
        );
        results = results.map((r) =>
          inDebt.has(r.studentId)
            ? { ...r, monthly: -1, midterm: -1, finalExam: -1, total: -1, grade: "محجوبة لوجود ذمة مالية" }
            : r,
        );
      }
    }

    return { exam, results, classSize };
  }

  /** إدخال/تعديل درجات دفعة واحدة — كل تعديل يسجَّل بقيمته القديمة والجديدة */
  async upsertResults(user: AuthUser, examId: string, rows: UpsertExamResultDto[], ctx: AuditContext) {
    const tenantId = requireTenant(user);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId },
      include: { section: true },
    });
    if (!exam) throw new NotFoundException("الامتحان غير موجود");
    // نطاق المعلم: امتحانات شعبه فقط
    if (user.role === "TEACHER" && exam.section.teacherId !== user.id) {
      throw new ForbiddenException("لا تملك صلاحية تعديل درجات هذه الشعبة");
    }

    // H1 — التحقق أن كل studentId ينتمي فعلًا لشعبة الامتحان (رفض حقن معرّفات أجنبية)
    const sectionStudents = await this.prisma.student.findMany({
      where: { sectionId: exam.sectionId, tenantId, archivedAt: null },
      select: { id: true },
    });
    const validIds = new Set(sectionStudents.map((s) => s.id));
    const invalid = rows.filter((r) => !validIds.has(r.studentId));
    if (invalid.length > 0) {
      throw new BadRequestException("تحوي البيانات طلابًا خارج شعبة هذا الامتحان");
    }

    const existing = await this.prisma.examResult.findMany({ where: { examId } });
    const existingMap = new Map(existing.map((r) => [r.studentId, r]));

    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const total = row.monthly + row.midterm + row.finalExam;
      const grade = gradeFor(total);
      const prev = existingMap.get(row.studentId);
      if (prev) {
        if (prev.monthly === row.monthly && prev.midterm === row.midterm && prev.finalExam === row.finalExam) continue;
        await this.prisma.examResult.update({
          where: { id: prev.id },
          data: { monthly: row.monthly, midterm: row.midterm, finalExam: row.finalExam, total, grade },
        });
        const student = await this.prisma.student.findUnique({ where: { id: row.studentId }, select: { name: true } });
        await this.audit.log({
          user,
          tenantId,
          action: `تعديل درجة ${student?.name ?? row.studentId} في ${exam.name} (من ${prev.total} إلى ${total})`,
          entity: "ExamResult",
          entityId: prev.id,
          before: { monthly: prev.monthly, midterm: prev.midterm, finalExam: prev.finalExam, total: prev.total },
          after: { monthly: row.monthly, midterm: row.midterm, finalExam: row.finalExam, total },
          severity: "warning",
          ctx,
        });
        updated++;
      } else {
        const result = await this.prisma.examResult.create({
          data: { examId, studentId: row.studentId, monthly: row.monthly, midterm: row.midterm, finalExam: row.finalExam, total, grade },
        });
        await this.audit.log({
          user,
          tenantId,
          action: `إدخال درجة جديدة في ${exam.name}`,
          entity: "ExamResult",
          entityId: result.id,
          after: { total, grade },
          ctx,
        });
        created++;
      }
    }
    return { ok: true, created, updated };
  }

  /** كشف درجات الطالب (A4 print-ready بهوية منارة) */
  async reportCardHtml(user: AuthUser, examId: string, studentId: string) {
    // C3 — نتيجة results() مقيَّدة الآن بمالكها لـ PARENT/STUDENT، فطلب studentId أجنبي
    // لن يُعثر عليه هنا أصلًا (404) بدل تسريب كشف طالب آخر.
    const { exam, results, classSize } = await this.results(user, examId);
    const mine = results.find((r) => r.studentId === studentId);
    if (!mine) throw new NotFoundException("لا توجد نتيجة لهذا الطالب");
    if (mine.total < 0) throw new BadRequestException("النتيجة محجوبة لوجود ذمة مالية — راجع الإدارة");
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, ...tenantWhere(user) },
      include: { section: true },
    });
    if (!student) throw new NotFoundException("الطالب غير موجود");
    const serial = documentSerial("report_card", exam.tenantId, student.id, examId.slice(-8));
    const verifyCode = verificationCode(serial, {
      name: student.name,
      code: student.code,
      total: mine.total,
      exam: exam.name,
    });
    return renderReportCardHtml({
      tenantName: exam.tenant.name,
      tenantCity: exam.tenant.city,
      examName: exam.name,
      year: exam.year,
      student: { name: student.name, code: student.code, section: student.section },
      rank: mine.rank ?? 0,
      classSize,
      rows: [
        {
          subject: exam.subject,
          monthly: mine.monthly,
          midterm: mine.midterm,
          finalExam: mine.finalExam,
          total: mine.total,
          grade: mine.grade,
        },
      ],
      average: mine.total,
      serial,
      verifyCode,
    });
  }
}
