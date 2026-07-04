// ============================================================================
// Seed «منارة» — يحوّل بيانات mock.ts الأصلية (نفس الأسماء العربية) إلى قاعدة
// حقيقية + يضيف مستخدمَي DRIVER وHR. آمن لإعادة التشغيل (يمسح ويعيد البناء).
// تشغيل: pnpm --filter @manarah/api seed
// ============================================================================
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD || "Manarah@2026";
// في الإنتاج: SEED_FORCE_PASSWORD_CHANGE=true يُجبر كل حساب seed على تغيير كلمة
// المرور عند أول دخول. يبقى false في التطوير للحفاظ على سلاسة العرض التجريبي.
const FORCE_CHANGE = process.env.SEED_FORCE_PASSWORD_CHANGE === "true";

// --- بيانات mock.ts الأصلية ---
const SCHOOLS = [
  { name: "ثانوية النور الأهلية", city: "بغداد", branches: 3, plan: "Enterprise", status: "active", createdAt: "2023-09-01" },
  { name: "معهد الرافدين للتدريب", city: "البصرة", branches: 1, plan: "Pro", status: "active", createdAt: "2024-01-15" },
  { name: "روضة براعم المستقبل", city: "أربيل", branches: 2, plan: "Basic", status: "trial", createdAt: "2025-02-10" },
  { name: "كلية الحكمة الأهلية", city: "النجف", branches: 1, plan: "Enterprise", status: "active", createdAt: "2022-08-20" },
  { name: "مدارس الفرات الحديثة", city: "كربلاء", branches: 4, plan: "Pro", status: "suspended", createdAt: "2023-03-05" },
];

const FIRST = ["أحمد", "محمد", "علي", "حسين", "يوسف", "مصطفى", "فاطمة", "زينب", "مريم", "نور", "سارة", "رقية", "عبدالله", "كرار", "حوراء", "آية", "زهراء", "حسن", "جعفر", "تبارك"];
const LAST = ["الساعدي", "الجبوري", "العبيدي", "الطائي", "الدليمي", "الحسيني", "الموسوي", "العزاوي", "الشمري", "الربيعي"];
const STAGES = ["الأول متوسط", "الثاني متوسط", "الثالث متوسط", "الرابع علمي", "الخامس علمي", "السادس علمي"];
const SECTION_NAMES = ["أ", "ب", "ج"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  console.log("🌱 بدء الـ seed...");
  const hash = await argon2.hash(PASSWORD);

  // مسح بالترتيب (احترام الـ FKs)
  for (const table of [
    "auditLog", "notification", "aiRequest", "message", "examResult", "exam",
    "payment", "receiptCounter", "discount", "feeRecord", "attendanceRecord",
    "fileAsset", "admission", "student", "transportRoute", "employee",
    "section", "refreshToken", "user", "tenant",
  ] as const) {
    // @ts-expect-error dynamic delegate
    await prisma[table].deleteMany();
  }

  // --- المؤسسات ---
  const tenants = [];
  for (const s of SCHOOLS) {
    tenants.push(
      await prisma.tenant.create({
        data: {
          name: s.name,
          city: s.city,
          branches: s.branches,
          plan: s.plan,
          status: s.status,
          settings: JSON.stringify({ blockResultsOnDebt: true, autoAbsenceNotify: true, easternNumerals: false, darkMode: false }),
          createdAt: new Date(s.createdAt),
        },
      }),
    );
  }
  const alnoor = tenants[0]; // المؤسسة التجريبية الرئيسية

  // --- المستخدمون: الأدوار التسعة ---
  const mkUser = (name: string, email: string, role: string, tenantId: string | null, avatarColor: string) =>
    prisma.user.create({
      data: { name, email, role, tenantId, avatarColor, passwordHash: hash, mustChangePassword: FORCE_CHANGE },
    });

  const superAdmin = await mkUser("علي الحسيني", "super@manarah.io", "SUPER_ADMIN", null, "#7c3aed");
  const schoolAdmin = await mkUser("مريم العبيدي", "admin@alnoor.edu", "SCHOOL_ADMIN", alnoor.id, "#0b6e63");
  const accountant = await mkUser("حسن الطائي", "acc@alnoor.edu", "ACCOUNTANT", alnoor.id, "#0284c7");
  const teacher = await mkUser("زينب الجبوري", "teacher@alnoor.edu", "TEACHER", alnoor.id, "#d97706");
  const parent = await mkUser("أبو محمد الساعدي", "parent@alnoor.edu", "PARENT", alnoor.id, "#e11d48");
  const studentUser = await mkUser("محمد الساعدي", "student@alnoor.edu", "STUDENT", alnoor.id, "#16a34a");
  const auditor = await mkUser("سالم الدليمي", "audit@manarah.io", "AUDITOR", null, "#475569");
  const driver = await mkUser("كاظم الشمري", "driver@alnoor.edu", "DRIVER", alnoor.id, "#9333ea");
  const hr = await mkUser("ليلى الموسوي", "hr@alnoor.edu", "HR", alnoor.id, "#0f766e");

  // --- الشعب ---
  const sectionMap = new Map<string, string>();
  for (const stage of STAGES) {
    for (const name of SECTION_NAMES) {
      const sec = await prisma.section.create({
        data: { tenantId: alnoor.id, stage, name, teacherId: teacher.id },
      });
      sectionMap.set(`${stage}/${name}`, sec.id);
    }
  }

  // --- مسار النقل ---
  const route = await prisma.transportRoute.create({
    data: { tenantId: alnoor.id, name: "مسار الكرادة — صباحي", driverUserId: driver.id },
  });

  // --- الطلبة (36 كما في mock.ts) ---
  const statuses = ["active", "active", "active", "active", "suspended", "graduated", "withdrawn"];
  const students = [];
  for (let i = 0; i < 36; i++) {
    // الطالب رقم 0 هو نفسه صاحب حساب STUDENT التجريبي (محمد الساعدي)، وابن ولي الأمر التجريبي
    const name = i === 0 ? "محمد الساعدي" : `${pick(FIRST, i * 3)} ${pick(LAST, i * 7 + 1)}`;
    const guardian = `${pick(FIRST, i + 6)} ${pick(LAST, i * 7 + 1)}`;
    const stage = pick(STAGES, i);
    const section = pick(SECTION_NAMES, i);
    students.push(
      await prisma.student.create({
        data: {
          tenantId: alnoor.id,
          code: `st${1000 + i}`,
          name,
          gender: i % 3 === 0 ? "FEMALE" : "MALE",
          sectionId: sectionMap.get(`${stage}/${section}`),
          guardianName: guardian,
          guardianPhone: `0770${(1000000 + i * 13457).toString().slice(0, 7)}`,
          // أول طالبين لولي الأمر التجريبي (كما في الواجهة القديمة)
          guardianUserId: i < 2 ? parent.id : null,
          // ربط 1:1 بحساب STUDENT التجريبي — أساس كل فحوص ownership لهذا الدور
          studentUserId: i === 0 ? studentUser.id : null,
          status: pick(statuses, i),
          routeId: i % 5 === 0 ? route.id : null,
          enrolledAt: new Date(`2024-09-${(1 + (i % 27)).toString().padStart(2, "0")}`),
        },
      }),
    );
  }

  // --- طلبات القبول (12) ---
  const admissionStages = ["new", "reviewing", "interview", "accepted", "rejected", "new", "reviewing", "accepted"];
  for (let i = 0; i < 12; i++) {
    const stage = pick(admissionStages, i);
    await prisma.admission.create({
      data: {
        tenantId: alnoor.id,
        applicantName: `${pick(FIRST, i * 2 + 1)} ${pick(LAST, i * 3)}`,
        stageApplied: pick(STAGES, i + 2),
        guardianName: `${pick(FIRST, i + 4)} ${pick(LAST, i * 3)}`,
        guardianPhone: `0771${(2000000 + i * 21789).toString().slice(0, 7)}`,
        stage,
        rejectReason: stage === "rejected" ? "اكتمال العدد في المرحلة المطلوبة" : null,
        docs: 2 + (i % 4),
        submittedAt: new Date(`2026-06-${(10 + (i % 18)).toString().padStart(2, "0")}`),
      },
    });
  }

  // --- الأقساط (أول 20 طالبًا) ---
  const feeRecords = [];
  for (let i = 0; i < 20; i++) {
    const s = students[i];
    const total = [1500000, 2000000, 1750000, 2500000][i % 4];
    const balance = [0, 0, 250000, 500000, 0, 750000, 125000][i % 7];
    const paid = balance === 0 ? total : total - balance;
    const dueDate = `2026-0${1 + (i % 8)}-15`;
    feeRecords.push(
      await prisma.feeRecord.create({
        data: {
          tenantId: alnoor.id,
          studentId: s.id,
          plan: pick(["قسط سنوي", "٣ أقساط", "٤ أقساط"], i),
          total,
          paid,
          dueDate,
          status: paid >= total ? "paid" : paid === 0 ? "overdue" : dueDate < "2026-07-02" ? "overdue" : "partial",
        },
      }),
    );
  }

  // --- سندات القبض (14) بترقيم تسلسلي حقيقي ---
  for (let i = 0; i < 14; i++) {
    const fee = feeRecords[(i * 2) % feeRecords.length];
    const year = 2026;
    const counter = await prisma.receiptCounter.upsert({
      where: { tenantId_year: { tenantId: alnoor.id, year } },
      create: { tenantId: alnoor.id, year, value: 1 },
      update: { value: { increment: 1 } },
    });
    await prisma.payment.create({
      data: {
        tenantId: alnoor.id,
        year,
        seq: counter.value,
        receiptNo: `RC-${year}-${String(1000 + counter.value)}`,
        feeRecordId: fee.id,
        studentId: fee.studentId,
        amount: [250000, 500000, 750000, 1000000][i % 4],
        method: pick(["CASH", "TRANSFER", "CARD"], i),
        receivedById: accountant.id,
        receivedBy: accountant.name,
        createdAt: new Date(`2026-06-${(5 + (i % 24)).toString().padStart(2, "0")}`),
      },
    });
  }

  // --- تحضير اليوم (أول 18 طالبًا نشطًا في شعبهم) ---
  const today = new Date().toISOString().slice(0, 10);
  const marks = ["present", "present", "present", "present", "late", "absent", "present", "early"];
  for (let i = 0; i < 18; i++) {
    const s = students[i];
    if (!s.sectionId) continue;
    await prisma.attendanceRecord.create({
      data: {
        tenantId: alnoor.id,
        studentId: s.id,
        sectionId: s.sectionId,
        date: today,
        mark: pick(marks, i),
        note: i % 6 === 5 ? "غياب بعذر مرضي" : null,
        recordedById: teacher.id,
      },
    });
  }

  // --- امتحان + نتائج (16 طالبًا) ---
  const exam = await prisma.exam.create({
    data: {
      tenantId: alnoor.id,
      name: "الامتحان النهائي",
      subject: "الرياضيات",
      sectionId: sectionMap.get("الرابع علمي/أ")!,
      year: "2025-2026",
      createdById: teacher.id,
    },
  });
  for (let i = 0; i < 16; i++) {
    const monthly = 15 + ((i * 3) % 6);
    const midterm = 22 + ((i * 5) % 9);
    const finalExam = 30 + ((i * 7) % 21); // الحد الأقصى 50

    const total = monthly + midterm + finalExam;
    await prisma.examResult.create({
      data: {
        examId: exam.id,
        studentId: students[i].id,
        monthly,
        midterm,
        finalExam,
        total,
        grade: total >= 90 ? "امتياز" : total >= 80 ? "جيد جدًا" : total >= 70 ? "جيد" : total >= 60 ? "متوسط" : "مقبول",
      },
    });
  }

  // --- رسائل (سجل التواصل من mock.ts) ---
  const messages = [
    { title: "تذكير بموعد الاجتماع مع أولياء الأمور", audienceKind: "ALL_PARENTS", channel: "WHATSAPP", status: "sent", date: "2026-06-28" },
    { title: "إشعار غياب اليوم", audienceKind: "ABSENTEES", channel: "SMS", status: "sent", date: "2026-07-02" },
    { title: "تعميم جدول الامتحانات النهائية", audienceKind: "STUDENTS", channel: "IN_APP", status: "sent", date: "2026-06-25" },
    { title: "تنبيه أقساط متأخرة", audienceKind: "ALL_PARENTS", channel: "SMS", status: "scheduled", date: "2026-07-05" },
    { title: "رسالة ترحيب بالطلبة الجدد", audienceKind: "ALL_PARENTS", channel: "WHATSAPP", status: "draft", date: "2026-07-01" },
  ];
  for (const m of messages) {
    await prisma.message.create({
      data: {
        tenantId: alnoor.id,
        title: m.title,
        body: m.title,
        channel: m.channel,
        audienceKind: m.audienceKind,
        audienceMeta: JSON.stringify({ label: m.audienceKind }),
        status: m.status,
        sentAt: m.status === "sent" ? new Date(m.date) : null,
        scheduledAt: m.status === "scheduled" ? new Date(m.date) : null,
        createdById: schoolAdmin.id,
      },
    });
  }

  // --- إشعارات ولي الأمر التجريبي ---
  await prisma.notification.createMany({
    data: [
      { userId: parent.id, title: "إشعار غياب", body: `ابنكم ${students[5].name} غائب اليوم ${today}.`, kind: "absence" },
      { userId: parent.id, title: "تذكير قسط", body: "يستحق قسط بقيمة 500,000 د.ع بتاريخ 2026-07-15.", kind: "payment" },
      { userId: schoolAdmin.id, title: "طلب قبول جديد", body: "وصل طلب تقديم جديد للمراجعة.", kind: "admission" },
    ],
  });

  // --- موظفون (HR) ---
  await prisma.employee.createMany({
    data: [
      { tenantId: alnoor.id, name: teacher.name, title: "معلمة رياضيات", contractType: "full_time", salary: 900000, userId: teacher.id, phone: "07701234567" },
      { tenantId: alnoor.id, name: accountant.name, title: "محاسب", contractType: "full_time", salary: 850000, userId: accountant.id, phone: "07701234568" },
      { tenantId: alnoor.id, name: driver.name, title: "سائق نقل مدرسي", contractType: "contract", salary: 500000, userId: driver.id, phone: "07701234569" },
      { tenantId: alnoor.id, name: hr.name, title: "مسؤولة موارد بشرية", contractType: "full_time", salary: 800000, userId: hr.id, phone: "07701234570" },
      { tenantId: alnoor.id, name: "قاسم العزاوي", title: "حارس أمن", contractType: "part_time", salary: 350000, phone: "07701234571" },
    ],
  });

  // --- قيود تدقيق افتتاحية ---
  await prisma.auditLog.create({
    data: {
      userName: "system",
      action: "تهيئة قاعدة البيانات (seed) — الأدوار التسعة والبيانات التجريبية",
      entity: "System",
      entityId: "seed",
      severity: "info",
    },
  });

  console.log("✅ اكتمل الـ seed:");
  console.log(`   5 مؤسسات · 9 مستخدمين (كل الأدوار) · 36 طالبًا · 12 طلب قبول`);
  console.log(`   20 قسطًا · 14 سند قبض · تحضير اليوم · امتحان بـ16 نتيجة`);
  console.log(`   كلمة مرور جميع الحسابات: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
