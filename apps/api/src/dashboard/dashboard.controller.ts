import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../common/decorators";
import { tenantWhere, ownStudentWhere, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * حمولة موحّدة حسب الدور — كل دور يستلم حقولًا مختلفة الشكل تمامًا (لا حقلًا
   * ماليًا مشتركًا يُخفى بالواجهة فقط). @Roles صريحة على كل الأدوار التسعة
   * (fail-closed): أي دور جديد يُضاف مستقبلًا يُحجب تلقائيًا حتى تُقرَّر حمولته.
   */
  @Get()
  @Roles("SUPER_ADMIN", "AUDITOR", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "HR", "DRIVER")
  async get(@CurrentUser() user: AuthUser) {
    switch (user.role) {
      case "SUPER_ADMIN":
      case "AUDITOR":
        return this.platformDashboard(user);
      case "PARENT":
        return this.parentDashboard(user);
      case "STUDENT":
        return this.studentDashboard(user);
      case "TEACHER":
        return this.teacherDashboard(user);
      case "HR":
        return this.hrDashboard(user);
      case "DRIVER":
        return this.driverDashboard(user);
      case "SCHOOL_ADMIN":
      case "ACCOUNTANT":
        return this.schoolDashboard(user);
    }
  }

  private async platformDashboard(user: AuthUser) {
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

  private async parentDashboard(user: AuthUser) {
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
      recentAudit: [],
    };
  }

  /** الطالب: بياناته الخاصة فقط — صفر حقول مالية/إدارية للمؤسسة (C4) */
  private async studentDashboard(user: AuthUser) {
    const me = await this.prisma.student.findFirst({
      where: { ...ownStudentWhere(user), archivedAt: null },
      include: {
        section: true,
        attendance: { where: { date: today() } },
        examResults: { orderBy: { updatedAt: "desc" }, take: 5, include: { exam: true } },
      },
    });
    if (!me) {
      return { role: user.role, student: null, recentAudit: [] };
    }
    const attendanceAgg = await this.prisma.attendanceRecord.groupBy({
      by: ["mark"],
      where: { studentId: me.id },
      _count: true,
    });
    const totalMarks = attendanceAgg.reduce((a, x) => a + x._count, 0);
    const presentMarks = attendanceAgg
      .filter((x) => x.mark === "present" || x.mark === "late" || x.mark === "early")
      .reduce((a, x) => a + x._count, 0);
    return {
      role: user.role,
      student: {
        name: me.name,
        section: me.section ? `${me.section.stage} / ${me.section.name}` : null,
        todayMark: me.attendance[0]?.mark ?? null,
        attendanceRate: totalMarks > 0 ? Math.round((presentMarks / totalMarks) * 100) : null,
        recentResults: me.examResults.map((r) => ({
          exam: r.exam.name,
          subject: r.exam.subject,
          total: r.total,
          grade: r.grade,
        })),
      },
      recentAudit: [],
    };
  }

  /** المعلم: شعبه فقط — صفر بيانات مالية أو إدارية للمؤسسة (C4) */
  private async teacherDashboard(user: AuthUser) {
    const sections = await this.prisma.section.findMany({
      where: { teacherId: user.id, ...tenantWhere(user) },
      include: { _count: { select: { students: { where: { archivedAt: null } } } } },
    });
    const sectionIds = sections.map((s) => s.id);
    const attendanceMarks = sectionIds.length
      ? await this.prisma.attendanceRecord.groupBy({
          by: ["mark"],
          where: { sectionId: { in: sectionIds }, date: today() },
          _count: true,
        })
      : [];
    const mark = (m: string) => attendanceMarks.find((x) => x.mark === m)?._count ?? 0;
    const studentsCount = sections.reduce((a, s) => a + s._count.students, 0);
    return {
      role: user.role,
      teacher: {
        sectionsCount: sections.length,
        studentsCount,
        presentToday: mark("present"),
        absentToday: mark("absent"),
        lateToday: mark("late"),
        sections: sections.map((s) => ({ id: s.id, label: `${s.stage} / ${s.name}`, students: s._count.students })),
      },
      recentAudit: [],
    };
  }

  /** الموارد البشرية: عدد الموظفين فقط — صفر إيرادات/تحصيل (C4) */
  private async hrDashboard(user: AuthUser) {
    const where = tenantWhere(user);
    const [total, active, onLeave] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.count({ where: { ...where, status: "active" } }),
      this.prisma.employee.count({ where: { ...where, status: "on_leave" } }),
    ]);
    return { role: user.role, hr: { totalEmployees: total, activeEmployees: active, onLeave }, recentAudit: [] };
  }

  /** السائق: مساراته وطلابها فقط — صفر بيانات مالية (C4) */
  private async driverDashboard(user: AuthUser) {
    const routes = await this.prisma.transportRoute.findMany({
      where: { driverUserId: user.id },
      include: { _count: { select: { students: true } } },
    });
    return {
      role: user.role,
      driver: {
        routesCount: routes.length,
        studentsCount: routes.reduce((a, r) => a + r._count.students, 0),
        routes: routes.map((r) => ({ id: r.id, name: r.name, students: r._count.students })),
      },
      recentAudit: [],
    };
  }

  /** مدير المدرسة/المحاسب: اللوحة المالية الكاملة (بلا تغيير عن السابق) */
  private async schoolDashboard(user: AuthUser) {
    const where = tenantWhere(user);
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
