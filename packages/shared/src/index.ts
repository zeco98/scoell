// ============================================================================
// @manarah/shared — الأنواع والمخططات المشتركة بين api / web / desktop
// مصدر الحقيقة الوحيد للأدوار والكيانات وDTOs. يُشتق منه مخطط Prisma وواجهات
// الويب؛ أي توسيع للنموذج يبدأ من هنا.
// ============================================================================

import { z } from "zod";

// ============================================================================
// نظام درجات وزارة التربية العراقية — مصدر واحد للحقيقة.
// كان منطق التقديرات مكرَّرًا في ثلاثة مواضع بأرقام سحرية؛ هذا يوحّده ويضيف ما
// يتطلبه السجل المدرسي الرسمي: المعدل العام، التقدير، والنتيجة (ناجح/مكمّل/راسب).
// القاعدة: الدرجة من 100، النجاح 50. الراسب في مادة يكون «مكمّلًا» وله دور ثانٍ؛
// فإن رسب في الدور الثاني (أو تجاوز سقف الإكمال) صار «راسبًا».
// ============================================================================

/** درجة النجاح في المادة الواحدة */
export const PASS_MARK = 50;
/** الدرجة العظمى للمادة */
export const MAX_SUBJECT_MARK = 100;

/** التقديرات الرسمية مرتّبة من الأعلى، كل حد أدنى شامل */
export const GRADE_BANDS = [
  { min: 90, label: "امتياز" },
  { min: 80, label: "جيد جدًا" },
  { min: 70, label: "جيد" },
  { min: 60, label: "متوسط" },
  { min: 50, label: "مقبول" },
  { min: 0, label: "راسب" },
] as const;

export type GradeLabel = (typeof GRADE_BANDS)[number]["label"];

/** التقدير الرسمي لدرجة (0..100) — مصدر واحد يستبدل كل نسخة inline */
export function gradeFor(score: number): GradeLabel {
  for (const band of GRADE_BANDS) {
    if (score >= band.min) return band.label;
  }
  return "راسب";
}

/** هل نجح الطالب في المادة (>= درجة النجاح) */
export function isPass(score: number): boolean {
  return score >= PASS_MARK;
}

/** المعدل العام = مجموع الدرجات ÷ عدد المواد (يُرجِع null إن لا مواد) */
export function generalAverage(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, s) => a + s, 0) / scores.length;
}

/** الدور: الأول (الامتحان النهائي) أو الثاني (امتحان الإكمال) */
export type ExamRound = "first" | "second";

/** النتيجة النهائية للطالب حسب لائحة وزارة التربية */
export type FinalStatus = "ناجح" | "مكمّل" | "راسب" | "غير محدد";

export interface FinalResult {
  status: FinalStatus;
  /** عدد المواد الراسب فيها */
  failedCount: number;
  average: number | null;
  averageGrade: GradeLabel | null;
}

export interface FinalResultOptions {
  /** الدور الحالي — الثاني يحسم الرسوب النهائي (افتراضي: الأول) */
  round?: ExamRound;
  /** أقصى عدد مواد يُسمح بإكمالها؛ تجاوزه = راسب مباشرة (اختياري) */
  maxSupplementary?: number;
}

/**
 * يحسب النتيجة النهائية من درجات مواد الطالب:
 * - كل المواد ناجحة → «ناجح»
 * - رسوب في مادة أو أكثر: تجاوز سقف الإكمال → «راسب»؛ الدور الثاني → «راسب»؛
 *   غير ذلك → «مكمّل» (له دور ثانٍ).
 */
export function finalResult(scores: number[], opts: FinalResultOptions = {}): FinalResult {
  const average = generalAverage(scores);
  const averageGrade = average == null ? null : gradeFor(average);
  if (scores.length === 0) {
    return { status: "غير محدد", failedCount: 0, average, averageGrade };
  }
  const failedCount = scores.filter((s) => s < PASS_MARK).length;
  let status: FinalStatus;
  if (failedCount === 0) {
    status = "ناجح";
  } else if (opts.maxSupplementary != null && failedCount > opts.maxSupplementary) {
    status = "راسب";
  } else if (opts.round === "second") {
    status = "راسب";
  } else {
    status = "مكمّل";
  }
  return { status, failedCount, average, averageGrade };
}

// ---------------------------------------------------------------------------
// الأدوار — التسعة كاملة (المواصفة القسم 1)
// ---------------------------------------------------------------------------
export const ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "ACCOUNTANT",
  "TEACHER",
  "PARENT",
  "STUDENT",
  "DRIVER",
  "HR",
  "AUDITOR",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "المدير العام",
  SCHOOL_ADMIN: "مدير المدرسة",
  ACCOUNTANT: "المحاسب",
  TEACHER: "المعلّم",
  PARENT: "وليّ الأمر",
  STUDENT: "الطالب",
  DRIVER: "السائق",
  HR: "الموارد البشرية",
  AUDITOR: "المدقّق",
};

// ---------------------------------------------------------------------------
// حالات الكيانات
// ---------------------------------------------------------------------------
export const STUDENT_STATUSES = ["active", "suspended", "graduated", "withdrawn"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const ADMISSION_STAGES = ["new", "reviewing", "interview", "accepted", "rejected"] as const;
export type AdmissionStage = (typeof ADMISSION_STAGES)[number];

export const ATTENDANCE_MARKS = ["present", "absent", "late", "early"] as const;
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export const FEE_STATUSES = ["paid", "partial", "overdue"] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "ONLINE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "نقدًا",
  TRANSFER: "تحويل",
  CARD: "بطاقة",
  ONLINE: "دفع إلكتروني",
};

// مزوّدو الدفع الإلكتروني العراقيون (المحافظ)
export const PAYMENT_GATEWAYS = ["zaincash", "asiahawala", "fastpay", "qi"] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  zaincash: "زين كاش",
  asiahawala: "آسيا حوالة",
  fastpay: "فاست باي",
  qi: "Qi",
};

// قنوات الدفع الإلكتروني DTO
export const createCheckoutSchema = z.object({
  feeRecordId: z.string().min(1, "حدّد القسط"),
  amount: z.number().int().positive("المبلغ يجب أن يكون موجبًا"),
  gateway: z.enum(PAYMENT_GATEWAYS, { message: "حدّد بوابة الدفع" }).default("zaincash"),
});
export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;

export const MESSAGE_STATUSES = ["sent", "scheduled", "draft", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_CHANNELS = ["IN_APP", "SMS", "WHATSAPP"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const AUDIT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const TENANT_PLANS = ["Basic", "Pro", "Enterprise"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export const TENANT_STATUSES = ["active", "trial", "suspended"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const AI_REQUEST_STATUSES = ["draft", "approved", "rejected"] as const;
export type AiRequestStatus = (typeof AI_REQUEST_STATUSES)[number];

// ---------------------------------------------------------------------------
// مخططات zod للـ DTOs (تُستخدم في السيرفر للتحقق وفي الويب للنماذج)
// رسائل الخطأ عربية لأنها تصل للمستخدم النهائي.
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const createStudentSchema = z.object({
  name: z.string().min(3, "الاسم الثلاثي مطلوب"),
  gender: z.enum(["MALE", "FEMALE"], { message: "حدّد الجنس" }),
  birthDate: z.string().optional(),
  stage: z.string().min(1, "المرحلة مطلوبة"),
  section: z.string().min(1, "الشعبة مطلوبة"),
  guardianName: z.string().min(3, "اسم ولي الأمر مطلوب"),
  guardianPhone: z
    .string()
    .regex(/^07\d{9}$/, "رقم هاتف عراقي صالح مطلوب (07XXXXXXXXX)"),
  guardianEmail: z.string().email("بريد غير صالح").optional().or(z.literal("")),
  healthNotes: z.string().optional(),
  address: z.string().optional(),
});
export type CreateStudentDto = z.infer<typeof createStudentSchema>;

export const createPaymentSchema = z.object({
  feeRecordId: z.string().min(1, "حدّد القسط"),
  amount: z.number({ message: "المبلغ مطلوب" }).int().positive("المبلغ يجب أن يكون موجبًا"),
  method: z.enum(PAYMENT_METHODS, { message: "حدّد طريقة الدفع" }),
  note: z.string().optional(),
});
export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;

export const createAdmissionSchema = z.object({
  applicantName: z.string().min(3, "اسم المتقدّم مطلوب"),
  stageApplied: z.string().min(1, "المرحلة المطلوبة إلزامية"),
  guardianName: z.string().min(3, "اسم ولي الأمر مطلوب"),
  guardianPhone: z.string().regex(/^07\d{9}$/, "رقم هاتف عراقي صالح مطلوب"),
  notes: z.string().optional(),
});
export type CreateAdmissionDto = z.infer<typeof createAdmissionSchema>;

export const bulkAttendanceSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  rows: z
    .array(
      z.object({
        studentId: z.string().min(1),
        mark: z.enum(ATTENDANCE_MARKS),
        note: z.string().optional(),
      }),
    )
    .min(1, "لا توجد سجلات للحفظ"),
});
export type BulkAttendanceDto = z.infer<typeof bulkAttendanceSchema>;

export const upsertExamResultSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  monthly: z.number().min(0).max(20, "الشهري من 20"),
  midterm: z.number().min(0).max(30, "نصف السنة من 30"),
  finalExam: z.number().min(0).max(50, "النهائي من 50"),
});
export type UpsertExamResultDto = z.infer<typeof upsertExamResultSchema>;

export const createMessageSchema = z.object({
  title: z.string().min(3, "عنوان الرسالة مطلوب"),
  body: z.string().min(1, "نص الرسالة مطلوب"),
  channel: z.enum(MESSAGE_CHANNELS, { message: "حدّد القناة" }),
  audience: z.object({
    kind: z.enum(["ALL_PARENTS", "SECTION", "INDIVIDUALS", "TEACHERS", "STUDENTS", "ABSENTEES"]),
    sectionId: z.string().optional(),
    userIds: z.array(z.string()).optional(),
  }),
  scheduledAt: z.string().optional(),
});
export type CreateMessageDto = z.infer<typeof createMessageSchema>;

// ---------------------------------------------------------------------------
// أشكال الاستجابات المشتركة
// ---------------------------------------------------------------------------
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// مساعدات التنسيق (مشتركة بين المنصات)
// ---------------------------------------------------------------------------
export function formatIQD(n: number, numerals: "western" | "eastern" = "western"): string {
  const locale = numerals === "eastern" ? "ar-IQ" : "ar-IQ-u-nu-latn";
  return new Intl.NumberFormat(locale).format(n) + " د.ع";
}

export function formatNum(n: number, numerals: "western" | "eastern" = "western"): string {
  const locale = numerals === "eastern" ? "ar-IQ" : "ar-IQ-u-nu-latn";
  return new Intl.NumberFormat(locale).format(n);
}
