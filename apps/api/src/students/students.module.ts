import { Module } from "@nestjs/common";
import { StudentsController } from "./students.controller";
import { StudentsService } from "./students.service";
import { SectionsController } from "./sections.controller";

@Module({
  controllers: [StudentsController, SectionsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
