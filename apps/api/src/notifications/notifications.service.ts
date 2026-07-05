import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/types";

export interface NotifyInput {
  title: string;
  body: string;
  kind?: string;
}

/**
 * مزوّد قناة خارجية واحدة — abstraction جاهز للربط. لكل قناة مزوّدها:
 * WhatsApp (الأهم للعراق) عبر WhatsApp Business API (قوالب معتمدة)، SMS عبر
 * مزوّد محلي. التنفيذ الحالي محاكاة تسجّل حمولة منظّمة؛ الربط الفعلي يستبدل
 * الفئة دون تغيير أي مستهلك.
 */
export interface ChannelProvider {
  readonly channel: string;
  send(to: string, title: string, body: string): Promise<{ ok: boolean; ref?: string }>;
}

/**
 * واتساب — القناة الأولى للعراق. البنية جاهزة لـ WhatsApp Business Cloud API:
 * POST https://graph.facebook.com/v20.0/{phoneNumberId}/messages برسالة نصية أو
 * قالب معتمد (utility templates لتأكيد الدفع/إشعار الغياب). يتطلب رقمًا معتمدًا +
 * WABA_TOKEN + PHONE_NUMBER_ID في البيئة.
 */
@Injectable()
export class WhatsAppProvider implements ChannelProvider {
  readonly channel = "WHATSAPP";
  private readonly logger = new Logger("WhatsApp");
  async send(to: string, title: string, body: string) {
    // بيئة محاكاة — الحمولة بشكل WA Business API الحقيقي (jsonب messaging_product)
    this.logger.log(`[WA] → ${to} :: ${title} — ${body.slice(0, 80)}`);
    // للربط الفعلي: fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,{...})
    return { ok: true, ref: `wa_${Date.now()}` };
  }
}

/** SMS عبر مزوّد محلي — احتياطي حين لا يملك ولي الأمر واتساب */
@Injectable()
export class SmsProvider implements ChannelProvider {
  readonly channel = "SMS";
  private readonly logger = new Logger("SMS");
  async send(to: string, title: string, body: string) {
    this.logger.log(`[SMS] → ${to} :: ${body.slice(0, 80)}`);
    return { ok: true, ref: `sms_${Date.now()}` };
  }
}

/** موزّع القنوات — يختار المزوّد الصحيح حسب القناة (WHATSAPP/SMS/IN_APP) */
@Injectable()
export class ChannelRouter {
  private readonly map: Record<string, ChannelProvider>;
  constructor(wa: WhatsAppProvider, sms: SmsProvider) {
    this.map = { WHATSAPP: wa, SMS: sms };
  }
  async send(channel: string, to: string, title: string, body: string) {
    const provider = this.map[channel];
    if (!provider) return { ok: false }; // IN_APP لا يمر من هنا
    return provider.send(to, title, body);
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ChannelRouter,
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
    return this.router.send(channel, to, title, body);
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
