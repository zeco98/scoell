import { Controller, Get, Module, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../common/decorators";
import { tenantWhere, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("search")
@ApiBearerAuth()
@Controller("search")
class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  /** البحث العام في الـ Topbar: طلبة + سندات + رسائل */
  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "AUDITOR")
  async search(@CurrentUser() user: AuthUser, @Query("q") q: string) {
    if (!q || q.trim().length < 2) return { students: [], payments: [], messages: [] };
    const where = tenantWhere(user);
    const [students, payments, messages] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          ...where,
          archivedAt: null,
          OR: [{ name: { contains: q } }, { code: { contains: q } }, { guardianName: { contains: q } }],
        },
        take: 5,
        select: { id: true, name: true, code: true, section: { select: { stage: true, name: true } } },
      }),
      this.prisma.payment.findMany({
        where: {
          ...where,
          voidedAt: null,
          OR: [{ receiptNo: { contains: q } }, { student: { name: { contains: q } } }],
        },
        take: 5,
        select: { id: true, receiptNo: true, amount: true, student: { select: { name: true } } },
      }),
      this.prisma.message.findMany({
        where: { ...where, title: { contains: q } },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true },
      }),
    ]);
    return { students, payments, messages };
  }
}

@Module({ controllers: [SearchController] })
export class SearchModule {}
