import { Controller, Get, Module, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../common/decorators";
import { tenantWhere, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** قائمة مستخدمي المؤسسة (لاختيار مستلمي الرسائل وربط الحسابات) */
  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "HR", "AUDITOR")
  list(@CurrentUser() user: AuthUser, @Query("role") role?: string) {
    return this.prisma.user.findMany({
      where: { ...tenantWhere(user), ...(role ? { role } : {}) },
      select: { id: true, name: true, email: true, role: true, avatarColor: true },
      orderBy: { name: "asc" },
    });
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
