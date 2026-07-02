import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../common/decorators";
import { tenantWhere, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("sections")
@ApiBearerAuth()
@Controller("sections")
export class SectionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "AUDITOR")
  async list(@CurrentUser() user: AuthUser) {
    const sections = await this.prisma.section.findMany({
      where: tenantWhere(user),
      include: { _count: { select: { students: { where: { archivedAt: null } } } } },
      orderBy: [{ stage: "asc" }, { name: "asc" }],
    });
    return sections.map((s) => ({
      id: s.id,
      stage: s.stage,
      name: s.name,
      label: `${s.stage} / ${s.name}`,
      studentCount: s._count.students,
    }));
  }

  @Get(":id/students")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "AUDITOR")
  async students(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.prisma.student.findMany({
      where: { sectionId: id, archivedAt: null, status: "active", ...tenantWhere(user) },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, gender: true },
    });
  }
}
