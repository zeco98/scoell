import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser, Public, Roles } from "../common/decorators";
import type { AuthUser } from "../common/types";
import { DocumentsService } from "./documents.service";

const CERT_KINDS = ["completion", "graduation", "enrollment"] as const;
type CertKind = (typeof CERT_KINDS)[number];

@ApiTags("documents")
@ApiBearerAuth()
@Controller("documents")
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  /** شهادة رسمية (A4 عرضية) — إصدار إداري؛ ولي الأمر/الطالب يعرضان وثيقتهما */
  @Get("students/:id/certificate")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "PARENT", "STUDENT", "AUDITOR")
  async certificate(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query("year") year = String(new Date().getFullYear()),
    @Query("kind") kind: CertKind = "completion",
  ) {
    const k = CERT_KINDS.includes(kind) ? kind : "completion";
    res.type("html").send(await this.docs.certificate(user, id, k, year));
  }

  /** بيان درجات تفصيلي (A4) — كل امتحانات العام مجمّعة */
  @Get("students/:id/transcript")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "AUDITOR")
  async transcript(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query("year") year = "2025-2026",
  ) {
    res.type("html").send(await this.docs.transcript(user, id, year));
  }

  /** كشف حساب مالي (A4) — الأقساط والدفعات مع الرصيد */
  @Get("students/:id/statement")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PARENT", "STUDENT", "AUDITOR")
  async statement(@Param("id") id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    res.type("html").send(await this.docs.statement(user, id));
  }

  /**
   * بوابة تحقق عامة (بلا مصادقة) — للتحقق من صحة وثيقة عبر رقمها التسلسلي ورمزها.
   * تعيد ملخصًا غير حسّاس فقط (نوع/تاريخ/أول حرف) — لا PII ولا درجات.
   */
  @Public()
  @Get("verify/:serial")
  verify(@Param("serial") serial: string, @Query("code") code = "") {
    return this.docs.verify(serial, code);
  }
}
