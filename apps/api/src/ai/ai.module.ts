import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser, Feature, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { tenantWhere, requireTenant, auditCtx as ctx, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

// ---------------------------------------------------------------------------
// AI Provider Abstraction — provider-agnostic.
// التنفيذ الحالي: مولّد قوالب محلي (بلا مفاتيح خارجية). للربط الحقيقي:
// نفّذ AiProvider بـ Anthropic SDK (claude-sonnet-5) واستبدل الـ provider —
// قاعدة «مسودّة → مراجعة بشرية → اعتماد» تبقى إلزامية في كل الأحوال.
// ---------------------------------------------------------------------------
export interface AiProvider {
  generate(kind: string, context: Record<string, unknown>): Promise<string>;
}

@Injectable()
class TemplateAiProvider implements AiProvider {
  async generate(kind: string, context: Record<string, unknown>): Promise<string> {
    const name = (context.studentName as string) ?? "الطالب";
    switch (kind) {
      case "student_report":
        return `تقرير أداء — ${name}\n\nيُظهر ${name} التزامًا جيدًا بالحضور (${context.attendanceRate ?? "—"}%) ومعدلًا عامًا ${context.gpa ?? "—"}. يُوصى بمتابعة الواجبات المنزلية وتعزيز المشاركة الصفية. الحالة العامة: ${Number(context.gpa ?? 0) >= 80 ? "ممتازة" : "جيدة وتحتاج متابعة"}.`;
      case "parent_message":
        return `السلام عليكم ورحمة الله،\n\nنودّ إعلامكم بمستجدات ابنكم ${name}. نثمّن تعاونكم المستمر مع إدارة المدرسة، ونرحب بزيارتكم لمناقشة أي ملاحظات.\n\nمع خالص التقدير — إدارة المدرسة`;
      case "exam_questions":
        return `بنك أسئلة مقترح — ${context.subject ?? "المادة"}:\n\n1. سؤال تعريفي (سهل)\n2. سؤال مقارنة (متوسط)\n3. مسألة تطبيقية (متوسط)\n4. سؤال تحليلي (صعب)\n5. سؤال إبداعي مفتوح (تمييز)\n\n⚠️ هذه هيكلة مقترحة — أكملها بمحتوى المنهج الفعلي.`;
      case "attendance_summary":
        return `تحليل نمط الحضور:\n\nنسبة الحضور العامة ${context.attendanceRate ?? "—"}%. لوحظ تكرار الغياب أيام محددة — يُوصى بالتواصل مع أولياء الأمور المعنيين وتفعيل الإشعار التلقائي.`;
      default:
        return "لا يتوفر قالب لهذا النوع.";
    }
  }
}

const generateSchema = z.object({
  kind: z.enum(["student_report", "parent_message", "exam_questions", "attendance_summary"]),
  context: z.record(z.unknown()).default({}),
});

@ApiTags("ai")
@ApiBearerAuth()
@Feature("AI_ASSISTANT")
@Controller("ai")
class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly provider: TemplateAiProvider,
  ) {}

  @Get("requests")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "AUDITOR")
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.aiRequest.findMany({
      where: tenantWhere(user),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Post("generate")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER")
  async generate(
    @Body(new ZodPipe(generateSchema)) dto: z.infer<typeof generateSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenantId = requireTenant(user);
    const output = await this.provider.generate(dto.kind, dto.context);
    const request = await this.prisma.aiRequest.create({
      data: {
        tenantId,
        kind: dto.kind,
        prompt: JSON.stringify(dto.context),
        output,
        createdById: user.id,
      },
    });
    await this.audit.log({
      user,
      action: `توليد مسودّة AI (${dto.kind})`,
      entity: "AiRequest",
      entityId: request.id,
      ctx: ctx(req),
    });
    return request;
  }

  @Patch("requests/:id")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER")
  async edit(
    @Param("id") id: string,
    @Body() body: { output: string },
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.aiRequest.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!existing) throw new NotFoundException("الطلب غير موجود");
    return this.prisma.aiRequest.update({
      where: { id },
      data: { output: body.output, status: "draft" },
    });
  }

  @Post("requests/:id/approve")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER")
  async approve(@Param("id") id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const existing = await this.prisma.aiRequest.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!existing) throw new NotFoundException("الطلب غير موجود");
    const updated = await this.prisma.aiRequest.update({
      where: { id },
      data: { status: "approved", approvedById: user.id },
    });
    await this.audit.log({
      user,
      action: `اعتماد مخرَج AI (${existing.kind}) بعد مراجعة بشرية`,
      entity: "AiRequest",
      entityId: id,
      before: { status: existing.status },
      after: { status: "approved" },
      ctx: ctx(req),
    });
    return updated;
  }
}

@Module({
  controllers: [AiController],
  providers: [TemplateAiProvider],
})
export class AiModule {}
