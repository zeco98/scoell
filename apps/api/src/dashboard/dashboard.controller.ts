import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators";
import { tenantWhere, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /** حمولة موحّدة حسب الدور — الواجهة تعرض ما يخص دورها فقط */
  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const where = tenantWhere(user);

    if (user.role === "SUPER_ADMIN" || user.role === "AUDITOR") {
      const [tenants, students, auditToday, criticalCount, warningCount, feeAgg] = await Promise.all([
        this.prisma.tenant.findMany({
          include: { _count: { select: { students: { where: { archivedAt: null } } } } },
        }),
        this.prisma.student.count({ where: { archivedAt: null } }),
        this.prisma.auditLog.count({
          where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        }),
        this.prisma.auditLog.count({ where: { severity: "critical" } }),
        this.prisma.auditLog.count({ where: { severity: "warning" } }),
        this.prisma.feeRecord.aggregate({ _sum: { total: true, paid: true } }),
      ]);
      return {
        role: user.role,
        platform: {
          totalTenants: tenants.length,
          activeTenants: tenants.filter((t) => t.status === "active").length,
          suspendedTenants: tenants.filter((t) => t.status === "suspended").length,
          totalStudents: students,
          auditToday,
          criticalCount,
          warningCount,
          collected: feeAgg._sum.paid ?? 0,
          tenants: tenants.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            plan: t.plan,
            students: t._count.students,
          })),
        },
        recentAudit: await this.recentAudit(user),
      };
    }

    if (user.role === "PARENT") {
      const wards = await this.prisma.student.findMany({
        where: { guardianUserId: user.id, archivedAt: null },
        include: {
          section: true,
          attendance: { where: { date: today() } },
          feeRecords: true,
          examResults: { orderBy: { updatedAt: "desc" }, take: 5, include: { exam: true } },
        },
      });
      return {
        role: user.role,
        wards: wards.map((w) => ({
          id: w.id,
          name: w.name,
          section: w.section ? `${w.section.stage} / ${w.section.name}` : null,
          todayMark: w.attendance[0]?.mark ?? null,
          balance: w.feeRecords.reduce((a, f) => a + (f.total - f.paid), 0),
          recentResults: w.examResults.map((r) => ({
            exam: r.exam.name,
            subject: r.exam.subject,
            total: r.total,
            grade: r.grade,
          })),
        })),
        recentAudit: [], // ثابت في الشكل عبر كل الأدوار (ولي الأمر لا يرى التدقيق)
      };
    }

    // أدوار المؤسسة: SCHOOL_ADMIN / ACCOUNTANT / TEACHER / STUDENT / HR / DRIVER
    const [activeStudents, attendanceMarks, feeAgg, pendingAdmissions, paymentsThisMonth, sections] =
      await Promise.all([
        this.prisma.student.count({ where: { ...where, archivedAt: null, status: "active" } }),
        this.prisma.attendanceRecord.groupBy({
          by: ["mark"],
          where: { ...where, date: today() },
          _count: true,
        }),
        this.prisma.feeRecord.aggregate({ where, _sum: { total: true, paid: true } }),
        this.prisma.admission.count({ where: { ...where, stage: { in: ["new", "reviewing", "interview"] } } }),
        this.prisma.payment.count({
          where: {
            ...where,
            voidedAt: null,
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
        }),
        this.prisma.section.findMany({
          where,
          include: { _count: { select: { students: { where: { archivedAt: null } } } } },
        }),
      ]);

    const mark = (m: string) => attendanceMarks.find((x) => x.mark === m)?._count ?? 0;
    const total = feeAgg._sum.total ?? 0;
    const paid = feeAgg._sum.paid ?? 0;

    return {
      role: user.role,
      school: {
        activeStudents,
        presentToday: mark("present"),
        absentToday: mark("absent"),
        lateToday: mark("late"),
        collected: paid,
        outstanding: total - paid,
        collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
        pendingAdmissions,
        receiptsThisMonth: paymentsThisMonth,
        enrollmentByStage: Object.entries(
          sections.reduce<Record<string, number>>((acc, s) => {
            acc[s.stage] = (acc[s.stage] ?? 0) + s._count.students;
            return acc;
          }, {}),
        ).map(([stage, students]) => ({ stage, students })),
      },
      recentAudit: await this.recentAudit(user),
    };
  }

  private async recentAudit(user: AuthUser) {
    if (!["SUPER_ADMIN", "AUDITOR", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) return [];
    return this.prisma.auditLog.findMany({
      where: tenantWhere(user),
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, userName: true, action: true, severity: true, createdAt: true },
    });
  }
}
