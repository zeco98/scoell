import { Controller, Get, Module } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../common/decorators";
import { tenantWhere, type AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("transport")
@ApiBearerAuth()
@Controller("routes")
class TransportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "AUDITOR")
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.transportRoute.findMany({
      where: tenantWhere(user),
      include: {
        driver: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  /** مسارات السائق الحالي وطلابها — شاشة DRIVER */
  @Get("mine")
  @Roles("DRIVER")
  async mine(@CurrentUser() user: AuthUser) {
    return this.prisma.transportRoute.findMany({
      where: { driverUserId: user.id },
      include: {
        students: {
          where: { archivedAt: null, status: "active" },
          select: {
            id: true,
            name: true,
            code: true,
            guardianName: true,
            guardianPhone: true,
            address: true,
            section: { select: { stage: true, name: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });
  }
}

@Module({ controllers: [TransportController] })
export class TransportModule {}
