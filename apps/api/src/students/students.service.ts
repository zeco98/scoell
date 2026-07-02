import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import type { CreateStudentDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import { tenantWhere, requireTenant, type AuthUser } from "../common/types";

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** ولي الأمر يرى أبناءه فقط؛ المعلم طلاب شعبه؛ البقية حسب عزل المؤسسة */
  private async scopeFor(user: AuthUser) {
    if (user.role === "PARENT") return { guardianUserId: user.id, archivedAt: null };
    if (user.role === "STUDENT") {
      // حساب الطالب مربوط عبر البريد في الـ seed — نبحث بالمعرف المرتبط
      return { guardianUserId: "__none__", ...tenantWhere(user) }; // الطالب لا يرى قائمة الطلبة
    }
    return { ...tenantWhere(user), archivedAt: null };
  }

  async list(
    user: AuthUser,
    q: { query?: string; status?: string; sectionId?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 20));
    const where = {
      ...(await this.scopeFor(user)),
      ...(q.status && q.status !== "all" ? { status: q.status } : {}),
      ...(q.sectionId ? { sectionId: q.sectionId } : {}),
      ...(q.query
        ? {
            OR: [
              { name: { contains: q.query } },
              { guardianName: { contains: q.query } },
              { code: { contains: q.query } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: { section: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    // ملخصات مشتقة (رصيد/حضور/معدل) دفعة واحدة
    const ids = items.map((s) => s.id);
    const [fees, attendance, results] = await Promise.all([
      this.prisma.feeRecord.groupBy({
        by: ["studentId"],
        where: { studentId: { in: ids } },
        _sum: { total: true, paid: true },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ["studentId", "mark"],
        where: { studentId: { in: ids } },
        _count: true,
      }),
      this.prisma.examResult.groupBy({
        by: ["studentId"],
        where: { studentId: { in: ids } },
        _avg: { total: true },
      }),
    ]);

    const feeMap = new Map(fees.map((f) => [f.studentId, (f._sum.total ?? 0) - (f._sum.paid ?? 0)]));
    const attMap = new Map<string, { present: number; total: number }>();
    for (const a of attendance) {
      const cur = attMap.get(a.studentId) ?? { present: 0, total: 0 };
      cur.total += a._count;
      if (a.mark === "present" || a.mark === "late" || a.mark === "early") cur.present += a._count;
      attMap.set(a.studentId, cur);
    }
    const gpaMap = new Map(results.map((r) => [r.studentId, r._avg.total ?? null]));

    return {
      items: items.map((s) => {
        const att = attMap.get(s.id);
        return {
          ...s,
          balance: feeMap.get(s.id) ?? 0,
          attendanceRate: att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
          gpa: gpaMap.get(s.id) != null ? Number(gpaMap.get(s.id)!.toFixed(1)) : null,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async detail(user: AuthUser, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, ...tenantWhere(user) },
      include: {
        section: true,
        route: true,
        documents: true,
        feeRecords: { include: { payments: { where: { voidedAt: null } } } },
        attendance: { orderBy: { date: "desc" }, take: 30 },
        examResults: { include: { exam: true } },
        discounts: true,
      },
    });
    if (!student) throw new NotFoundException("الطالب غير موجود");
    if (user.role === "PARENT" && student.guardianUserId !== user.id) {
      throw new ForbiddenException("لا تملك صلاحية عرض هذا الطالب");
    }
    const totalFees = student.feeRecords.reduce((a, f) => a + f.total, 0);
    const totalPaid = student.feeRecords.reduce((a, f) => a + f.paid, 0);
    return { ...student, balance: totalFees - totalPaid };
  }

  private async nextCode(tenantId: string): Promise<string> {
    const last = await this.prisma.student.findFirst({
      where: { tenantId },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const n = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1000;
    return `st${n}`;
  }

  async create(user: AuthUser, dto: CreateStudentDto, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    let section = await this.prisma.section.findFirst({
      where: { tenantId, stage: dto.stage, name: dto.section },
    });
    if (!section) {
      section = await this.prisma.section.create({
        data: { tenantId, stage: dto.stage, name: dto.section },
      });
    }
    const student = await this.prisma.student.create({
      data: {
        tenantId,
        code: await this.nextCode(tenantId),
        name: dto.name,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        sectionId: section.id,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        healthNotes: dto.healthNotes,
        address: dto.address,
      },
      include: { section: true },
    });
    await this.audit.log({
      user,
      action: `تسجيل طالب جديد: ${student.name}`,
      entity: "Student",
      entityId: student.id,
      after: { name: student.name, code: student.code, section: `${dto.stage}/${dto.section}` },
      ctx,
    });
    return student;
  }

  async update(user: AuthUser, id: string, dto: Partial<CreateStudentDto>, ctx: AuditContext) {
    const before = await this.prisma.student.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!before) throw new NotFoundException("الطالب غير موجود");
    const student = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.gender ? { gender: dto.gender } : {}),
        ...(dto.birthDate ? { birthDate: new Date(dto.birthDate) } : {}),
        ...(dto.guardianName ? { guardianName: dto.guardianName } : {}),
        ...(dto.guardianPhone ? { guardianPhone: dto.guardianPhone } : {}),
        ...(dto.healthNotes !== undefined ? { healthNotes: dto.healthNotes } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
      include: { section: true },
    });
    await this.audit.log({
      user,
      action: `تعديل بيانات الطالب: ${student.name}`,
      entity: "Student",
      entityId: id,
      before: { name: before.name, guardianPhone: before.guardianPhone },
      after: { name: student.name, guardianPhone: student.guardianPhone },
      ctx,
    });
    return student;
  }

  async changeStatus(user: AuthUser, id: string, status: string, ctx: AuditContext) {
    const before = await this.prisma.student.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!before) throw new NotFoundException("الطالب غير موجود");
    const student = await this.prisma.student.update({ where: { id }, data: { status } });
    await this.audit.log({
      user,
      action: `تغيير حالة الطالب ${student.name}`,
      entity: "Student",
      entityId: id,
      before: { status: before.status },
      after: { status },
      severity: "warning",
      ctx,
    });
    return student;
  }

  async moveSection(user: AuthUser, id: string, sectionId: string, ctx: AuditContext) {
    const before = await this.prisma.student.findFirst({
      where: { id, ...tenantWhere(user) },
      include: { section: true },
    });
    if (!before) throw new NotFoundException("الطالب غير موجود");
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, ...tenantWhere(user) },
    });
    if (!section) throw new BadRequestException("الشعبة غير موجودة");
    const student = await this.prisma.student.update({
      where: { id },
      data: { sectionId },
      include: { section: true },
    });
    await this.audit.log({
      user,
      action: `نقل الطالب ${student.name} بين الشعب`,
      entity: "Student",
      entityId: id,
      before: { section: before.section ? `${before.section.stage}/${before.section.name}` : null },
      after: { section: `${section.stage}/${section.name}` },
      ctx,
    });
    return student;
  }

  async archive(user: AuthUser, id: string, ctx: AuditContext) {
    const before = await this.prisma.student.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!before) throw new NotFoundException("الطالب غير موجود");
    const student = await this.prisma.student.update({
      where: { id },
      data: { archivedAt: new Date(), status: "withdrawn" },
    });
    await this.audit.log({
      user,
      action: `أرشفة الطالب ${student.name} (soft delete)`,
      entity: "Student",
      entityId: id,
      before: { status: before.status, archivedAt: null },
      after: { status: "withdrawn", archivedAt: student.archivedAt },
      severity: "warning",
      ctx,
    });
    return { ok: true };
  }

  /** استيراد CSV: name,gender,stage,section,guardianName,guardianPhone — تقرير خطأ لكل صف مرفوض */
  async importCsv(user: AuthUser, buffer: Buffer, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    let rows: Record<string, string>[];
    try {
      rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch {
      throw new BadRequestException("ملف CSV غير صالح — تأكد من الترويسة والفواصل");
    }
    const report: { row: number; name?: string; ok: boolean; error?: string }[] = [];
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNo = i + 2; // بعد صف الترويسة
      const gender = r.gender === "أنثى" || r.gender?.toUpperCase() === "FEMALE" ? "FEMALE" : r.gender === "ذكر" || r.gender?.toUpperCase() === "MALE" ? "MALE" : null;
      if (!r.name || r.name.trim().length < 3) {
        report.push({ row: rowNo, name: r.name, ok: false, error: "الاسم ناقص" });
        continue;
      }
      if (!gender) {
        report.push({ row: rowNo, name: r.name, ok: false, error: "الجنس يجب أن يكون ذكر/أنثى" });
        continue;
      }
      if (!/^07\d{9}$/.test(r.guardianPhone ?? "")) {
        report.push({ row: rowNo, name: r.name, ok: false, error: "هاتف ولي الأمر غير صالح" });
        continue;
      }
      if (!r.stage || !r.section) {
        report.push({ row: rowNo, name: r.name, ok: false, error: "المرحلة/الشعبة ناقصة" });
        continue;
      }
      try {
        await this.create(
          user,
          {
            name: r.name,
            gender: gender as "MALE" | "FEMALE",
            stage: r.stage,
            section: r.section,
            guardianName: r.guardianName || r.name.split(" ").slice(1).join(" "),
            guardianPhone: r.guardianPhone,
          },
          ctx,
        );
        created++;
        report.push({ row: rowNo, name: r.name, ok: true });
      } catch (e) {
        report.push({ row: rowNo, name: r.name, ok: false, error: "فشل الحفظ" });
      }
    }
    await this.audit.log({
      user,
      tenantId,
      action: `استيراد CSV: ${created} طالب من ${rows.length} صف`,
      entity: "Student",
      entityId: "csv-import",
      after: { created, rejected: rows.length - created },
      ctx,
    });
    return { total: rows.length, created, rejected: rows.length - created, report };
  }
}
