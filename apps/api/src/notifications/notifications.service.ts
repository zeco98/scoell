import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/types";

export interface NotifyInput {
  title: string;
  body: string;
  kind?: string;
}

/**
 * مزوّد قنوات خارجي — abstraction جاهز للربط (SMS/WhatsApp/Push).
 * التنفيذ الحالي يسجّل فقط؛ الربط الفعلي (Twilio/FCM/...) يستبدل هذه الفئة
 * دون تغيير أي مستهلك.
 */
export interface ChannelProvider {
  send(channel: string, to: string, title: string, body: string): Promise<{ ok: boolean }>;
}

@Injectable()
export class StubChannelProvider implements ChannelProvider {
  private readonly logger = new Logger("ChannelProvider");
  async send(channel: string, to: string, title: string, body: string) {
    this.logger.log(`[${channel}] → ${to}: ${title} — ${body.slice(0, 60)}`);
    return { ok: true };
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: StubChannelProvider,
  ) {}

  /** إشعار in-app حقيقي — جدول + عدّاد غير مقروء */
  async notify(userId: string, input: NotifyInput) {
    return this.prisma.notification.create({
      data: { userId, title: input.title, body: input.body, kind: input.kind ?? "general" },
    });
  }

  async notifyMany(userIds: string[], input: NotifyInput) {
    if (userIds.length === 0) return { count: 0 };
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: input.title,
        body: input.body,
        kind: input.kind ?? "general",
      })),
    });
  }

  async sendExternal(channel: string, to: string, title: string, body: string) {
    return this.provider.send(channel, to, title, body);
  }

  async listMine(user: AuthUser, unreadOnly = false) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(user: AuthUser, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
