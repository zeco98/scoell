import { Body, Controller, Get, Param, Patch, Post, Req, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { auditCtx as ctx, type AuthUser } from "../common/types";
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
}
