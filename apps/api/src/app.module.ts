import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { StudentsModule } from "./students/students.module";
import { FeesModule } from "./fees/fees.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AdmissionsModule } from "./admissions/admissions.module";
import { ExamsModule } from "./exams/exams.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { TenantsModule } from "./tenants/tenants.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { SearchModule } from "./search/search.module";
import { AiModule } from "./ai/ai.module";
import { HrModule } from "./hr/hr.module";
import { TransportModule } from "./transport/transport.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // حد عام 300 طلب/دقيقة، وauth له حدود أشد في الـ controller (معطّل في الاختبارات)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 300 }],
      skipIf: () => process.env.NODE_ENV === "test",
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    StudentsModule,
    FeesModule,
    AttendanceModule,
    AdmissionsModule,
    ExamsModule,
    MessagesModule,
    NotificationsModule,
    TenantsModule,
    DashboardModule,
    SearchModule,
    AiModule,
    HrModule,
    TransportModule,
    UsersModule,
  ],
  providers: [
    // الترتيب مهم: مصادقة ← صلاحيات ← rate limiting
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
