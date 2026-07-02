import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createAdmissionSchema, type CreateAdmissionDto } from "@manarah/shared";
import type { Request } from "express";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import type { AuthUser } from "../common/types";
import { AdmissionsService } from "./admissions.service";

function ctx(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

@ApiTags("admissions")
@ApiBearerAuth()
@Controller("admissions")
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "AUDITOR")
  list(@CurrentUser() user: AuthUser) {
    return this.admissions.list(user);
  }

  @Post()
  @Roles("SCHOOL_ADMIN")
  create(
    @Body(new ZodPipe(createAdmissionSchema)) dto: CreateAdmissionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.admissions.create(user, dto, ctx(req));
  }

  @Patch(":id/stage")
  @Roles("SCHOOL_ADMIN")
  changeStage(
    @Param("id") id: string,
    @Body() body: { stage: string; reason?: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.admissions.changeStage(user, id, body.stage, body.reason, ctx(req));
  }

  @Post(":id/convert")
  @Roles("SCHOOL_ADMIN")
  convert(@Param("id") id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admissions.convert(user, id, ctx(req));
  }
}
