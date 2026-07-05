#!/usr/bin/env node
// يولّد عينات HTML ثابتة من قوالب الطباعة الفعلية (بلا اتصال بقاعدة بيانات).
// تشغيل: node docs/print-samples/generate.mjs  → يكتب *.html بجانب هذا الملف.
// هذه العينات مرجعية للمصممين/المراجعين؛ القوالب الحيّة تُخدَم من الـ API.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// يستهلك القوالب المُترجَمة من بناء الـ API (شغّل `pnpm --filter @manarah/api build` أولًا)
const T = require(join(here, "..", "..", "apps", "api", "dist", "pdf", "templates.js"));

const tenant = { name: "ثانوية النور الأهلية", city: "بغداد" };
const student = { name: "محمد علي الساعدي", code: "st1024", section: { stage: "السادس علمي", name: "أ" }, guardianName: "علي حسين الساعدي", enrolledAt: "2020-09-01" };
const long = { ...student, name: "عبد الرحمن عبد الوهاب عبد الكريم الحسيني الموسوي البغدادي" };

const files = {
  // شهادات (3)
  "certificate-completion.html": T.renderCertificateHtml({ kind: "completion", tenant, student, year: "2025-2026", average: 87.5, grade: "جيد جدًا", issuedAt: new Date(), serial: "CRT-NOOR01-ST1024-COMPLETI", verifyCode: "A1B2-C3D4-E5F6" }),
  "certificate-graduation.html": T.renderCertificateHtml({ kind: "graduation", tenant, student, year: "2025-2026", average: 93.2, grade: "امتياز", issuedAt: new Date(), serial: "CRT-NOOR01-ST1024-GRADUATI", verifyCode: "99AA-88BB-77CC" }),
  "certificate-enrollment.html": T.renderCertificateHtml({ kind: "enrollment", tenant, student: long, year: "2025-2026", average: null, grade: null, issuedAt: new Date(), serial: "CRT-NOOR01-ST1024-ENROLLME", verifyCode: "1234-5678-9ABC" }),

  // كشوف/بيانات درجات (3)
  "reportcard.html": T.renderReportCardHtml({ tenantName: tenant.name, examName: "الامتحان النهائي", year: "2025-2026", student, rank: 3, classSize: 28, average: 88, serial: "RPT-NOOR01-ST1024-EX01", verifyCode: "AB12-CD34-EF56", rows: [
    { subject: "الرياضيات", monthly: 18, midterm: 27, finalExam: 45, total: 90, grade: "امتياز" },
    { subject: "الفيزياء", monthly: 16, midterm: 25, finalExam: 42, total: 83, grade: "جيد جدًا" },
    { subject: "الكيمياء", monthly: 17, midterm: 26, finalExam: 40, total: 83, grade: "جيد جدًا" },
  ] }),
  "transcript.html": T.renderTranscriptHtml({ tenant, student, year: "2025-2026", cumulativeAverage: 86.7, resultLabel: "ناجح", serial: "TRN-NOOR01-ST1024-2025", verifyCode: "7788-99AA-BBCC", rows: [
    { subject: "الرياضيات", exam: "نصف السنة", total: 88, grade: "جيد جدًا", date: "2026-01-15" },
    { subject: "الرياضيات", exam: "النهائي", total: 90, grade: "امتياز", date: "2026-05-20" },
    { subject: "الفيزياء", exam: "النهائي", total: 83, grade: "جيد جدًا", date: "2026-05-22" },
    { subject: "اللغة العربية", exam: "النهائي", total: 85, grade: "جيد جدًا", date: "2026-05-24" },
  ] }),
  "transcript-empty.html": T.renderTranscriptHtml({ tenant, student, year: "2026-2027", cumulativeAverage: 0, resultLabel: "غير محدد", serial: "TRN-NOOR01-ST1024-2026", verifyCode: "0000-0000-0000", rows: [] }),

  // إيصالات/فواتير (3)
  "receipt.html": T.renderReceiptHtml({ receiptNo: "RC-2026-1042", amount: 500000, method: "CASH", receivedBy: "حسن الطائي", createdAt: new Date(), student, feeRecord: { plan: "قسط سنوي", total: 2000000, paid: 1500000 }, tenant, verifyCode: "RC12-AB34-CD56" }),
  "receipt-paid.html": T.renderReceiptHtml({ receiptNo: "RC-2026-1043", amount: 500000, method: "TRANSFER", note: "الدفعة الأخيرة", receivedBy: "حسن الطائي", createdAt: new Date(), student, feeRecord: { plan: "قسط سنوي", total: 2000000, paid: 2000000 }, tenant, verifyCode: "RC99-XY88-ZW77" }),
  "statement.html": T.renderStatementHtml({ tenant, student, issuedAt: new Date(), serial: "STM-NOOR01-ST1024-20260705", verifyCode: "ST11-22AA-33BB", feeRecords: [
    { plan: "قسط سنوي", total: 2000000, paid: 1500000, dueDate: "2026-09-01", status: "partial" },
    { plan: "رسوم نقل", total: 300000, paid: 300000, dueDate: "2026-09-01", status: "paid" },
  ], payments: [
    { receiptNo: "RC-2026-1042", amount: 500000, method: "CASH", createdAt: "2026-06-01" },
    { receiptNo: "RC-2026-1011", amount: 1000000, method: "TRANSFER", createdAt: "2026-03-15" },
    { receiptNo: "RC-2026-1005", amount: 300000, method: "CARD", createdAt: "2026-02-10" },
  ] }),
};

for (const [name, html] of Object.entries(files)) {
  writeFileSync(join(here, name), html, "utf8");
  console.log("✓", name);
}
console.log(`\nتم توليد ${Object.keys(files).length} عينة في docs/print-samples/`);
