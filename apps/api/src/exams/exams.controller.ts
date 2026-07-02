import { Body, Controller, Get, Param, Post, Put, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { upsertExamResultSchema } from "@manarah/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { CurrentUser, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import type { AuthUser } from "../common/types";
import { ExamsService } from "./exams.service";

function ctx(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

const createExamSchema = z.object({
  name: z.string().min(2, "اسم الامتحان مطلوب"),
  subject: z.string().min(2, "المادة مطلوبة"),
  sectionId: z.string().min(1, "الشعبة مطلوبة"),
  year: z.string().min(4, "العام الدراسي مطلوب"),
});

const upsertRowsSchema = z.object({
  rows: z.array(upsertExamResultSchema.omit({ examId: true })).min(1, "لا توجد درجات للحفظ"),
});

@ApiTags("exams")
@ApiBearerAuth()
@Controller("exams")
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "AUDITOR")
  list(@CurrentUser() user: AuthUser) {
    return this.exams.list(user);
  }

  @Post()
  @Roles("SCHOOL_ADMIN", "TEACHER")
  create(
    @Body(new ZodPipe(createExamSchema)) dto: z.infer<typeof createExamSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.exams.create(user, dto, ctx(req));
  }

  @Get(":id/results")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "AUDITOR")
  results(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.exams.results(user, id);
  }

  @Put(":id/results")
  @Roles("SCHOOL_ADMIN", "TEACHER")
  upsertResults(
    @Param("id") id: string,
    @Body(new ZodPipe(upsertRowsSchema)) body: z.infer<typeof upsertRowsSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.exams.upsertResults(
      user,
      id,
      body.rows.map((r) => ({ ...r, examId: id })),
      ctx(req),
    );
  }

  @Get(":id/results/:studentId/card")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "AUDITOR")
  async reportCard(
    @Param("id") id: string,
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    res.type("html").send(await this.exams.reportCardHtml(user, id, studentId));
  }
}
