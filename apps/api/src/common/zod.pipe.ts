import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/** تحقق موحّد: نفس مخططات zod المستخدمة في نماذج الويب تحكم السيرفر */
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) =>
        i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
      );
      throw new BadRequestException({ message: messages.join(" · "), errors: messages });
    }
    return parsed.data;
  }
}
