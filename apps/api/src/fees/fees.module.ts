import { Module } from "@nestjs/common";
import { FeesController } from "./fees.controller";
import { FeesService } from "./fees.service";
import { StubPaymentProvider } from "./payment-provider";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [FeesController],
  providers: [FeesService, StubPaymentProvider],
  exports: [FeesService],
})
export class FeesModule {}
