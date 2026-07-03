import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { bulkAttendanceSchema, type BulkAttendanceDto } from "@manarah/shared";
import type { Request } from "express";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { auditCtx, type AuthUser } from "../common/types";
import { AttendanceService } from "./attendance.service";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("sheet")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "AUDITOR")
  sheet(
    @CurrentUser() user: AuthUser,
    @Query("sectionId") sectionId: string,
    @Query("date") date?: string,
  ) {
    return this.attendance.sheet(user, sectionId, date);
  }

  @Post("bulk")
  @Roles("SCHOOL_ADMIN", "TEACHER")
  saveBulk(
    @Body(new ZodPipe(bulkAttendanceSchema)) dto: BulkAttendanceDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.attendance.saveBulk(user, dto, auditCtx(req));
  }

  @Get("today")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "ACCOUNTANT", "AUDITOR")
  todaySummary(@CurrentUser() user: AuthUser) {
    return this.attendance.todaySummary(user);
  }

  @Get("report")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "AUDITOR")
  report(
    @CurrentUser() user: AuthUser,
    @Query("sectionId") sectionId?: string,
    @Query("studentId") studentId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.attendance.report(user, { sectionId, studentId, from, to });
  }
}
