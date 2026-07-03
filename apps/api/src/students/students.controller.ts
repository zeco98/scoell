import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createStudentSchema, type CreateStudentDto } from "@manarah/shared";
import type { Request } from "express";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import type { AuthUser } from "../common/types";
import { StudentsService } from "./students.service";

function ctx(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

@ApiTags("students")
@ApiBearerAuth()
@Controller("students")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "AUDITOR")
  list(
    @CurrentUser() user: AuthUser,
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("sectionId") sectionId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.students.list(user, {
      query,
      status,
      sectionId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "AUDITOR")
  detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.students.detail(user, id);
  }

  @Post()
  @Roles("SCHOOL_ADMIN")
  create(
    @Body(new ZodPipe(createStudentSchema)) dto: CreateStudentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.create(user, dto, ctx(req));
  }

  @Patch(":id")
  @Roles("SCHOOL_ADMIN")
  update(
    @Param("id") id: string,
    @Body(new ZodPipe(createStudentSchema.partial())) dto: Partial<CreateStudentDto>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.update(user, id, dto, ctx(req));
  }

  @Patch(":id/status")
  @Roles("SCHOOL_ADMIN")
  changeStatus(
    @Param("id") id: string,
    @Body() body: { status: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.changeStatus(user, id, body.status, ctx(req));
  }

  @Patch(":id/section")
  @Roles("SCHOOL_ADMIN")
  moveSection(
    @Param("id") id: string,
    @Body() body: { sectionId: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.moveSection(user, id, body.sectionId, ctx(req));
  }

  @Delete(":id")
  @Roles("SCHOOL_ADMIN")
  archive(@Param("id") id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.students.archive(user, id, ctx(req));
  }

  @Post("import")
  @Roles("SCHOOL_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.importCsv(user, file.buffer, ctx(req));
  }

  /** رفع وثيقة لطالب (هوية، بطاقة سكن...) — تخزين محلي S3-ready */
  @Post(":id/documents")
  @Roles("SCHOOL_ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.uploadDocument(user, id, file, ctx(req));
  }
}
