// ============================================================================
// الموجة الثانية: حصرية الأدوار (تحضير/امتحانات/مالية) · تحضير بأثر رجعي للمعلم
// · سير عمل اعتماد إلغاء السندات (طلب/اعتماد/رفض) بعزل مؤسسات — ضد SQLite معزولة
// ============================================================================
import { execSync } from "child_process";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as argon2 from "argon2";

process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret-only";
process.env.JWT_EXPIRES_IN = "15m";
process.env.NODE_ENV = "test";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { PrismaClient } from "@prisma/client";

const PASSWORD = "Test@Manarah2026";

describe("Manarah API — الموجة الثانية (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const ids = {} as Record<string, string>;

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: PASSWORD })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string; user: { role: string } };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    const { rmSync } = await import("fs");
    const { join } = await import("path");
    for (const f of ["test.db", "test.db-journal"]) {
      rmSync(join(__dirname, "..", "..", "..", "prisma", f), { force: true });
    }
    execSync("pnpm exec prisma db push --skip-generate", {
      cwd: __dirname + "/..",
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
      stdio: "ignore",
    });

    prisma = new PrismaClient();
    const hash = await argon2.hash(PASSWORD);

    const tenantA = await prisma.tenant.create({ data: { name: "مدرسة أ", settings: "{}" } });
    const tenantB = await prisma.tenant.create({ data: { name: "مدرسة ب", settings: "{}" } });
    ids.tenantA = tenantA.id;
    ids.tenantB = tenantB.id;

    const mk = (name: string, email: string, role: string, tenantId: string | null) =>
      prisma.user.create({ data: { name, email, role, tenantId, passwordHash: hash } });

    await mk("مدير أ", "admin2-a@test.io", "SCHOOL_ADMIN", tenantA.id);
    await mk("محاسب أ", "acc2-a@test.io", "ACCOUNTANT", tenantA.id);
    const teacherA = await mk("معلم أ", "teacher2-a2@test.io", "TEACHER", tenantA.id);
    await mk("معلم آخر أ", "teacher2-other-a@test.io", "TEACHER", tenantA.id); // لا يملك أي شعبة

    await mk("مدير ب", "admin2-b@test.io", "SCHOOL_ADMIN", tenantB.id);
    await mk("محاسب ب", "acc2-b@test.io", "ACCOUNTANT", tenantB.id);
    await mk("مدير المنصة", "super2@test.io", "SUPER_ADMIN", null);

    const sectionA = await prisma.section.create({
      data: { tenantId: tenantA.id, stage: "الثالث متوسط", name: "أ", teacherId: teacherA.id },
    });
    ids.sectionA = sectionA.id;

    const sectionB = await prisma.section.create({
      data: { tenantId: tenantB.id, stage: "الثالث متوسط", name: "أ" },
    });
    ids.sectionB = sectionB.id;

    const studentA1 = await prisma.student.create({
      data: {
        tenantId: tenantA.id,
        code: "sw1000",
        name: "طالب الموجة الثانية",
        gender: "MALE",
        sectionId: sectionA.id,
        guardianName: "ولي الأمر",
        guardianPhone: "07701112223",
      },
    });
    ids.studentA1 = studentA1.id;

    const feeA = await prisma.feeRecord.create({
      data: { tenantId: tenantA.id, studentId: studentA1.id, plan: "قسط سنوي", total: 1000000, dueDate: "2026-09-01" },
    });
    ids.feeA = feeA.id;

    const { AppModule } = await import("../src/app.module");
    const { AllExceptionsFilter } = await import("../src/common/http-exception.filter");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  // ==========================================================================
  // 1 — حصرية الأدوار: الحضور
  // ==========================================================================
  describe("حصرية الأدوار: الحضور", () => {
    it("المعلم يحضّر شعبته بنجاح", async () => {
      const teacher = await login("teacher2-a2@test.io");
      const res = await request(app.getHttpServer())
        .post("/api/attendance/bulk")
        .set(auth(teacher.accessToken))
        .send({
          sectionId: ids.sectionA,
          date: new Date().toISOString().slice(0, 10),
          rows: [{ studentId: ids.studentA1, mark: "present" }],
        })
        .expect(201);
      expect(res.body.ok).toBe(true);
    });

    it("مدير المدرسة لم يعد يملك صلاحية تحضير مباشر — 403", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .post("/api/attendance/bulk")
        .set(auth(admin.accessToken))
        .send({
          sectionId: ids.sectionA,
          date: new Date().toISOString().slice(0, 10),
          rows: [{ studentId: ids.studentA1, mark: "present" }],
        })
        .expect(403);
    });

    it("معلم لا يملك الشعبة يُمنع من تحضيرها (403)", async () => {
      const other = await login("teacher2-other-a@test.io");
      await request(app.getHttpServer())
        .post("/api/attendance/bulk")
        .set(auth(other.accessToken))
        .send({
          sectionId: ids.sectionA,
          date: new Date().toISOString().slice(0, 10),
          rows: [{ studentId: ids.studentA1, mark: "present" }],
        })
        .expect(403);
    });

    it("معلم يحاول تحضير شعبة مؤسسة أخرى (تخمين معرّف) → لا يجد الشعبة (400)", async () => {
      const teacher = await login("teacher2-a2@test.io");
      await request(app.getHttpServer())
        .post("/api/attendance/bulk")
        .set(auth(teacher.accessToken))
        .send({
          sectionId: ids.sectionB,
          date: new Date().toISOString().slice(0, 10),
          rows: [{ studentId: ids.studentA1, mark: "present" }],
        })
        .expect(400);
    });

    it("مدير المدرسة ما زال يقرأ ورقة الحضور بنجاح", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .get(`/api/attendance/sheet?sectionId=${ids.sectionA}`)
        .set(auth(admin.accessToken))
        .expect(200);
    });

    // تحضير بأثر رجعي: المعلم يحفظ ليوم ماضٍ على شعبته ويُحفظ فعليًا
    it("المعلم يحفظ تحضيرًا بأثر رجعي (تاريخ ماضٍ) لشعبته وتُحفظ السجلات فعليًا", async () => {
      const teacher = await login("teacher2-a2@test.io");
      const pastDate = "2026-01-15";
      const res = await request(app.getHttpServer())
        .post("/api/attendance/bulk")
        .set(auth(teacher.accessToken))
        .send({
          sectionId: ids.sectionA,
          date: pastDate,
          rows: [{ studentId: ids.studentA1, mark: "absent" }],
        })
        .expect(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.saved).toBe(1);

      const record = await prisma.attendanceRecord.findUnique({
        where: { studentId_date: { studentId: ids.studentA1, date: pastDate } },
      });
      expect(record).toBeTruthy();
      expect(record?.mark).toBe("absent");
      expect(record?.sectionId).toBe(ids.sectionA);
    });
  });

  // ==========================================================================
  // 2 — حصرية الأدوار: الامتحانات
  // ==========================================================================
  describe("حصرية الأدوار: الامتحانات", () => {
    it("المعلم ينشئ امتحانًا ويرصد نتائجه بنجاح", async () => {
      const teacher = await login("teacher2-a2@test.io");
      const exam = await request(app.getHttpServer())
        .post("/api/exams")
        .set(auth(teacher.accessToken))
        .send({ name: "امتحان الموجة الثانية", subject: "العلوم", sectionId: ids.sectionA, year: "2025-2026" })
        .expect(201);
      ids.examA = exam.body.id;

      await request(app.getHttpServer())
        .put(`/api/exams/${ids.examA}/results`)
        .set(auth(teacher.accessToken))
        .send({ rows: [{ studentId: ids.studentA1, monthly: 15, midterm: 25, finalExam: 40 }] })
        .expect(200);
    });

    it("مدير المدرسة يُمنع من إنشاء امتحان ورصد نتائجه (403)", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .post("/api/exams")
        .set(auth(admin.accessToken))
        .send({ name: "محاولة مدير", subject: "الرياضيات", sectionId: ids.sectionA, year: "2025-2026" })
        .expect(403);

      await request(app.getHttpServer())
        .put(`/api/exams/${ids.examA}/results`)
        .set(auth(admin.accessToken))
        .send({ rows: [{ studentId: ids.studentA1, monthly: 20, midterm: 30, finalExam: 50 }] })
        .expect(403);
    });

    it("مدير المدرسة ما زال يقرأ نتائج الامتحان بنجاح", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .get(`/api/exams/${ids.examA}/results`)
        .set(auth(admin.accessToken))
        .expect(200);
    });
  });

  // ==========================================================================
  // 3 — حصرية الأدوار: المالية (أقساط/سندات/خصومات)
  // ==========================================================================
  describe("حصرية الأدوار: المالية", () => {
    it("المحاسب ينشئ قسطًا وسندًا وخصمًا بنجاح", async () => {
      const acc = await login("acc2-a@test.io");
      await request(app.getHttpServer())
        .post("/api/fees")
        .set(auth(acc.accessToken))
        .send({ studentId: ids.studentA1, plan: "قسط إضافي", total: 200000, dueDate: "2026-11-01" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/payments")
        .set(auth(acc.accessToken))
        .send({ feeRecordId: ids.feeA, amount: 100000, method: "CASH" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/discounts")
        .set(auth(acc.accessToken))
        .send({ studentId: ids.studentA1, percent: 10, reason: "منحة اختبار" })
        .expect(201);
    });

    it("مدير المدرسة يُمنع من إنشاء قسط/سند/خصم (403)", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .post("/api/fees")
        .set(auth(admin.accessToken))
        .send({ studentId: ids.studentA1, plan: "محاولة مدير", total: 100000, dueDate: "2026-11-01" })
        .expect(403);

      await request(app.getHttpServer())
        .post("/api/payments")
        .set(auth(admin.accessToken))
        .send({ feeRecordId: ids.feeA, amount: 10000, method: "CASH" })
        .expect(403);

      await request(app.getHttpServer())
        .post("/api/discounts")
        .set(auth(admin.accessToken))
        .send({ studentId: ids.studentA1, percent: 5, reason: "محاولة مدير" })
        .expect(403);
    });

    it("مدير المدرسة ما زال يقرأ الأقساط والسندات", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer()).get("/api/fees").set(auth(admin.accessToken)).expect(200);
      await request(app.getHttpServer()).get("/api/payments").set(auth(admin.accessToken)).expect(200);
    });
  });

  // ==========================================================================
  // 4 — سير عمل اعتماد إلغاء السندات
  // ==========================================================================
  describe("سير عمل اعتماد إلغاء السندات (void request/approve/reject)", () => {
    let paymentId: string;

    beforeAll(async () => {
      const acc = await login("acc2-a@test.io");
      const p = await request(app.getHttpServer())
        .post("/api/payments")
        .set(auth(acc.accessToken))
        .send({ feeRecordId: ids.feeA, amount: 50000, method: "CASH" })
        .expect(201);
      paymentId = p.body.id;
    });

    it("المحاسب يطلب إلغاء السند: يتحول إلى PENDING ويعيد receiptNo (حارس انحدار تنبيه الواجهة)", async () => {
      const acc = await login("acc2-a@test.io");
      const res = await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-request`)
        .set(auth(acc.accessToken))
        .send({ reason: "خطأ في الإدخال" })
        .expect(201);
      expect(res.body.voidStatus).toBe("PENDING");
      expect(res.body.receiptNo).toBeTruthy();
      expect(typeof res.body.receiptNo).toBe("string");
    });

    it("المحاسب لا يستطيع اعتماد الإلغاء (403)، ومدير المدرسة لا يستطيع طلب الإلغاء (403)", async () => {
      const acc = await login("acc2-a@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-approve`)
        .set(auth(acc.accessToken))
        .expect(403);

      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-request`)
        .set(auth(admin.accessToken))
        .send({ reason: "محاولة مدير" })
        .expect(403);
    });

    it("طلب إلغاء ثانٍ بينما الحالة PENDING بالفعل → 400", async () => {
      const acc = await login("acc2-a@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-request`)
        .set(auth(acc.accessToken))
        .send({ reason: "طلب مكرر" })
        .expect(400);
    });

    it("مدير المدرسة يرفض طلب الإلغاء: الحالة تعود إلى NONE بلا تنفيذ فعلي", async () => {
      const admin = await login("admin2-a@test.io");
      const res = await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-reject`)
        .set(auth(admin.accessToken))
        .expect(201);
      expect(res.body.voidStatus).toBe("NONE");

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.voidedAt).toBeNull();
      expect(payment.voidStatus).toBe("NONE");
    });

    it("اعتماد إلغاء حين لا يوجد طلب معلَّق (الحالة NONE) → 400", async () => {
      const admin = await login("admin2-a@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-approve`)
        .set(auth(admin.accessToken))
        .expect(400);
    });

    it("طلب ثانٍ ثم اعتماد: يُلغي السند فعليًا (VOIDED) ويعدّل رصيد القسط مرة واحدة فقط", async () => {
      const acc = await login("acc2-a@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-request`)
        .set(auth(acc.accessToken))
        .send({ reason: "طلب إلغاء نهائي" })
        .expect(201);

      const feeBefore = await prisma.feeRecord.findUniqueOrThrow({ where: { id: ids.feeA } });

      const admin = await login("admin2-a@test.io");
      const approved = await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-approve`)
        .set(auth(admin.accessToken))
        .expect(201);
      expect(approved.body.voidStatus).toBe("VOIDED");

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.voidedAt).toBeTruthy();
      expect(payment.voidStatus).toBe("VOIDED");

      // أثر الإلغاء طُبِّق مرة واحدة فقط: الرصيد نقص بمقدار السند بالضبط
      const feeAfter = await prisma.feeRecord.findUniqueOrThrow({ where: { id: ids.feeA } });
      expect(feeAfter.paid).toBe(feeBefore.paid - payment.amount);

      // اعتماد ثانٍ على سند ملغى بالفعل (لم يعد PENDING) → 400، ولا أثر مضاعف
      await request(app.getHttpServer())
        .post(`/api/payments/${paymentId}/void-approve`)
        .set(auth(admin.accessToken))
        .expect(400);
      const feeAfterSecondAttempt = await prisma.feeRecord.findUniqueOrThrow({ where: { id: ids.feeA } });
      expect(feeAfterSecondAttempt.paid).toBe(feeAfter.paid);
    });

    it("عزل المؤسسات: محاسب/مدير مؤسسة ب يُمنعان من طلب/اعتماد إلغاء سند مؤسسة أ (404/403)", async () => {
      // سند جديد لهذا الاختبار (السابق أصبح ملغى بالفعل)
      const accA = await login("acc2-a@test.io");
      const p = await request(app.getHttpServer())
        .post("/api/payments")
        .set(auth(accA.accessToken))
        .send({ feeRecordId: ids.feeA, amount: 20000, method: "CASH" })
        .expect(201);
      const crossId = p.body.id;

      const accB = await login("acc2-b@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${crossId}/void-request`)
        .set(auth(accB.accessToken))
        .send({ reason: "محاولة عبر مؤسسة أخرى" })
        .expect(404);

      // نضع السند بحالة PENDING فعليًا من مؤسسته الصحيحة، ثم نتحقق من منع مدير ب من الاعتماد
      await request(app.getHttpServer())
        .post(`/api/payments/${crossId}/void-request`)
        .set(auth(accA.accessToken))
        .send({ reason: "طلب صحيح من مؤسسة أ" })
        .expect(201);

      const adminB = await login("admin2-b@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${crossId}/void-approve`)
        .set(auth(adminB.accessToken))
        .expect(404);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: crossId } });
      expect(payment.voidStatus).toBe("PENDING"); // لم يتأثر بمحاولة مؤسسة ب
    });

    it("SUPER_ADMIN: الإلغاء المباشر (void) ما زال يعمل بلا حاجة لسير الطلب/الاعتماد", async () => {
      const acc = await login("acc2-a@test.io");
      const p = await request(app.getHttpServer())
        .post("/api/payments")
        .set(auth(acc.accessToken))
        .send({ feeRecordId: ids.feeA, amount: 15000, method: "CASH" })
        .expect(201);

      const superAdmin = await login("super2@test.io");
      await request(app.getHttpServer())
        .post(`/api/payments/${p.body.id}/void`)
        .set(auth(superAdmin.accessToken))
        .send({ reason: "إلغاء مباشر من المنصة" })
        .expect(201);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: p.body.id } });
      expect(payment.voidedAt).toBeTruthy();
      expect(payment.voidStatus).toBe("VOIDED");
    });
  });
});
