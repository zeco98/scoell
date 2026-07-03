import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * فلتر أخطاء موحّد — كل استجابات الخطأ بنفس الشكل:
 * { statusCode, message, error, path, timestamp }
 * يمنع تسريب رسائل داخلية (5xx تُخفى برسالة عامة)، ويسجّل غير المتوقّع.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "حدث خطأ غير متوقع";
    let error = "InternalServerError";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const b = body as { message?: unknown; error?: unknown };
        message = Array.isArray(b.message)
          ? (b.message as string[]).join(" · ")
          : (b.message as string) ?? message;
        error = (b.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      // خطأ غير متوقّع — لا نكشف تفاصيله للعميل، لكن نسجّله
      this.logger.error(`${req.method} ${req.url} — ${exception.message}`, exception.stack);
    }

    res.status(status).json({
      statusCode: status,
      message,
      error,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
