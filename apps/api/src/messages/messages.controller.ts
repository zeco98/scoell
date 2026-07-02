import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createMessageSchema, type CreateMessageDto } from "@manarah/shared";
import type { Request } from "express";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import type { AuthUser } from "../common/types";
import { MessagesService } from "./messages.service";

@ApiTags("messages")
@ApiBearerAuth()
@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "AUDITOR")
  list(@CurrentUser() user: AuthUser) {
    return this.messages.list(user);
  }

  @Post()
  @Roles("SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER")
  create(
    @Body(new ZodPipe(createMessageSchema)) dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.messages.create(user, dto, { ip: req.ip, userAgent: req.headers["user-agent"] });
  }
}
