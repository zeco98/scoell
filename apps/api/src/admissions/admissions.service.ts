import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ADMISSION_STAGES, type CreateAdmissionDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { tenantWhere, requireTenant, type AuthUser } from "../common/types";

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.admission.findMany({
      where: tenantWhere(user),
      orderBy: { submittedAt: "desc" },
      take: 500, // سقف أمان يمنع حمولة غير محدودة (خط أنابيب القبول محدود عمليًا)
    });
  }

  async create(user: AuthUser, dto: CreateAdmissionDto, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    const admission = await this.prisma.admission.create({
      data: {
        tenantId,
        applicantName: dto.applicantName,
        stageApplied: dto.stageApplied,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      user,
      action: `طلب تقديم جديد: ${dto.applicantName} (${dto.stageApplied})`,
      entity: "Admission",
      entityId: admission.id,
      after: { applicant: dto.applicantName, stage: "new" },
      ctx,
    });
    return admission;
  }

  async changeStage(user: AuthUser, id: string, stage: string, reason: string | undefined, ctx: AuditContext) {
    if (!ADMISSION_STAGES.includes(stage as (typeof ADMISSION_STAGES)[number])) {
      throw new BadRequestException("مرحلة غير صالحة");
    }
    if (stage === "rejected" && !reason?.trim()) {
      throw new BadRequestException("سبب الرفض إلزامي");
    }
    const before = await this.prisma.admission.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!before) throw new NotFoundException("الطلب غير موجود");
    if (before.stage === "accepted" && before.convertedStudentId) {
      throw new BadRequestException("طلب محوّل لطالب — لا يمكن تعديل مرحلته");
    }
    const admission = await this.prisma.admission.update({
      where: { id },
      data: { stage, rejectReason: stage === "rejected" ? reason : null },
    });
    await this.audit.log({
      user,
      action:
        stage === "rejected"
          ? `رفض طلب ${admission.applicantName} — السبب: ${reason}`
          : `نقل طلب ${admission.applicantName} إلى مرحلة ${stage}`,
      entity: "Admission",
      entityId: id,
      before: { stage: before.stage },
      after: { stage, ...(reason ? { reason } : {}) },
      severity: stage === "rejected" ? "warning" : "info",
      ctx,
    });
    return admission;
  }

  /** قبول → إنشاء طالب في معاملة واحدة (Admission تُعلَّم accepted + convertedStudentId) */
  async convert(user: AuthUser, id: string, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    const admission = await this.prisma.admission.findFirst({ where: { id, tenantId } });
    if (!admission) throw new NotFoundException("الطلب غير موجود");
    if (admission.convertedStudentId) throw new BadRequestException("الطلب محوّل مسبقًا");

    // شعبة افتراضية للمرحلة المطلوبة (شعبة أ) — تُنشأ إن لم توجد
    const student = await this.prisma.$transaction(async (tx) => {
      let section = await tx.section.findFirst({
        where: { tenantId, stage: admission.stageApplied, name: "أ" },
      });
      if (!section) {
        section = await tx.section.create({
          data: { tenantId, stage: admission.stageApplied, name: "أ" },
        });
      }
      const last = await tx.student.findFirst({
        where: { tenantId },
        orderBy: { code: "desc" },
        select: { code: true },
      });
      const n = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1000;
      const created = await tx.student.create({
        data: {
          tenantId,
          code: `st${n}`,
          name: admission.applicantName,
          gender: "MALE", // يُستكمل من ملف الطالب بعد التحويل
          sectionId: section.id,
          guardianName: admission.guardianName,
          guardianPhone: admission.guardianPhone,
        },
      });
      await tx.admission.update({
        where: { id },
        data: { stage: "accepted", convertedStudentId: created.id },
      });
      return created;
    });

    await this.audit.log({
      user,
      action: `قبول طلب ${admission.applicantName} وتحويله لطالب مسجّل`,
      entity: "Admission",
      entityId: id,
      before: { stage: admission.stage },
      after: { stage: "accepted", studentId: student.id, studentCode: student.code },
      ctx,
    });

    return { admission: { ...admission, stage: "accepted", convertedStudentId: student.id }, student };
  }
}
