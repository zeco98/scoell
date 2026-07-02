import { Body, Controller, Get, Module, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { tenantWhere, requireTenant, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const employeeSchema = z.object({
  name: z.string().min(3, "اسم الموظف مطلوب"),
  title: z.string().min(2, "المسمى الوظيفي مطلوب"),
  phone: z.string().regex(/^07\d{9}$/, "رقم هاتف صالح مطلوب").optional().or(z.literal("")),
  contractType: z.enum(["full_time", "part_time", "contract"]).default("full_time"),
  salary: z.number().int().positive().optional(),
});

@ApiTags("hr")
@ApiBearerAuth()
@Controller("employees")
class HrController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "HR", "AUDITOR")
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.employee.findMany({
      where: tenantWhere(user),
      orderBy: { name: "asc" },
    });
  }

  @Post()
  @Roles("HR")
  async create(
    @Body(new ZodPipe(employeeSchema)) dto: z.infer<typeof employeeSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenantId = requireTenant(user);
    const employee = await this.prisma.employee.create({
      data: { ...dto, phone: dto.phone || null, tenantId },
    });
    await this.audit.log({
      user,
      action: `إضافة موظف: ${dto.name} (${dto.title})`,
      entity: "Employee",
      entityId: employee.id,
      after: { name: dto.name, title: dto.title },
      ctx: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });
    return employee;
  }

  @Patch(":id")
  @Roles("HR")
  async update(
    @Param("id") id: string,
    @Body(new ZodPipe(employeeSchema.partial().extend({ status: z.enum(["active", "on_leave", "terminated"]).optional() })))
    dto: Partial<z.infer<typeof employeeSchema>> & { status?: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const before = await this.prisma.employee.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!before) throw new NotFoundException("الموظف غير موجود");
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { ...dto, phone: dto.phone === "" ? null : dto.phone },
    });
    await this.audit.log({
      user,
      action: `تعديل ملف الموظف ${employee.name}`,
      entity: "Employee",
      entityId: id,
      before: { title: before.title, status: before.status, salary: before.salary },
      after: { title: employee.title, status: employee.status, salary: employee.salary },
      severity: dto.status === "terminated" ? "warning" : "info",
      ctx: { ip: req.ip, userAgent: req.headers["user-agent"] },
    });
    return employee;
  }
}

@Module({ controllers: [HrController] })
export class HrModule {}
