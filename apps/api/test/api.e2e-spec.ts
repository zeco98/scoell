// ============================================================================
// اختبارات المواصفة السبعة + ترقيم السندات — ضد قاعدة SQLite معزولة
// auth · RBAC guards · tenant isolation · طالب · دفعة · درجة+audit · refresh rotation
// ============================================================================
import { execSync } from "child_process";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as argon2 from "argon2";

// قاعدة الاختبار تُضبط قبل استيراد أي شيء يلمس Prisma
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret-only";
process.env.JWT_EXPIRES_IN = "15m";
process.env.NODE_ENV = "test"; // يعطّل rate limiting داخل الاختبارات

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { PrismaClient } from "@prisma/client";

const PASSWORD = "Test@Manarah2026";

describe("Manarah API (e2e)", () => {
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

  beforeAll(async () => {
    // مخطط نظيف: حذف ملف قاعدة الاختبار ثم push (بلا --force-reset)
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

    // مؤسستان لاختبار العزل
    const tenantA = await prisma.tenant.create({ data: { name: "مدرسة أ", settings: "{}" } });
    const tenantB = await prisma.tenant.create({ data: { name: "مدرسة ب", settings: "{}" } });
    ids.tenantA = tenantA.id;
    ids.tenantB = tenantB.id;

    const mk = (name: string, email: string, role: string, tenantId: string | null) =>
      prisma.user.create({ data: { name, email, role, tenantId, passwordHash: hash } });

    await mk("مدير أ", "admin-a@test.io", "SCHOOL_ADMIN", tenantA.id);
    await mk("محاسب أ", "acc-a@test.io", "ACCOUNTANT", tenantA.id);
    const teacherA = await mk("معلم أ", "teacher-a@test.io", "TEACHER", tenantA.id);
    await mk("معلم آخر أ", "teacher2-a@test.io", "TEACHER", tenantA.id); // معلم لا يملك الشعبة
    await mk("مدير ب", "admin-b@test.io", "SCHOOL_ADMIN", tenantB.id);

    // شعبة المؤسسة أ مملوكة للمعلم أ
    const section = await prisma.section.create({
      data: { tenantId: tenantA.id, stage: "الرابع علمي", name: "أ", teacherId: teacherA.id },
    });
    ids.section = section.id;

    const student = await prisma.student.create({
      data: {
        tenantId: tenantA.id,
        code: "st1000",
        name: "طالب الاختبار الأول",
        gender: "MALE",
        sectionId: section.id,
        guardianName: "ولي الاختبار",
        guardianPhone: "07701234567",
      },
    });
    ids.student = student.id;

    // طالب في المؤسسة ب — لاختبار حقن معرّف أجنبي
    const sectionB = await prisma.section.create({
      data: { tenantId: tenantB.id, stage: "الرابع علمي", name: "أ" },
    });
    const studentB = await prisma.student.create({
      data: {
        tenantId: tenantB.id,
        code: "st2000",
        name: "طالب المؤسسة ب",
        gender: "MALE",
        sectionId: sectionB.id,
        guardianName: "ولي ب",
        guardianPhone: "07709998877",
      },
    });
    ids.studentB = studentB.id;

    const fee = await prisma.feeRecord.create({
      data: { tenantId: tenantA.id, studentId: student.id, plan: "قسط سنوي", total: 1000000, dueDate: "2026-09-01" },
    });
    ids.fee = fee.id;

    const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher-a@test.io" } });
    const exam = await prisma.exam.create({
      data: { tenantId: tenantA.id, name: "امتحان تجريبي", subject: "الرياضيات", sectionId: section.id, year: "2025-2026", createdById: teacher.id },
    });
    ids.exam = exam.id;
    const result = await prisma.examResult.create({
      data: { examId: exam.id, studentId: student.id, monthly: 15, midterm: 25, finalExam: 40, total: 80, grade: "جيد جدًا" },
    });
    ids.result = result.id;

    // تطبيق Nest كامل بنفس guards الإنتاج
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  // 1 — المصادقة
  it("auth: دخول صحيح يصدر tokens، وكلمة مرور خاطئة تُرفض 401", async () => {
    const ok = await login("admin-a@test.io");
    expect(ok.accessToken).toBeTruthy();
    expect(ok.refreshToken).toBeTruthy();
    expect(ok.user.role).toBe("SCHOOL_ADMIN");

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "admin-a@test.io", password: "WrongPass123" })
      .expect(401);
  });

  // 2 — RBAC guards
  it("guards: المعلم ممنوع من إنشاء سند قبض (403)، وبلا token يُرفض (401)", async () => {
    const teacher = await login("teacher-a@test.io");
    await request(app.getHttpServer())
      .post("/api/payments")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({ feeRecordId: ids.fee, amount: 1000, method: "CASH" })
      .expect(403);

    await request(app.getHttpServer()).get("/api/students").expect(401);
  });

  // 3 — عزل المستأجرين (الاختبار الصريح): ب يرى طلابه فقط لا طلاب أ
  it("tenant isolation: مدير المؤسسة ب يرى طلابه فقط ولا يرى طلاب المؤسسة أ", async () => {
    const adminB = await login("admin-b@test.io");
    const res = await request(app.getHttpServer())
      .get("/api/students")
      .set("Authorization", `Bearer ${adminB.accessToken}`)
      .expect(200);
    // يرى طالب مؤسسته فقط، ولا يظهر أي طالب من المؤسسة أ
    const ids_ = (res.body.items as { id: string }[]).map((s) => s.id);
    expect(ids_).toContain(ids.studentB);
    expect(ids_).not.toContain(ids.student);

    // ولا يستطيع فتح ملف طالب المؤسسة أ مباشرة
    await request(app.getHttpServer())
      .get(`/api/students/${ids.student}`)
      .set("Authorization", `Bearer ${adminB.accessToken}`)
      .expect(404);
  });

  // 4 — إنشاء طالب
  it("student: مدير المدرسة ينشئ طالبًا ويظهر في القائمة بقيد تدقيق", async () => {
    const admin = await login("admin-a@test.io");
    const created = await request(app.getHttpServer())
      .post("/api/students")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        name: "طالب جديد للاختبار",
        gender: "FEMALE",
        stage: "الخامس علمي",
        section: "ب",
        guardianName: "ولي أمر جديد",
        guardianPhone: "07709876543",
      })
      .expect(201);
    expect(created.body.code).toMatch(/^st\d+$/);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "Student", entityId: created.body.id },
    });
    expect(audit).toBeTruthy();
  });

  // 5 — الدفعات: ترقيم تسلسلي بلا فراغات
  it("payment: سندان متتاليان يحملان تسلسلًا متصاعدًا بلا فجوة ولا تكرار", async () => {
    const acc = await login("acc-a@test.io");
    const p1 = await request(app.getHttpServer())
      .post("/api/payments")
      .set("Authorization", `Bearer ${acc.accessToken}`)
      .send({ feeRecordId: ids.fee, amount: 100000, method: "CASH" })
      .expect(201);
    const p2 = await request(app.getHttpServer())
      .post("/api/payments")
      .set("Authorization", `Bearer ${acc.accessToken}`)
      .send({ feeRecordId: ids.fee, amount: 200000, method: "TRANSFER" })
      .expect(201);

    expect(p2.body.seq).toBe(p1.body.seq + 1);
    expect(p1.body.receiptNo).not.toBe(p2.body.receiptNo);

    // تحديث رصيد القسط
    const fee = await prisma.feeRecord.findUniqueOrThrow({ where: { id: ids.fee } });
    expect(fee.paid).toBe(300000);

    // المبلغ الأكبر من المتبقي يُرفض
    await request(app.getHttpServer())
      .post("/api/payments")
      .set("Authorization", `Bearer ${acc.accessToken}`)
      .send({ feeRecordId: ids.fee, amount: 99999999, method: "CASH" })
      .expect(400);
  });

  // 6 — الدرجات: كل تعديل بقيمته القديمة والجديدة
  it("grade+audit: تعديل درجة يسجَّل في التدقيق بقيمتي قبل/بعد", async () => {
    const teacher = await login("teacher-a@test.io");
    await request(app.getHttpServer())
      .put(`/api/exams/${ids.exam}/results`)
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({ rows: [{ studentId: ids.student, monthly: 18, midterm: 27, finalExam: 45 }] })
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "ExamResult", severity: "warning" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();
    const before = JSON.parse(audit!.before!);
    const after = JSON.parse(audit!.after!);
    expect(before.total).toBe(80);
    expect(after.total).toBe(90);
  });

  // 7 — تدوير الـ refresh وكشف إعادة الاستخدام
  it("refresh rotation: التجديد يعمل، وإعادة استخدام token قديم تبطل العائلة كلها", async () => {
    const session = await login("admin-a@test.io");

    const r1 = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: session.refreshToken })
      .expect(201);
    expect(r1.body.accessToken).toBeTruthy();
    expect(r1.body.refreshToken).not.toBe(session.refreshToken);

    // إعادة استخدام القديم = هجوم → 401
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    // والعائلة كلها أُبطلت — حتى الجديد لم يعد صالحًا
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: r1.body.refreshToken })
      .expect(401);
  });

  // 8 — قفل الحساب بعد 5 محاولات فاشلة
  it("lockout: خمس محاولات فاشلة تقفل الحساب مؤقتًا (403)", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "acc-a@test.io", password: "Wrong12345" })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "acc-a@test.io", password: PASSWORD })
      .expect(403);
  });

  // 9 — H1: حقن studentId أجنبي في الدرجات مرفوض (400) ولا يُكتب شيء
  it("IDOR grades: إدخال درجة لطالب من مؤسسة أخرى يُرفض", async () => {
    const teacher = await login("teacher-a@test.io");
    await request(app.getHttpServer())
      .put(`/api/exams/${ids.exam}/results`)
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({ rows: [{ studentId: ids.studentB, monthly: 20, midterm: 30, finalExam: 50 }] })
      .expect(400);
    // لم تُنشأ أي نتيجة لطالب المؤسسة ب
    const leaked = await prisma.examResult.findFirst({ where: { studentId: ids.studentB } });
    expect(leaked).toBeNull();
  });

  // 10 — H2: حقن studentId أجنبي في الحضور مرفوض (400)
  it("IDOR attendance: تحضير طالب من مؤسسة أخرى يُرفض", async () => {
    const teacher = await login("teacher-a@test.io");
    await request(app.getHttpServer())
      .post("/api/attendance/bulk")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .send({
        sectionId: ids.section,
        date: new Date().toISOString().slice(0, 10),
        rows: [{ studentId: ids.studentB, mark: "absent" }],
      })
      .expect(400);
    const leaked = await prisma.attendanceRecord.findFirst({ where: { studentId: ids.studentB } });
    expect(leaked).toBeNull();
  });

  // 11 — M1: معلم لا يملك الشعبة ممنوع من تحضيرها (403)
  it("teacher scope: معلم آخر لا يملك الشعبة يُمنع من تحضيرها وعرضها", async () => {
    const other = await login("teacher2-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/attendance/sheet?sectionId=${ids.section}`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/attendance/bulk")
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({
        sectionId: ids.section,
        date: new Date().toISOString().slice(0, 10),
        rows: [{ studentId: ids.student, mark: "present" }],
      })
      .expect(403);
  });

  // 12 — M2: رفع ملف بنوع غير مسموح يُرفض (400)
  it("upload MIME: رفع ملف تنفيذي يُرفض، وPDF يُقبل", async () => {
    const admin = await login("admin-a@test.io");
    await request(app.getHttpServer())
      .post(`/api/students/${ids.student}/documents`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .attach("file", Buffer.from("MZ\x90\x00binary"), { filename: "virus.exe", contentType: "application/x-msdownload" })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/students/${ids.student}/documents`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .attach("file", Buffer.from("%PDF-1.4 fake"), { filename: "id.pdf", contentType: "application/pdf" })
      .expect(201);
  });
});
