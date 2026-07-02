// ============================================================================
// طبقة البيانات التجريبية (Seed) — منصة إدارة المدارس والمعاهد
// بيانات وهمية واقعية تُحاكي مخطط Prisma الوارد في المواصفة (Frontend فقط).
// عند ربط Supabase لاحقًا، تُستبدل هذه الدوال بطبقة API حقيقية.
// ============================================================================

export type Role =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "ACCOUNTANT"
  | "TEACHER"
  | "PARENT"
  | "STUDENT"
  | "AUDITOR";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "المدير العام",
  SCHOOL_ADMIN: "مدير المدرسة",
  ACCOUNTANT: "المحاسب",
  TEACHER: "المعلّم",
  PARENT: "وليّ الأمر",
  STUDENT: "الطالب",
  AUDITOR: "المدقّق",
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant: string;
  avatarColor: string;
}

export interface School {
  id: string;
  name: string;
  city: string;
  branches: number;
  students: number;
  staff: number;
  plan: "Basic" | "Pro" | "Enterprise";
  status: "active" | "trial" | "suspended";
  createdAt: string;
}

export type StudentStatus = "active" | "suspended" | "graduated" | "withdrawn";

export interface Student {
  id: string;
  name: string;
  gender: "ذكر" | "أنثى";
  stage: string;
  section: string;
  guardian: string;
  guardianPhone: string;
  status: StudentStatus;
  balance: number; // متبقٍ عليه
  attendanceRate: number;
  gpa: number;
  enrolledAt: string;
}

export type AdmissionStage =
  | "new"
  | "reviewing"
  | "interview"
  | "accepted"
  | "rejected";

export interface Admission {
  id: string;
  applicant: string;
  stageApplied: string;
  guardian: string;
  phone: string;
  stage: AdmissionStage;
  submittedAt: string;
  docs: number;
}

export type AttendanceMark = "present" | "absent" | "late" | "early";

export interface AttendanceRow {
  studentId: string;
  name: string;
  mark: AttendanceMark;
  note?: string;
}

export interface FeeRecord {
  id: string;
  student: string;
  studentId: string;
  plan: string;
  total: number;
  paid: number;
  dueDate: string;
  status: "paid" | "partial" | "overdue";
}

export interface Payment {
  id: string;
  receipt: string;
  student: string;
  amount: number;
  method: "نقدًا" | "تحويل" | "بطاقة";
  date: string;
  by: string;
}

export interface ExamResult {
  studentId: string;
  name: string;
  monthly: number;
  midterm: number;
  finalExam: number;
  total: number;
  grade: string;
  rank: number;
}

export interface Message {
  id: string;
  title: string;
  audience: string;
  channel: "داخلي" | "SMS" | "WhatsApp";
  status: "sent" | "scheduled" | "draft" | "failed";
  date: string;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  ip: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
}

// ---------------------------------------------------------------------------
// حسابات الدخول التجريبية (لكل دور)
// ---------------------------------------------------------------------------
export const DEMO_USERS: AppUser[] = [
  { id: "u1", name: "علي الحسيني", email: "super@manarah.io", role: "SUPER_ADMIN", tenant: "المنصة", avatarColor: "#7c3aed" },
  { id: "u2", name: "مريم العبيدي", email: "admin@alnoor.edu", role: "SCHOOL_ADMIN", tenant: "ثانوية النور الأهلية", avatarColor: "#0b6e63" },
  { id: "u3", name: "حسن الطائي", email: "acc@alnoor.edu", role: "ACCOUNTANT", tenant: "ثانوية النور الأهلية", avatarColor: "#0284c7" },
  { id: "u4", name: "زينب الجبوري", email: "teacher@alnoor.edu", role: "TEACHER", tenant: "ثانوية النور الأهلية", avatarColor: "#d97706" },
  { id: "u5", name: "أبو محمد الساعدي", email: "parent@alnoor.edu", role: "PARENT", tenant: "ثانوية النور الأهلية", avatarColor: "#e11d48" },
  { id: "u6", name: "محمد الساعدي", email: "student@alnoor.edu", role: "STUDENT", tenant: "ثانوية النور الأهلية", avatarColor: "#16a34a" },
  { id: "u7", name: "سالم الدليمي", email: "audit@manarah.io", role: "AUDITOR", tenant: "المنصة", avatarColor: "#475569" },
];

export const SCHOOLS: School[] = [
  { id: "s1", name: "ثانوية النور الأهلية", city: "بغداد", branches: 3, students: 842, staff: 68, plan: "Enterprise", status: "active", createdAt: "2023-09-01" },
  { id: "s2", name: "معهد الرافدين للتدريب", city: "البصرة", branches: 1, students: 310, staff: 22, plan: "Pro", status: "active", createdAt: "2024-01-15" },
  { id: "s3", name: "روضة براعم المستقبل", city: "أربيل", branches: 2, students: 180, staff: 19, plan: "Basic", status: "trial", createdAt: "2025-02-10" },
  { id: "s4", name: "كلية الحكمة الأهلية", city: "النجف", branches: 1, students: 1240, staff: 140, plan: "Enterprise", status: "active", createdAt: "2022-08-20" },
  { id: "s5", name: "مدارس الفرات الحديثة", city: "كربلاء", branches: 4, students: 960, staff: 95, plan: "Pro", status: "suspended", createdAt: "2023-03-05" },
];

const FIRST = ["أحمد", "محمد", "علي", "حسين", "يوسف", "مصطفى", "فاطمة", "زينب", "مريم", "نور", "سارة", "رقية", "عبدالله", "كرار", "حوراء", "آية", "زهراء", "حسن", "جعفر", "تبارك"];
const LAST = ["الساعدي", "الجبوري", "العبيدي", "الطائي", "الدليمي", "الحسيني", "الموسوي", "العزاوي", "الشمري", "الربيعي"];
const STAGES = ["الأول متوسط", "الثاني متوسط", "الثالث متوسط", "الرابع علمي", "الخامس علمي", "السادس علمي"];
const SECTIONS = ["أ", "ب", "ج"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export const STUDENTS: Student[] = Array.from({ length: 36 }, (_, i) => {
  const name = `${pick(FIRST, i * 3)} ${pick(LAST, i * 7 + 1)}`;
  const guardian = `${pick(FIRST, i + 6)} ${pick(LAST, i * 7 + 1)}`;
  const statuses: StudentStatus[] = ["active", "active", "active", "active", "suspended", "graduated", "withdrawn"];
  const balance = [0, 0, 250000, 500000, 0, 750000, 125000][i % 7];
  return {
    id: `st${1000 + i}`,
    name,
    gender: i % 3 === 0 ? "أنثى" : "ذكر",
    stage: pick(STAGES, i),
    section: pick(SECTIONS, i),
    guardian,
    guardianPhone: `0770${(1000000 + i * 13457).toString().slice(0, 7)}`,
    status: pick(statuses, i),
    balance,
    attendanceRate: 80 + ((i * 7) % 20),
    gpa: Number((70 + ((i * 11) % 29) + (i % 3) * 0.5).toFixed(1)),
    enrolledAt: `2024-09-${(1 + (i % 27)).toString().padStart(2, "0")}`,
  };
});

export const ADMISSIONS: Admission[] = Array.from({ length: 12 }, (_, i) => {
  const stages: AdmissionStage[] = ["new", "reviewing", "interview", "accepted", "rejected", "new", "reviewing", "accepted"];
  return {
    id: `ad${200 + i}`,
    applicant: `${pick(FIRST, i * 2 + 1)} ${pick(LAST, i * 3)}`,
    stageApplied: pick(STAGES, i + 2),
    guardian: `${pick(FIRST, i + 4)} ${pick(LAST, i * 3)}`,
    phone: `0771${(2000000 + i * 21789).toString().slice(0, 7)}`,
    stage: pick(stages, i),
    submittedAt: `2026-06-${(10 + (i % 18)).toString().padStart(2, "0")}`,
    docs: 2 + (i % 4),
  };
});

export const FEES: FeeRecord[] = STUDENTS.slice(0, 20).map((s, i) => {
  const total = [1500000, 2000000, 1750000, 2500000][i % 4];
  const paid = s.balance === 0 ? total : total - s.balance;
  return {
    id: `fee${300 + i}`,
    student: s.name,
    studentId: s.id,
    plan: pick(["قسط سنوي", "٣ أقساط", "٤ أقساط"], i),
    total,
    paid,
    dueDate: `2026-0${1 + (i % 8)}-15`,
    status: paid >= total ? "paid" : paid === 0 ? "overdue" : "partial",
  };
});

export const PAYMENTS: Payment[] = Array.from({ length: 14 }, (_, i) => ({
  id: `pay${400 + i}`,
  receipt: `RC-2026-${(1050 + i).toString()}`,
  student: pick(STUDENTS, i * 2).name,
  amount: [250000, 500000, 750000, 1000000][i % 4],
  method: pick(["نقدًا", "تحويل", "بطاقة"] as const, i),
  date: `2026-06-${(5 + (i % 24)).toString().padStart(2, "0")}`,
  by: "حسن الطائي",
}));

export const ATTENDANCE_TODAY: AttendanceRow[] = STUDENTS.slice(0, 18).map((s, i) => {
  const marks: AttendanceMark[] = ["present", "present", "present", "present", "late", "absent", "present", "early"];
  return { studentId: s.id, name: s.name, mark: pick(marks, i), note: i % 6 === 5 ? "غياب بعذر مرضي" : undefined };
});

export const EXAM_RESULTS: ExamResult[] = STUDENTS.slice(0, 16)
  .map((s, i) => {
    const monthly = 15 + ((i * 3) % 6);
    const midterm = 22 + ((i * 5) % 9);
    const finalExam = 40 + ((i * 7) % 21);
    const total = monthly + midterm + finalExam;
    return {
      studentId: s.id,
      name: s.name,
      monthly,
      midterm,
      finalExam,
      total,
      grade: total >= 90 ? "امتياز" : total >= 80 ? "جيد جدًا" : total >= 70 ? "جيد" : total >= 60 ? "متوسط" : "مقبول",
      rank: 0,
    };
  })
  .sort((a, b) => b.total - a.total)
  .map((r, i) => ({ ...r, rank: i + 1 }));

export const MESSAGES: Message[] = [
  { id: "m1", title: "تذكير بموعد الاجتماع مع أولياء الأمور", audience: "جميع أولياء الأمور", channel: "WhatsApp", status: "sent", date: "2026-06-28" },
  { id: "m2", title: "إشعار غياب اليوم", audience: "أولياء أمور الغائبين", channel: "SMS", status: "sent", date: "2026-07-02" },
  { id: "m3", title: "تعميم جدول الامتحانات النهائية", audience: "الطلبة والمعلمون", channel: "داخلي", status: "sent", date: "2026-06-25" },
  { id: "m4", title: "تنبيه أقساط متأخرة", audience: "٧ أولياء أمور", channel: "SMS", status: "scheduled", date: "2026-07-05" },
  { id: "m5", title: "رسالة ترحيب بالطلبة الجدد", audience: "المقبولون", channel: "WhatsApp", status: "draft", date: "—" },
  { id: "m6", title: "إشعار نتائج الشهر", audience: "أولياء الأمور", channel: "SMS", status: "failed", date: "2026-06-20" },
];

export const AUDIT_LOG: AuditEntry[] = [
  { id: "a1", user: "زينب الجبوري", action: "تعديل درجة (من 78 إلى 85)", entity: "ExamResult", entityId: "st1004", ip: "10.0.4.18", createdAt: "2026-07-02 09:41", severity: "warning" },
  { id: "a2", user: "حسن الطائي", action: "تسجيل دفعة 500,000 د.ع", entity: "Payment", entityId: "RC-2026-1062", ip: "10.0.4.9", createdAt: "2026-07-02 09:12", severity: "info" },
  { id: "a3", user: "مريم العبيدي", action: "قبول طلب تقديم وتحويله لطالب", entity: "Admission", entityId: "ad203", ip: "10.0.4.2", createdAt: "2026-07-02 08:55", severity: "info" },
  { id: "a4", user: "علي الحسيني", action: "حذف نهائي لسجل مالي", entity: "Payment", entityId: "RC-2026-0991", ip: "10.0.1.1", createdAt: "2026-07-01 17:30", severity: "critical" },
  { id: "a5", user: "زينب الجبوري", action: "تسجيل حضور الشعبة الرابع علمي/أ", entity: "Attendance", entityId: "sec-4a", ip: "10.0.4.18", createdAt: "2026-07-01 08:05", severity: "info" },
  { id: "a6", user: "حسن الطائي", action: "منح خصم 15% (منحة تفوق)", entity: "Discount", entityId: "st1008", ip: "10.0.4.9", createdAt: "2026-06-30 13:22", severity: "warning" },
  { id: "a7", user: "مريم العبيدي", action: "تعديل صلاحيات مستخدم", entity: "UserRole", entityId: "u4", ip: "10.0.4.2", createdAt: "2026-06-30 11:00", severity: "critical" },
  { id: "a8", user: "sistem", action: "محاولة دخول فاشلة (rate-limit)", entity: "Auth", entityId: "acc@alnoor.edu", ip: "185.12.9.44", createdAt: "2026-06-29 22:14", severity: "warning" },
];

// ---------------------------------------------------------------------------
// مساعدات التنسيق
// ---------------------------------------------------------------------------
export function formatIQD(n: number): string {
  return new Intl.NumberFormat("ar-IQ").format(n) + " د.ع";
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat("ar-IQ").format(n);
}

// إحصائيات مشتقة
export const STATS = {
  totalSchools: SCHOOLS.length,
  totalStudents: SCHOOLS.reduce((a, s) => a + s.students, 0),
  activeStudents: STUDENTS.filter((s) => s.status === "active").length,
  presentToday: ATTENDANCE_TODAY.filter((r) => r.mark === "present").length,
  absentToday: ATTENDANCE_TODAY.filter((r) => r.mark === "absent").length,
  lateToday: ATTENDANCE_TODAY.filter((r) => r.mark === "late").length,
  collected: PAYMENTS.reduce((a, p) => a + p.amount, 0),
  outstanding: FEES.reduce((a, f) => a + (f.total - f.paid), 0),
  pendingAdmissions: ADMISSIONS.filter((a) => a.stage !== "accepted" && a.stage !== "rejected").length,
};

export const COLLECTION_TREND = [
  { month: "كانون2", value: 42 },
  { month: "شباط", value: 55 },
  { month: "آذار", value: 61 },
  { month: "نيسان", value: 58 },
  { month: "أيار", value: 72 },
  { month: "حزيران", value: 84 },
];

export const ENROLLMENT_BY_STAGE = STAGES.map((stage, i) => ({
  stage,
  students: 90 + ((i * 37) % 120),
}));
