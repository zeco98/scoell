/** اختبارات e2e للـ API — قاعدة SQLite معزولة (prisma/test.db) */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testRegex: "\\.e2e-spec\\.ts$",
  testTimeout: 30000,
  maxWorkers: 1, // قاعدة اختبار واحدة — تسلسل إلزامي
};
