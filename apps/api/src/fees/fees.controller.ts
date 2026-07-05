import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createCheckoutSchema, createPaymentSchema, type CreateCheckoutDto, type CreatePaymentDto } from "@manarah/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { CurrentUser, Public, Roles } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { auditCtx as ctx, type AuthUser } from "../common/types";
import { FeesService } from "./fees.service";
import { renderReceiptHtml } from "../pdf/templates";

/** أصل الخادم من الطلب (لبناء روابط البوابة/الـ callback) */
function origin(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
  return `${proto}://${req.headers.host}`;
}

const callbackSchema = z.object({
  providerRef: z.string().min(1),
  signature: z.string().min(1),
  outcome: z.enum(["paid", "failed"]),
});

const createFeeRecordSchema = z.object({
  studentId: z.string().min(1, "حدّد الطالب"),
  plan: z.string().min(2, "اسم الخطة مطلوب"),
  total: z.number().int().positive("المبلغ يجب أن يكون موجبًا"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ استحقاق غير صالح"),
});

const voidPaymentSchema = z.object({ reason: z.string().min(3, "سبب الإلغاء مطلوب") });

const discountSchema = z.object({
  studentId: z.string().min(1),
  percent: z.number().int().min(1).max(100),
  reason: z.string().min(2, "سبب الخصم مطلوب"),
});

@ApiTags("fees")
@ApiBearerAuth()
@Controller()
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get("fees")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PARENT", "STUDENT", "AUDITOR")
  listRecords(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: string,
    @Query("query") query?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.fees.listRecords(user, {
      status,
      query,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post("fees")
  @Roles("SCHOOL_ADMIN", "ACCOUNTANT")
  createRecord(
    @Body(new ZodPipe(createFeeRecordSchema)) dto: z.infer<typeof createFeeRecordSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.fees.createRecord(user, dto, ctx(req));
  }

  @Get("fees/stats")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "AUDITOR")
  stats(@CurrentUser() user: AuthUser) {
    return this.fees.stats(user);
  }

  @Get("payments")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PARENT", "STUDENT", "AUDITOR")
  listPayments(
    @CurrentUser() user: AuthUser,
    @Query("query") query?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.fees.listPayments(user, {
      query,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post("payments")
  @Roles("SCHOOL_ADMIN", "ACCOUNTANT")
  createPayment(
    @Body(new ZodPipe(createPaymentSchema)) dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.fees.createPayment(user, dto, ctx(req));
  }

  // --------------------------------------------------- الدفع الإلكتروني
  /** بدء دفع إلكتروني — يعيد رابط بوابة الدفع (زين كاش…) */
  @Post("payments/checkout")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PARENT", "STUDENT")
  checkout(
    @Body(new ZodPipe(createCheckoutSchema)) dto: CreateCheckoutDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.fees.createCheckout(user, dto, origin(req), ctx(req));
  }

  /** صفحة بوابة الدفع (محاكاة) — عامة، يفتحها المستخدم من رابط checkout */
  @Public()
  @Get("payments/gateway/:ref")
  async gateway(@Param("ref") ref: string, @Req() req: Request, @Res() res: Response) {
    res.type("html").send(await this.fees.gatewayPage(ref, origin(req)));
  }

  /** callback البوابة — عامة (webhook)، محميّة بتوقيع HMAC، تؤكد وتصدر السند */
  @Public()
  @Post("payments/callback")
  callback(@Body(new ZodPipe(callbackSchema)) body: z.infer<typeof callbackSchema>) {
    return this.fees.confirmCallback(body.providerRef, body.signature, body.outcome);
  }

  @Post("payments/:id/void")
  @Roles("SUPER_ADMIN")
  voidPayment(
    @Param("id") id: string,
    @Body(new ZodPipe(voidPaymentSchema)) body: z.infer<typeof voidPaymentSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.fees.voidPayment(user, id, body.reason, ctx(req));
  }

  /** سند القبض بصيغة قابلة للطباعة (A5، هوية منارة) — window.print() في العميل يخرجه PDF/طابعة */
  @Get("payments/:id/receipt")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PARENT", "STUDENT", "AUDITOR")
  async receipt(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const payment = await this.fees.receiptData(user, id);
    res.type("html").send(renderReceiptHtml(payment));
  }

  @Post("discounts")
  @Roles("SCHOOL_ADMIN", "ACCOUNTANT")
  createDiscount(
    @Body(new ZodPipe(discountSchema)) dto: z.infer<typeof discountSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.fees.createDiscount(user, dto, ctx(req));
  }
}
