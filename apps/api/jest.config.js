/** اختبارات e2e للـ API — قاعدة SQLite معزولة (prisma/test.db) */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  // e2e (قاعدة معزولة) + وحدات منطق نقية (grading.spec.ts) في نفس البوابة
  testRegex: "\\.(e2e-spec|spec)\\.ts$",
  testTimeout: 30000,
  maxWorkers: 1, // قاعدة اختبار واحدة — تسلسل إلزامي
};
