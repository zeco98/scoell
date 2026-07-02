import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreateMessageDto } from "@manarah/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, type AuditContext } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { tenantWhere, requireTenant, type AuthUser } from "../common/types";

const AUDIENCE_LABELS: Record<string, string> = {
  ALL_PARENTS: "جميع أولياء الأمور",
  TEACHERS: "المعلمون",
  STUDENTS: "الطلبة",
  SECTION: "شعبة محددة",
  INDIVIDUALS: "أفراد محددون",
  ABSENTEES: "أولياء أمور الغائبين اليوم",
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  list(user: AuthUser) {
    return this.prisma.message.findMany({
      where: tenantWhere(user),
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** حلّ الجمهور المستهدف إلى قائمة مستخدمين فعلية */
  private async resolveAudience(tenantId: string, dto: CreateMessageDto): Promise<{ userIds: string[]; label: string }> {
    const a = dto.audience;
    switch (a.kind) {
      case "ALL_PARENTS": {
        const users = await this.prisma.user.findMany({ where: { tenantId, role: "PARENT" }, select: { id: true } });
        return { userIds: users.map((u) => u.id), label: AUDIENCE_LABELS[a.kind] };
      }
      case "TEACHERS": {
        const users = await this.prisma.user.findMany({ where: { tenantId, role: "TEACHER" }, select: { id: true } });
        return { userIds: users.map((u) => u.id), label: AUDIENCE_LABELS[a.kind] };
      }
      case "STUDENTS": {
        const users = await this.prisma.user.findMany({ where: { tenantId, role: "STUDENT" }, select: { id: true } });
        return { userIds: users.map((u) => u.id), label: AUDIENCE_LABELS[a.kind] };
      }
      case "SECTION": {
        if (!a.sectionId) throw new BadRequestException("حدّد الشعبة");
        const students = await this.prisma.student.findMany({
          where: { tenantId, sectionId: a.sectionId, guardianUserId: { not: null } },
          select: { guardianUserId: true },
        });
        const section = await this.prisma.section.findUnique({ where: { id: a.sectionId } });
        return {
          userIds: [...new Set(students.map((s) => s.guardianUserId!))],
          label: section ? `أولياء أمور ${section.stage}/${section.name}` : AUDIENCE_LABELS[a.kind],
        };
      }
      case "INDIVIDUALS": {
        if (!a.userIds?.length) throw new BadRequestException("حدّد المستلمين");
        return { userIds: a.userIds, label: `${a.userIds.length} مستلم` };
      }
      case "ABSENTEES": {
        const today = new Date().toISOString().slice(0, 10);
        const absent = await this.prisma.attendanceRecord.findMany({
          where: { tenantId, date: today, mark: "absent" },
          include: { student: { select: { guardianUserId: true } } },
        });
        return {
          userIds: [...new Set(absent.map((r) => r.student.guardianUserId).filter((x): x is string => !!x))],
          label: AUDIENCE_LABELS[a.kind],
        };
      }
      default:
        throw new BadRequestException("جمهور غير مدعوم");
    }
  }

  async create(user: AuthUser, dto: CreateMessageDto, ctx: AuditContext) {
    const tenantId = requireTenant(user);
    const { userIds, label } = await this.resolveAudience(tenantId, dto);

    const scheduled = dto.scheduledAt && new Date(dto.scheduledAt) > new Date();
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        title: dto.title,
        body: dto.body,
        channel: dto.channel,
        audienceKind: dto.audience.kind,
        audienceMeta: JSON.stringify({ ...dto.audience, label, recipients: userIds.length }),
        status: scheduled ? "scheduled" : "sent",
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        sentAt: scheduled ? null : new Date(),
        createdById: user.id,
      },
    });

    let delivered = 0;
    if (!scheduled) {
      // in-app دائمًا؛ القنوات الخارجية عبر الـ provider abstraction
      await this.notifications.notifyMany(userIds, { title: dto.title, body: dto.body, kind: "general" });
      delivered = userIds.length;
      if (dto.channel !== "IN_APP") {
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { phone: true, email: true },
        });
        for (const u of users) {
          await this.notifications.sendExternal(dto.channel, u.phone ?? u.email ?? "", dto.title, dto.body);
        }
      }
    }

    await this.audit.log({
      user,
      tenantId,
      action: `${scheduled ? "جدولة" : "إرسال"} رسالة «${dto.title}» إلى ${label} (${userIds.length} مستلم) عبر ${dto.channel}`,
      entity: "Message",
      entityId: message.id,
      after: { title: dto.title, channel: dto.channel, recipients: userIds.length },
      ctx,
    });

    return { ...message, recipients: userIds.length, delivered };
  }
}
