import { describe, it, expect } from "vitest";
import {
  createPaymentSchema,
  bulkAttendanceSchema,
  upsertExamResultSchema,
  createStudentSchema,
  loginSchema,
} from "@manarah/shared";

// عقود النماذج الحرجة — نفس المخططات تحكم الواجهة والسيرفر
describe("critical form schemas", () => {
  describe("سند القبض (createPayment)", () => {
    it("يقبل دفعة صحيحة", () => {
      expect(createPaymentSchema.safeParse({ feeRecordId: "f1", amount: 50000, method: "CASH" }).success).toBe(true);
    });
    it("يرفض مبلغًا غير موجب", () => {
      expect(createPaymentSchema.safeParse({ feeRecordId: "f1", amount: 0, method: "CASH" }).success).toBe(false);
      expect(createPaymentSchema.safeParse({ feeRecordId: "f1", amount: -5, method: "CASH" }).success).toBe(false);
    });
    it("يرفض مبلغًا كسريًا وطريقة دفع غير معروفة", () => {
      expect(createPaymentSchema.safeParse({ feeRecordId: "f1", amount: 12.5, method: "CASH" }).success).toBe(false);
      expect(createPaymentSchema.safeParse({ feeRecordId: "f1", amount: 50000, method: "BITCOIN" }).success).toBe(false);
    });
  });

  describe("التحضير الجماعي (bulkAttendance)", () => {
    it("يقبل تحضيرًا صحيحًا", () => {
      const r = bulkAttendanceSchema.safeParse({
        sectionId: "s1",
        date: "2026-07-03",
        rows: [{ studentId: "st1", mark: "present" }],
      });
      expect(r.success).toBe(true);
    });
    it("يرفض تاريخًا غير صالح وعلامة غير معروفة", () => {
      expect(bulkAttendanceSchema.safeParse({ sectionId: "s1", date: "03-07-2026", rows: [{ studentId: "st1", mark: "present" }] }).success).toBe(false);
      expect(bulkAttendanceSchema.safeParse({ sectionId: "s1", date: "2026-07-03", rows: [{ studentId: "st1", mark: "excused" }] }).success).toBe(false);
    });
    it("يرفض قائمة فارغة", () => {
      expect(bulkAttendanceSchema.safeParse({ sectionId: "s1", date: "2026-07-03", rows: [] }).success).toBe(false);
    });
  });

  describe("إدخال الدرجات (upsertExamResult)", () => {
    it("يقبل درجات ضمن الحدود", () => {
      expect(upsertExamResultSchema.safeParse({ examId: "e1", studentId: "st1", monthly: 20, midterm: 30, finalExam: 50 }).success).toBe(true);
    });
    it("يرفض تجاوز الحد الأقصى لكل مكوّن", () => {
      expect(upsertExamResultSchema.safeParse({ examId: "e1", studentId: "st1", monthly: 21, midterm: 30, finalExam: 50 }).success).toBe(false);
      expect(upsertExamResultSchema.safeParse({ examId: "e1", studentId: "st1", monthly: 20, midterm: 31, finalExam: 50 }).success).toBe(false);
      expect(upsertExamResultSchema.safeParse({ examId: "e1", studentId: "st1", monthly: 20, midterm: 30, finalExam: 51 }).success).toBe(false);
    });
    it("يرفض القيم السالبة", () => {
      expect(upsertExamResultSchema.safeParse({ examId: "e1", studentId: "st1", monthly: -1, midterm: 30, finalExam: 50 }).success).toBe(false);
    });
  });

  describe("تسجيل طالب (createStudent)", () => {
    it("يرفض هاتف ولي أمر غير عراقي", () => {
      const base = { name: "أحمد علي", gender: "MALE" as const, stage: "الرابع علمي", section: "أ", guardianName: "علي" };
      expect(createStudentSchema.safeParse({ ...base, guardianPhone: "0770123" }).success).toBe(false);
      expect(createStudentSchema.safeParse({ ...base, guardianPhone: "07701234567" }).success).toBe(true);
    });
  });

  describe("تسجيل الدخول (login)", () => {
    it("يرفض بريدًا غير صالح وكلمة مرور قصيرة", () => {
      expect(loginSchema.safeParse({ email: "bad", password: "12345678" }).success).toBe(false);
      expect(loginSchema.safeParse({ email: "a@b.io", password: "123" }).success).toBe(false);
      expect(loginSchema.safeParse({ email: "a@b.io", password: "12345678" }).success).toBe(true);
    });
  });
});
