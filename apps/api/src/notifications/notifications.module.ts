import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService, StubChannelProvider } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, StubChannelProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
