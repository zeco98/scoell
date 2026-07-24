import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { ALL_ROLES, FEATURES, type FeatureKey } from "@manarah/shared";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { auditCtx as ctx, resolveTenantFeatures, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const createTenantSchema = z.object({
  name: z.string().min(3, "اسم المؤسسة مطلوب"),
  city: z.string().optional(),
  plan: z.enum(["Basic", "Pro", "Enterprise"]).default("Basic"),
  branches: z.number().int().min(1).default(1),
});

const settingsSchema = z.object({
  blockResultsOnDebt: z.boolean().optional(),
  autoAbsenceNotify: z.boolean().optional(),
  easternNumerals: z.boolean().optional(),
  darkMode: z.boolean().optional(),
});

const tenantStatusSchema = z.object({ status: z.enum(["active", "trial", "suspended"]) });

const featuresUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        key: z.string().min(1, "مفتاح الميزة مطلوب"),
        enabled: z.boolean(),
      }),
    )
    .min(1, "لا توجد تحديثات"),
});


@ApiTags("tenants")
@ApiBearerAuth()
@Controller("tenants")
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles("SUPER_ADMIN", "AUDITOR")
  async list() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        _count: { select: { students: { where: { archivedAt: null } }, users: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      city: t.city,
      plan: t.plan,
      status: t.status,
      branches: t.branches,
      students: t._count.students,
      staff: t._count.users,
      createdAt: t.createdAt,
    }));
  }

  @Post()
  @Roles("SUPER_ADMIN")
  async create(
    @Body(new ZodPipe(createTenantSchema)) dto: z.infer<typeof createTenantSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenant = await this.prisma.tenant.create({ data: { ...dto, status: "trial" } });
    await this.audit.log({
      user,
      tenantId: tenant.id,
      action: `إضافة مؤسسة جديدة: ${dto.name}`,
      entity: "Tenant",
      entityId: tenant.id,
      after: { name: dto.name, plan: dto.plan },
      ctx: ctx(req),
    });
    return tenant;
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "AUDITOR", "SCHOOL_ADMIN")
  async detail(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    if (user.role === "SCHOOL_ADMIN" && user.tenantId !== id) {
      throw new ForbiddenException("لا تملك صلاحية عرض مؤسسة أخرى");
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { students: true, users: true, sections: true } } },
    });
    if (!tenant) throw new NotFoundException("المؤسسة غير موجودة");
    return { ...tenant, settings: JSON.parse(tenant.settings || "{}") };
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN")
  async changeStatus(
    @Param("id") id: string,
    @Body(new ZodPipe(tenantStatusSchema)) body: z.infer<typeof tenantStatusSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const tenant = await this.prisma.tenant.update({ where: { id }, data: { status: body.status } });
    await this.audit.log({
      user,
      tenantId: id,
      action: `تغيير حالة اشتراك ${tenant.name} إلى ${body.status}`,
      entity: "Tenant",
      entityId: id,
      before: { status: before.status },
      after: { status: body.status },
      severity: body.status === "suspended" ? "critical" : "warning",
      ctx: ctx(req),
    });
    return tenant;
  }

  /** إعدادات المؤسسة — mine للاختصار من الواجهة */
  @Get("mine/settings")
  @Roles("SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER")
  async mySettings(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) throw new ForbiddenException();
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    return { tenantId: tenant.id, name: tenant.name, settings: JSON.parse(tenant.settings || "{}") };
  }

  @Patch("mine/settings")
  @Roles("SCHOOL_ADMIN")
  async updateSettings(
    @Body(new ZodPipe(settingsSchema)) dto: z.infer<typeof settingsSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!user.tenantId) throw new ForbiddenException();
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const before = JSON.parse(tenant.settings || "{}");
    const after = { ...before, ...dto };
    await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: { settings: JSON.stringify(after) },
    });
    await this.audit.log({
      user,
      action: "تعديل إعدادات المؤسسة",
      entity: "Settings",
      entityId: user.tenantId,
      before,
      after,
      severity: "warning",
      ctx: ctx(req),
    });
    return { settings: after };
  }

  /** يحسم أعلام الميزات المفعّلة لمؤسسة معيّنة (افتراضيات + استثناءات محفوظة) */
  private async resolvedFeatures(tenantId: string) {
    const rows = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
      select: { key: true, enabled: true },
    });
    const resolved = resolveTenantFeatures(rows);
    return FEATURES.map((f) => ({ key: f.key, labelAr: f.labelAr, enabled: resolved[f.key] }));
  }

  /** أعلام الميزات لمؤسسة المستخدم الحالي — قراءة فقط، تُستخدم لتوجيه الواجهة */
  @Get("mine/features")
  @Roles(...ALL_ROLES)
  async myFeatures(@CurrentUser() user: AuthUser) {
    if (!user.tenantId) {
      // أدوار المنصة بلا مؤسسة — كل الميزات بقيمتها الافتراضية
      const defaults = resolveTenantFeatures([]);
      return { features: FEATURES.map((f) => ({ key: f.key, labelAr: f.labelAr, enabled: defaults[f.key] })) };
    }
    return { features: await this.resolvedFeatures(user.tenantId) };
  }

  @Get(":id/features")
  @Roles("SUPER_ADMIN")
  async getFeatures(@Param("id") id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) throw new NotFoundException("المؤسسة غير موجودة");
    return { tenantId: id, features: await this.resolvedFeatures(id) };
  }

  @Patch(":id/features")
  @Roles("SUPER_ADMIN")
  async updateFeatures(
    @Param("id") id: string,
    @Body(new ZodPipe(featuresUpdateSchema)) body: z.infer<typeof featuresUpdateSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) throw new NotFoundException("المؤسسة غير موجودة");

    const validKeys = new Set(FEATURES.map((f) => f.key as string));
    for (const u of body.updates) {
      if (!validKeys.has(u.key)) {
        throw new BadRequestException(`مفتاح ميزة غير معروف: ${u.key}`);
      }
    }

    await this.prisma.$transaction(
      body.updates.map((u) =>
        this.prisma.tenantFeature.upsert({
          where: { tenantId_key: { tenantId: id, key: u.key } },
          update: { enabled: u.enabled, updatedBy: user.id },
          create: { tenantId: id, key: u.key, enabled: u.enabled, updatedBy: user.id },
        }),
      ),
    );

    await this.audit.log({
      user,
      tenantId: id,
      action: `تحديث أعلام الميزات (${body.updates.length})`,
      entity: "TenantFeature",
      entityId: id,
      after: { updates: body.updates },
      severity: "warning",
      ctx: ctx(req),
    });

    return { tenantId: id, features: await this.resolvedFeatures(id) };
  }
}
