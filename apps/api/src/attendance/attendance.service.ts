import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { BulkAttendanceDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { tenantWhere, requireTenant, type AuthUser } from "../common/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** قائمة التحضير لشعبة/يوم: الطلاب النشطون + علاماتهم إن وُجدت */
  async sheet(user: AuthUser, sectionId: string, date?: string) {
    const d = date ?? today();
    const students = await this.prisma.student.findMany({
      where: { sectionId, archivedAt: null, status: "active", ...tenantWhere(user) },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });
    const records = await this.prisma.attendanceRecord.findMany({
      where: { sectionId, date: d, ...tenantWhere(user) },
    });
    const map = new Map(records.map((r) => [r.studentId, r]));
    return {
      date: d,
      saved: records.length > 0,
      rows: students.map((s) => ({
        studentId: s.id,
        code: s.code,
        name: s.name,
        mark: map.get(s.id)?.mark ?? "present",
        note: map.get(s.id)?.note ?? undefined,
      })),
    };
  }

  /** حفظ جماعي — تحضير اليوم للمعلم؛ بأثر رجعي لمدير المدرسة فقط */
  async saveBulk(user: AuthUser, dto: BulkAttendanceDto, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    if (dto.date !== today() && user.role === "TEACHER") {
      throw new ForbiddenException("التحضير بأثر رجعي يتطلب صلاحية مدير المدرسة");
    }
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, tenantId },
    });
    if (!section) throw new BadRequestException("الشعبة غير موجودة");

    const existing = await this.prisma.attendanceRecord.findMany({
      where: { sectionId: dto.sectionId, date: dto.date },
    });
    const existingMap = new Map(existing.map((r) => [r.studentId, r]));

    await this.prisma.$transaction(
      dto.rows.map((row) =>
        this.prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: row.studentId, date: dto.date } },
          create: {
            tenantId,
            studentId: row.studentId,
            sectionId: dto.sectionId,
            date: dto.date,
            mark: row.mark,
            note: row.note,
            recordedById: user.id,
          },
          update: { mark: row.mark, note: row.note, recordedById: user.id },
        }),
      ),
    );

    const absentees = dto.rows.filter((r) => r.mark === "absent");
    // إشعار تلقائي لأولياء أمور الغائبين (سياسة قابلة للتعطيل من الإعدادات)
    const settings = await this.tenantSettings(tenantId);
    let notified = 0;
    if (settings.autoAbsenceNotify !== false && absentees.length > 0) {
      const students = await this.prisma.student.findMany({
        where: { id: { in: absentees.map((a) => a.studentId) } },
        select: { id: true, name: true, guardianUserId: true },
      });
      for (const s of students) {
        if (s.guardianUserId) {
          await this.notifications.notify(s.guardianUserId, {
            title: "إشعار غياب",
            body: `ابنكم ${s.name} غائب اليوم ${dto.date}. نرجو إبلاغ الإدارة بالعذر إن وُجد.`,
            kind: "absence",
          });
          notified++;
        }
      }
    }

    const changed = dto.rows.filter((r) => existingMap.get(r.studentId)?.mark !== r.mark).length;
    await this.audit.log({
      user,
      tenantId,
      action: `تحضير الشعبة ${section.stage}/${section.name} ليوم ${dto.date} (${dto.rows.length} طالب، ${absentees.length} غائب)`,
      entity: "Attendance",
      entityId: `${dto.sectionId}:${dto.date}`,
      before: existing.length > 0 ? { savedMarks: existing.length } : undefined,
      after: { rows: dto.rows.length, absent: absentees.length, changed },
      severity: existing.length > 0 && dto.date !== today() ? "warning" : "info",
      ctx,
    });

    return { ok: true, saved: dto.rows.length, absent: absentees.length, guardiansNotified: notified };
  }

  async todaySummary(user: AuthUser) {
    const marks = await this.prisma.attendanceRecord.groupBy({
      by: ["mark"],
      where: { date: today(), ...tenantWhere(user) },
      _count: true,
    });
    const get = (m: string) => marks.find((x) => x.mark === m)?._count ?? 0;
    return {
      date: today(),
      present: get("present"),
      absent: get("absent"),
      late: get("late"),
      early: get("early"),
    };
  }

  async report(user: AuthUser, q: { sectionId?: string; from?: string; to?: string; studentId?: string }) {
    const where = {
      ...tenantWhere(user),
      ...(q.sectionId ? { sectionId: q.sectionId } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(user.role === "PARENT" ? { student: { guardianUserId: user.id } } : {}),
      ...(q.from || q.to
        ? { date: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
    };
    return this.prisma.attendanceRecord.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, code: true } },
        section: { select: { stage: true, name: true } },
      },
      orderBy: [{ date: "desc" }],
      take: 500,
    });
  }

  private async tenantSettings(tenantId: string): Promise<Record<string, unknown>> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    try {
      return JSON.parse(t?.settings ?? "{}");
    } catch {
      return {};
    }
  }
}
