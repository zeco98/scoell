import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { loginSchema } from "@manarah/shared";
import { z } from "zod";
import { Public, CurrentUser } from "../common/decorators";
import { ZodPipe } from "../common/zod.pipe";
import { auditCtx, type AuthUser, type AuthedRequest } from "../common/types";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE = "manarah_refresh";

const changePasswordSchema = z.object({
  current: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
  next: z
    .string()
    .min(10, "كلمة المرور الجديدة 10 أحرف على الأقل")
    .regex(/[A-Za-z]/, "يجب أن تحوي حروفًا")
    .regex(/\d/, "يجب أن تحوي رقمًا"),
});


function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: Number(process.env.REFRESH_TTL_DAYS ?? 7) * 24 * 60 * 60 * 1000,
  });
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  async login(
    @Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body.email, body.password, auditCtx(req));
    setRefreshCookie(res, result.refreshToken);
    // refreshToken يُعاد في الجسم أيضًا لعملاء desktop/mobile (يخزنونه في الخزنة الآمنة)
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("refresh")
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body?.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? "";
    const result = await this.auth.refresh(token, auditCtx(req));
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Post("logout")
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body?.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return this.auth.logout(token, req.user ?? null, auditCtx(req));
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Post("change-password")
  changePassword(
    @Body(new ZodPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(user, body.current, body.next, auditCtx(req));
  }
}
