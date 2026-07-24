import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ALL_ROLES } from "@manarah/shared";
import { CurrentUser, Feature, Roles } from "../common/decorators";
import type { AuthUser } from "../common/types";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Feature("NOTIFICATIONS")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Roles(...ALL_ROLES)
  list(@CurrentUser() user: AuthUser, @Query("unread") unread?: string) {
    return this.notifications.listMine(user, unread === "true");
  }

  @Patch(":id/read")
  @Roles(...ALL_ROLES)
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.notifications.markRead(user, id);
  }

  @Patch("read-all")
  @Roles(...ALL_ROLES)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}
