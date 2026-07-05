import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService, WhatsAppProvider, SmsProvider, ChannelRouter } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsAppProvider, SmsProvider, ChannelRouter],
  exports: [NotificationsService],
})
export class NotificationsModule {}
