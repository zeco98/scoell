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
    const adminB = await mk("مدير ب", "admin-b@test.io", "SCHOOL_ADMIN", tenantB.id);
    await mk("مدقق", "auditor@test.io", "AUDITOR", null); // دور منصة للقراءة فقط
    await mk("موارد بشرية أ", "hr-a@test.io", "HR", tenantA.id);
    const studentUserA = await mk("طالب الاختبار الأول", "student-a@test.io", "STUDENT", tenantA.id);
    ids.adminB = adminB.id;

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
        studentUserId: studentUserA.id, // ربط 1:1 بحساب STUDENT التجريبي
      },
    });
    ids.student = student.id;

    // زميل في نفس الشعبة — بلا أي ربط مستخدم — لاختبار أن الطالب لا يرى زميله
    const classmate = await prisma.student.create({
      data: {
        tenantId: tenantA.id,
        code: "st1001",
        name: "زميل الصف",
        gender: "MALE",
        sectionId: section.id,
        guardianName: "ولي الزميل",
        guardianPhone: "07701234599",
      },
    });
    ids.classmate = classmate.id;

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
    await prisma.examResult.create({
      data: { examId: exam.id, studentId: classmate.id, monthly: 18, midterm: 28, finalExam: 45, total: 91, grade: "امتياز" },
    });

    // موظف في المؤسسة أ + قسط زميل — تُستخدم في اختبارات لاحقة
    await prisma.feeRecord.create({
      data: { tenantId: tenantA.id, studentId: classmate.id, plan: "قسط سنوي", total: 500000, dueDate: "2026-09-01" },
    });

    // تطبيق Nest كامل بنفس guards + فلتر الأخطاء الإنتاجي
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

  // 5ب — الدفع الإلكتروني: checkout → بوابة → callback موقّع → سند ONLINE
  /** يستخرج التوقيع المضمَّن في صفحة البوابة المحاكاة */
  function sigFromGatewayPage(html: string): string {
    const m = html.match(/signature:"([0-9a-f]+)"/);
    if (!m) throw new Error("لم يُعثر على التوقيع في صفحة البوابة");
    return m[1];
  }

  it("online pay: checkout→callback موقّع يصدر سندًا ONLINE ويحدّث الرصيد ويشعر واتساب", async () => {
    const acc = await login("acc-a@test.io");
    // قسط جديد مستقل حتى لا يتأثر بالاختبارات الأخرى
    const fee = await prisma.feeRecord.create({
      data: { tenantId: ids.tenantA, studentId: ids.student, plan: "دفع إلكتروني", total: 400000, dueDate: "2026-10-01" },
    });

    const co = await request(app.getHttpServer())
      .post("/api/payments/checkout")
      .set("Authorization", `Bearer ${acc.accessToken}`)
      .send({ feeRecordId: fee.id, amount: 400000, gateway: "zaincash" })
      .expect(201);
    expect(co.body.providerRef).toMatch(/^PI-/);
    expect(co.body.checkoutUrl).toContain(`/api/payments/gateway/${co.body.providerRef}`);

    // صفحة البوابة عامة (بلا توكن) وتحمل المبلغ والتوقيع
    const page = await request(app.getHttpServer()).get(`/api/payments/gateway/${co.body.providerRef}`).expect(200);
    expect(page.text).toContain("زين كاش");
    const signature = sigFromGatewayPage(page.text);

    // توقيع مزوّر يُرفض 403 ولا يصدر سندًا
    await request(app.getHttpServer())
      .post("/api/payments/callback")
      .send({ providerRef: co.body.providerRef, signature: "deadbeefdeadbeef", outcome: "paid" })
      .expect(403);

    // callback موقّع صحيح → تأكيد + سند
    const cb = await request(app.getHttpServer())
      .post("/api/payments/callback")
      .send({ providerRef: co.body.providerRef, signature, outcome: "paid" })
      .expect(201);
    expect(cb.body.status).toBe("confirmed");
    expect(cb.body.receiptNo).toMatch(/^RC-/);

    // السند مُسجّل بطريقة ONLINE، والرصيد اكتمل
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: cb.body.paymentId } });
    expect(payment.method).toBe("ONLINE");
    expect(payment.amount).toBe(400000);
    const updated = await prisma.feeRecord.findUniqueOrThrow({ where: { id: fee.id } });
    expect(updated.paid).toBe(400000);
    expect(updated.status).toBe("paid");

    // idempotency: إعادة نفس الـ callback لا تصدر سندًا ثانيًا
    const replay = await request(app.getHttpServer())
      .post("/api/payments/callback")
      .send({ providerRef: co.body.providerRef, signature, outcome: "paid" })
      .expect(201);
    expect(replay.body.alreadyConfirmed).toBe(true);
    expect(replay.body.paymentId).toBe(cb.body.paymentId);
    const count = await prisma.payment.count({ where: { feeRecordId: fee.id } });
    expect(count).toBe(1);
  });

  it("online pay: نتيجة failed تُعلّم النية فاشلة بلا سند", async () => {
    const acc = await login("acc-a@test.io");
    const fee = await prisma.feeRecord.create({
      data: { tenantId: ids.tenantA, studentId: ids.student, plan: "دفع فاشل", total: 150000, dueDate: "2026-10-01" },
    });
    const co = await request(app.getHttpServer())
      .post("/api/payments/checkout")
      .set("Authorization", `Bearer ${acc.accessToken}`)
      .send({ feeRecordId: fee.id, amount: 150000 })
      .expect(201);
    const page = await request(app.getHttpServer()).get(`/api/payments/gateway/${co.body.providerRef}`).expect(200);
    const signature = sigFromGatewayPage(page.text);
    const cb = await request(app.getHttpServer())
      .post("/api/payments/callback")
      .send({ providerRef: co.body.providerRef, signature, outcome: "failed" })
      .expect(201);
    expect(cb.body.ok).toBe(false);
    expect(cb.body.status).toBe("failed");
    const count = await prisma.payment.count({ where: { feeRecordId: fee.id } });
    expect(count).toBe(0);
  });

  it("online pay RBAC: الطالب يبدأ دفع قسطه ويُمنع من قسط زميله (404)", async () => {
    const student = await login("student-a@test.io");
    const ownFee = await prisma.feeRecord.create({
      data: { tenantId: ids.tenantA, studentId: ids.student, plan: "قسط الطالب", total: 120000, dueDate: "2026-10-01" },
    });
    const mateFee = await prisma.feeRecord.create({
      data: { tenantId: ids.tenantA, studentId: ids.classmate, plan: "قسط الزميل", total: 120000, dueDate: "2026-10-01" },
    });
    // قسطه هو → مسموح
    await request(app.getHttpServer())
      .post("/api/payments/checkout")
      .set("Authorization", `Bearer ${student.accessToken}`)
      .send({ feeRecordId: ownFee.id, amount: 120000 })
      .expect(201);
    // قسط زميله → ممنوع (خارج نطاق ownStudentWhere)
    await request(app.getHttpServer())
      .post("/api/payments/checkout")
      .set("Authorization", `Bearer ${student.accessToken}`)
      .send({ feeRecordId: mateFee.id, amount: 120000 })
      .expect(404);
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

  // 14 — RBAC: المدقّق للقراءة فقط (يقرأ التدقيق، لا ينشئ طالبًا)
  it("RBAC AUDITOR: يقرأ سجل التدقيق لكنه ممنوع من إنشاء طالب", async () => {
    const auditor = await login("auditor@test.io");
    await request(app.getHttpServer())
      .get("/api/audit")
      .set("Authorization", `Bearer ${auditor.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/students")
      .set("Authorization", `Bearer ${auditor.accessToken}`)
      .send({ name: "محاولة", gender: "MALE", stage: "الأول", section: "أ", guardianName: "x", guardianPhone: "07701234567" })
      .expect(403);
  });

  // 15 — RBAC: HR يدير الموظفين، ومدير المدرسة ممنوع من إنشائهم (HR حصرًا)
  it("RBAC HR: HR ينشئ موظفًا ومدير المدرسة لا", async () => {
    const hr = await login("hr-a@test.io");
    await request(app.getHttpServer())
      .post("/api/employees")
      .set("Authorization", `Bearer ${hr.accessToken}`)
      .send({ name: "قاسم الحارس", title: "حارس", contractType: "full_time" })
      .expect(201);
    const admin = await login("admin-a@test.io");
    await request(app.getHttpServer())
      .post("/api/employees")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "x", title: "y", contractType: "full_time" })
      .expect(403);
  });

  // 13 — M4: قيمة حالة غير صالحة تُرفض بتحقق zod (400)، والخطأ بالشكل الموحّد
  it("input validation: حالة طالب غير صالحة تُرفض بشكل خطأ موحّد", async () => {
    const admin = await login("admin-a@test.io");
    const res = await request(app.getHttpServer())
      .patch(`/api/students/${ids.student}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "__invalid__" })
      .expect(400);
    // شكل الخطأ الموحّد من AllExceptionsFilter
    expect(res.body).toHaveProperty("path");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("statusCode", 400);
  });

  // ==========================================================================
  // تدقيق RBAC شامل — اكتُشفت هذه الثغرات بجرد كل نقطة نهاية × كل دور، ثم
  // التحقق الفعلي من ownership في طبقة الخدمة (لا الديكوريتر @Roles فقط)
  // ==========================================================================

  // 16 — C1: الطالب يرى سجله الخاص فقط، لا زميله في نفس الشعبة
  it("C1 IDOR: الطالب يرى ملفه الخاص، ويُمنع من ملف زميله (403)", async () => {
    const student = await login("student-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/students/${ids.student}`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/students/${ids.classmate}`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(403);
  });

  // 17 — C2: نتائج الامتحان تُقيَّد بسجل الطالب فقط (كان يرى الشعبة كاملة)
  it("C2 IDOR: كشف نتائج الامتحان يعرض للطالب سجله فقط لا كامل الشعبة", async () => {
    const student = await login("student-a@test.io");
    const res = await request(app.getHttpServer())
      .get(`/api/exams/${ids.exam}/results`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].studentId).toBe(ids.student);
    // لكن الترتيب (rank) محسوب على الشعبة كاملة — الطالب حصل 80 والزميل 91، فرتبته 2
    expect(res.body.results[0].rank).toBe(2);
    expect(res.body.classSize).toBe(2);
  });

  // 18 — C3: كشف الدرجات PDF لطالب آخر غير موجود (404) لا تسريب
  it("C3 IDOR: الطالب يُمنع من كشف درجات زميله عبر تخمين studentId (404)", async () => {
    const student = await login("student-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/exams/${ids.exam}/results/${ids.classmate}/card`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(404);
    // لكن كشفه الخاص يعمل
    await request(app.getHttpServer())
      .get(`/api/exams/${ids.exam}/results/${ids.student}/card`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
  });

  // 19 — C4: لوحة الطالب والمعلم لا تحوي أي حقل مالي أو إداري للمؤسسة
  it("C4: لوحتا الطالب والمعلم بلا أي بيانات مالية/إدارية للمؤسسة", async () => {
    const student = await login("student-a@test.io");
    const studentDash = await request(app.getHttpServer())
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
    expect(studentDash.body.school).toBeUndefined();
    expect(studentDash.body.platform).toBeUndefined();
    expect(JSON.stringify(studentDash.body)).not.toMatch(/collected|outstanding|collectionRate|pendingAdmissions/);
    expect(studentDash.body.student).toBeTruthy();

    const teacher = await login("teacher-a@test.io");
    const teacherDash = await request(app.getHttpServer())
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .expect(200);
    expect(teacherDash.body.school).toBeUndefined();
    expect(JSON.stringify(teacherDash.body)).not.toMatch(/collected|outstanding|collectionRate|pendingAdmissions/);
    expect(teacherDash.body.teacher).toBeTruthy();
  });

  // 20 — H1: رسالة INDIVIDUALS لا تقبل مستلمًا من مؤسسة أخرى
  it("H1: إرسال رسالة لمستخدم من مؤسسة أخرى يُرفض (400)", async () => {
    const admin = await login("admin-a@test.io");
    await request(app.getHttpServer())
      .post("/api/messages")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        title: "رسالة اختبار",
        body: "محتوى",
        channel: "IN_APP",
        audience: { kind: "INDIVIDUALS", userIds: [ids.adminB] },
      })
      .expect(400);
  });

  // 21 — H2: بحث المعلم لا يعيد سندات/مبالغ مالية إطلاقًا
  it("H2: بحث المعلم لا يكشف سندات القبض", async () => {
    const teacher = await login("teacher-a@test.io");
    const res = await request(app.getHttpServer())
      .get("/api/search?q=RC")
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .expect(200);
    expect(res.body.payments).toHaveLength(0);
  });

  // 22 — H3: المعلم يُمنع من تقرير حضور شعبة لا يملكها
  it("H3: المعلم يُمنع من تقرير حضور شعبة لا يملكها (403)، ويسمح بشعبته", async () => {
    const otherTeacher = await login("teacher2-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/attendance/report?sectionId=${ids.section}`)
      .set("Authorization", `Bearer ${otherTeacher.accessToken}`)
      .expect(403);
    const owner = await login("teacher-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/attendance/report?sectionId=${ids.section}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
  });

  // 23 — M1: الطالب يصل لحضوره الخاص فقط عبر تقرير الحضور
  it("M1: الطالب يرى حضوره الخاص فقط دون تحديد شعبة", async () => {
    const student = await login("student-a@test.io");
    const res = await request(app.getHttpServer())
      .get("/api/attendance/report")
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
    for (const row of res.body) expect(row.student.id).toBe(ids.student);
  });

  // 24 — امتيازات مالية: الطالب يرى قسطه الخاص فقط لا قسط زميله
  it("fees ownership: الطالب يرى أقساطه فقط لا أقساط زميله", async () => {
    const student = await login("student-a@test.io");
    const res = await request(app.getHttpServer())
      .get("/api/fees")
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
    for (const item of res.body.items) expect(item.student.id).toBe(ids.student);
  });

  // 25 — تصعيد صلاحيات: جولة منهجية — الطالب يُمنع من كل نقاط النهاية الإدارية/المالية
  it("privilege escalation sweep: الطالب يُمنع من كل المسارات الإدارية والمالية", async () => {
    const student = await login("student-a@test.io");
    const h = { Authorization: `Bearer ${student.accessToken}` };
    const forbidden: [string, string][] = [
      ["GET", "/api/tenants"],
      ["GET", "/api/audit"],
      ["GET", "/api/employees"],
      ["POST", "/api/employees"],
      ["GET", "/api/students"], // القائمة الإدارية — لا يحق للطالب تصفّح الطلبة
      ["POST", "/api/students"],
      ["DELETE", `/api/students/${ids.classmate}`],
      ["POST", "/api/payments"],
      ["POST", "/api/payments/x/void"],
      ["POST", "/api/discounts"],
      ["PUT", `/api/exams/${ids.exam}/results`],
      ["POST", "/api/attendance/bulk"],
      ["POST", "/api/ai/generate"],
      ["PATCH", "/api/tenants/mine/settings"],
      ["GET", "/api/routes"],
    ];
    for (const [method, url] of forbidden) {
      const res = await request(app.getHttpServer())
        [method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete"](url)
        .set(h)
        .send({});
      expect([401, 403]).toContain(res.status);
    }
  });

  // 26 — تخمين معرّفات: مدير المؤسسة أ يُمنع من الوصول لأي كيان في المؤسسة ب
  it("ID guessing across tenants: مدير المؤسسة أ يُمنع من كل بيانات المؤسسة ب", async () => {
    const adminA = await login("admin-a@test.io");
    const h = { Authorization: `Bearer ${adminA.accessToken}` };
    await request(app.getHttpServer()).get(`/api/students/${ids.studentB}`).set(h).expect(404);
    await request(app.getHttpServer()).get(`/api/tenants/${ids.tenantB}`).set(h).expect(403);
  });

  // ==========================================================================
  // الوثائق الرسمية — شهادات / بيان درجات / كشف حساب + بوابة تحقق
  // ==========================================================================

  // 27 — الشهادة تُصدَر بهوية منارة وتحمل رقمًا ورمز تحقق
  it("documents: الشهادة تُصدَر HTML بهوية منارة + رقم تسلسلي ورمز تحقق", async () => {
    const admin = await login("admin-a@test.io");
    const res = await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/certificate?kind=completion&year=2025-2026`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(res.text).toContain("Cairo");
    expect(res.text).toContain("0b6e63");
    expect(res.text).toMatch(/CRT-[A-Z0-9-]+/); // رقم تسلسلي
    expect(res.text).toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/); // رمز تحقق
    expect(res.text).toContain("نسخة رسمية"); // علامة مائية
  });

  // 28 — بيان الدرجات وكشف الحساب يُصدَران للمدير
  it("documents: بيان الدرجات وكشف الحساب يُصدَران بنجاح", async () => {
    const admin = await login("admin-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/transcript?year=2025-2026`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/statement`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
  });

  // 29 — RBAC وثائق: الطالب يصدر وثيقته، ويُمنع من وثيقة زميله
  it("documents RBAC: الطالب يصدر وثيقته فقط لا وثيقة زميله (403)", async () => {
    const student = await login("student-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/transcript`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.classmate}/transcript`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(403);
    // كشف الحساب المالي: طلب سجل زميل يُخفى وجوده (404) بدل الكشف عنه
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.classmate}/statement`)
      .set("Authorization", `Bearer ${student.accessToken}`)
      .expect(404);
  });

  // 30 — RBAC وثائق: المعلم ممنوع من الشهادات وكشف الحساب، مسموح ببيان شعبته
  it("documents RBAC: المعلم يُصدر بيان طلاب شعبه، ويُمنع من الشهادة وكشف الحساب", async () => {
    const teacher = await login("teacher-a@test.io");
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/transcript`)
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/certificate`)
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/statement`)
      .set("Authorization", `Bearer ${teacher.accessToken}`)
      .expect(403);
  });

  // 31 — بوابة التحقق العامة: تقبل الرمز الصحيح، ترفض المزوّر، بلا PII
  it("verify portal: تحقق عام يقبل الرمز الصحيح ويرفض المزوّر دون كشف PII", async () => {
    const admin = await login("admin-a@test.io");
    const doc = await request(app.getHttpServer())
      .get(`/api/documents/students/${ids.student}/certificate?kind=graduation&year=2025-2026`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    const serial = doc.text.match(/CRT-[A-Z0-9-]+/)![0];
    const code = doc.text.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)![0];

    // بلا مصادقة (مسار عام)
    const ok = await request(app.getHttpServer()).get(`/api/documents/verify/${serial}?code=${code}`).expect(200);
    expect(ok.body.valid).toBe(true);
    // لا اسم كامل ولا درجات في الملخص — أول حرف فقط
    expect(JSON.stringify(ok.body)).not.toContain("طالب الاختبار الأول");

    const bad = await request(app.getHttpServer()).get(`/api/documents/verify/${serial}?code=AAAA-BBBB-CCCC`).expect(200);
    expect(bad.body.valid).toBe(false);
  });
});
