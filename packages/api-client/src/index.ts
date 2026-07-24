// ============================================================================
// @manarah/api-client — SDK موحّد يستهلكه الويب وسطح المكتب.
// مبني يدويًا فوق عقد الـ API (المصدر المرجعي: Swagger على /api/docs،
// وjson على /api/docs-json لتوليد أنواع آلي مستقبلًا عبر openapi-typescript).
// - إدارة access token + تجديد تلقائي عند 401 (مرة واحدة ثم إعادة المحاولة)
// - الويب: refresh عبر httpOnly cookie · سطح المكتب/الموبايل: عبر TokenStore
// ============================================================================

import type {
  CreateStudentDto,
  CreatePaymentDto,
  CreateCheckoutDto,
  CreateAdmissionDto,
  BulkAttendanceDto,
  CreateMessageDto,
  Role,
  FeatureKey,
} from "@manarah/shared";

export interface TokenStore {
  getAccess(): string | null;
  setAccess(token: string | null): void;
  /** يعيد null على الويب (الكوكي يتكفل) — قيمة فعلية على desktop/mobile */
  getRefresh(): string | null;
  setRefresh(token: string | null): void;
}

/** مخزن ذاكرة بسيط — الويب يحتاج access فقط (الـ refresh في httpOnly cookie) */
export function memoryTokenStore(): TokenStore {
  let access: string | null = null;
  let refresh: string | null = null;
  return {
    getAccess: () => access,
    setAccess: (t) => (access = t),
    getRefresh: () => refresh,
    setRefresh: (t) => (refresh = t),
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthUserInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  tenantName?: string;
  avatarColor: string;
  mustChangePassword: boolean;
}

export class ManarahClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly store: TokenStore = memoryTokenStore(),
    /** يُستدعى عند فشل التجديد نهائيًا — الواجهة تعيد التوجيه للدخول */
    public onSessionExpired: () => void = () => {},
  ) {}

  // -------------------------------------------------------------- transport
  private async raw(method: string, path: string, body?: unknown, isForm = false): Promise<Response> {
    const headers: Record<string, string> = {};
    const access = this.store.getAccess();
    if (access) headers.Authorization = `Bearer ${access}`;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  }

  // مسارات لا يُحاوَل التجديد عند فشلها (تمنع حلقة لا نهائية):
  // login/refresh/logout فقط — أما /auth/me فيجب أن يُجدِّد ليُستأنف عند إعادة التحميل
  private static NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout"];

  private async request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
    let res = await this.raw(method, path, body, isForm);
    if (res.status === 401 && !ManarahClient.NO_REFRESH.some((p) => path.startsWith(p))) {
      const ok = await this.tryRefresh();
      if (!ok) {
        this.onSessionExpired();
        throw new ApiError(401, "انتهت الجلسة — سجّل الدخول مجددًا");
      }
      res = await this.raw(method, path, body, isForm);
    }
    if (!res.ok) {
      let message = `خطأ ${res.status}`;
      try {
        const data = await res.json();
        message = Array.isArray(data.message) ? data.message.join(" · ") : (data.message ?? message);
      } catch {
        /* non-json */
      }
      throw new ApiError(res.status, message);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private tryRefresh(): Promise<boolean> {
    // طلب تجديد واحد مشترك مهما تعددت الاستدعاءات المتزامنة
    this.refreshing ??= (async () => {
      try {
        const refresh = this.store.getRefresh();
        const res = await this.raw("POST", "/auth/refresh", refresh ? { refreshToken: refresh } : {});
        if (!res.ok) return false;
        const data = await res.json();
        this.store.setAccess(data.accessToken);
        if (data.refreshToken && this.store.getRefresh() !== null) this.store.setRefresh(data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private qs(params: Record<string, string | number | boolean | undefined>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
    if (entries.length === 0) return "";
    return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  }

  /** رابط مطلق (لفتح مستندات الطباعة في نافذة جديدة) */
  absoluteUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ------------------------------------------------------------------- auth
  auth = {
    login: async (email: string, password: string) => {
      const data = await this.request<{ accessToken: string; refreshToken: string; user: AuthUserInfo }>(
        "POST",
        "/auth/login",
        { email, password },
      );
      this.store.setAccess(data.accessToken);
      if (this.store.getRefresh() !== null) this.store.setRefresh(data.refreshToken);
      return data.user;
    },
    logout: async () => {
      const refresh = this.store.getRefresh();
      await this.request("POST", "/auth/logout", refresh ? { refreshToken: refresh } : {}).catch(() => undefined);
      this.store.setAccess(null);
      this.store.setRefresh(null);
    },
    me: () => this.request<AuthUserInfo & { tenantName: string }>("GET", "/auth/me"),
    changePassword: (current: string, next: string) =>
      this.request<{ ok: boolean }>("POST", "/auth/change-password", { current, next }),
  };

  // --------------------------------------------------------------- students
  students = {
    list: (q: { query?: string; status?: string; sectionId?: string; page?: number; pageSize?: number } = {}) =>
      this.request<{ items: StudentListItem[]; total: number; page: number; pageSize: number }>(
        "GET",
        `/students${this.qs(q)}`,
      ),
    detail: (id: string) => this.request<StudentDetail>("GET", `/students/${id}`),
    create: (dto: CreateStudentDto) => this.request<StudentListItem>("POST", "/students", dto),
    update: (id: string, dto: Partial<CreateStudentDto>) =>
      this.request<StudentListItem>("PATCH", `/students/${id}`, dto),
    changeStatus: (id: string, status: string) =>
      this.request<StudentListItem>("PATCH", `/students/${id}/status`, { status }),
    moveSection: (id: string, sectionId: string) =>
      this.request<StudentListItem>("PATCH", `/students/${id}/section`, { sectionId }),
    archive: (id: string) => this.request<{ ok: boolean }>("DELETE", `/students/${id}`),
    importCsv: (file: File | Blob, opts: { dryRun?: boolean } = {}) => {
      const form = new FormData();
      form.append("file", file);
      const q = opts.dryRun ? "?dryRun=true" : "";
      return this.request<CsvImportReport>("POST", `/students/import${q}`, form, true);
    },
    uploadDocument: (id: string, file: File | Blob) => {
      const form = new FormData();
      form.append("file", file);
      return this.request<{ id: string; fileName: string }>("POST", `/students/${id}/documents`, form, true);
    },
  };

  sections = {
    list: () =>
      this.request<{ id: string; stage: string; name: string; label: string; studentCount: number }[]>(
        "GET",
        "/sections",
      ),
    students: (id: string) =>
      this.request<{ id: string; code: string; name: string; gender: string }[]>("GET", `/sections/${id}/students`),
  };

  // ------------------------------------------------------------------- fees
  fees = {
    createRecord: (dto: { studentId: string; plan: string; total: number; dueDate: string }) =>
      this.request<FeeRecordItem>("POST", "/fees", dto),
    records: (q: { status?: string; query?: string; page?: number; pageSize?: number } = {}) =>
      this.request<{ items: FeeRecordItem[]; total: number; page: number; pageSize: number }>(
        "GET",
        `/fees${this.qs(q)}`,
      ),
    stats: () =>
      this.request<{
        collected: number;
        outstanding: number;
        collectionRate: number;
        receiptsThisMonth: number;
        overdueCount: number;
      }>("GET", "/fees/stats"),
    payments: (q: { query?: string; page?: number; pageSize?: number } = {}) =>
      this.request<{ items: PaymentItem[]; total: number; page: number; pageSize: number }>(
        "GET",
        `/payments${this.qs(q)}`,
      ),
    createPayment: (dto: CreatePaymentDto) =>
      this.request<PaymentItem & { fullyPaid: boolean }>("POST", "/payments", dto),
    /** بدء دفع إلكتروني — يعيد رابط بوابة الدفع (زين كاش…) لتحويل المستخدم إليه */
    checkout: (dto: CreateCheckoutDto) =>
      this.request<{
        intentId: string;
        providerRef: string;
        checkoutUrl: string;
        amount: number;
        gateway: string;
      }>("POST", "/payments/checkout", dto),
    voidPayment: (id: string, reason: string) =>
      this.request<{ ok: boolean }>("POST", `/payments/${id}/void`, { reason }),
    receiptUrl: (id: string) => this.absoluteUrl(`/payments/${id}/receipt`),
    createDiscount: (dto: { studentId: string; percent: number; reason: string }) =>
      this.request("POST", "/discounts", dto),
  };

  // ------------------------------------------------------------- admissions
  admissions = {
    list: () => this.request<AdmissionItem[]>("GET", "/admissions"),
    create: (dto: CreateAdmissionDto) => this.request<AdmissionItem>("POST", "/admissions", dto),
    changeStage: (id: string, stage: string, reason?: string) =>
      this.request<AdmissionItem>("PATCH", `/admissions/${id}/stage`, { stage, reason }),
    convert: (id: string) =>
      this.request<{ admission: AdmissionItem; student: StudentListItem }>("POST", `/admissions/${id}/convert`),
  };

  // ------------------------------------------------------------- attendance
  attendance = {
    sheet: (sectionId: string, date?: string) =>
      this.request<{
        date: string;
        saved: boolean;
        rows: { studentId: string; code: string; name: string; mark: string; note?: string }[];
      }>("GET", `/attendance/sheet${this.qs({ sectionId, date })}`),
    saveBulk: (dto: BulkAttendanceDto) =>
      this.request<{ ok: boolean; saved: number; absent: number; guardiansNotified: number }>(
        "POST",
        "/attendance/bulk",
        dto,
      ),
    today: () =>
      this.request<{ date: string; present: number; absent: number; late: number; early: number }>(
        "GET",
        "/attendance/today",
      ),
    report: (q: { sectionId?: string; studentId?: string; from?: string; to?: string } = {}) =>
      this.request<AttendanceReportRow[]>("GET", `/attendance/report${this.qs(q)}`),
  };

  // ------------------------------------------------------------------ exams
  exams = {
    list: () => this.request<ExamItem[]>("GET", "/exams"),
    create: (dto: { name: string; subject: string; sectionId: string; year: string }) =>
      this.request<ExamItem>("POST", "/exams", dto),
    results: (id: string) => this.request<{ exam: ExamItem; results: ExamResultItem[] }>("GET", `/exams/${id}/results`),
    saveResults: (id: string, rows: { studentId: string; monthly: number; midterm: number; finalExam: number }[]) =>
      this.request<{ ok: boolean; created: number; updated: number }>("PUT", `/exams/${id}/results`, { rows }),
    reportCardUrl: (examId: string, studentId: string) =>
      this.absoluteUrl(`/exams/${examId}/results/${studentId}/card`),
  };

  // --------------------------------------------------------------- messages
  messages = {
    list: () => this.request<MessageItem[]>("GET", "/messages"),
    create: (dto: CreateMessageDto) => this.request<MessageItem & { recipients: number }>("POST", "/messages", dto),
  };

  notifications = {
    list: (unreadOnly = false) =>
      this.request<{ items: NotificationItem[]; unread: number }>(
        "GET",
        `/notifications${this.qs({ unread: unreadOnly ? "true" : undefined })}`,
      ),
    markRead: (id: string) => this.request<{ ok: boolean }>("PATCH", `/notifications/${id}/read`),
    markAllRead: () => this.request<{ ok: boolean }>("PATCH", "/notifications/read-all"),
  };

  // ---------------------------------------------------------------- tenants
  tenants = {
    list: () => this.request<TenantItem[]>("GET", "/tenants"),
    create: (dto: { name: string; city?: string; plan?: string; branches?: number }) =>
      this.request<TenantItem>("POST", "/tenants", dto),
    detail: (id: string) => this.request<TenantItem & { settings: TenantSettings }>("GET", `/tenants/${id}`),
    changeStatus: (id: string, status: string) => this.request<TenantItem>("PATCH", `/tenants/${id}/status`, { status }),
    mySettings: () =>
      this.request<{ tenantId: string; name: string; settings: TenantSettings }>("GET", "/tenants/mine/settings"),
    updateSettings: (settings: Partial<TenantSettings>) =>
      this.request<{ settings: TenantSettings }>("PATCH", "/tenants/mine/settings", settings),
    /** أعلام الميزات لمؤسستي — متاحة لكل الأدوار المصادَقة (قراءة فقط) */
    getMyFeatures: () => this.request<{ features: FeatureFlagDto[] }>("GET", "/tenants/mine/features"),
    /** أعلام الميزات لمؤسسة محدَّدة — SUPER_ADMIN فقط */
    getTenantFeatures: (tenantId: string) =>
      this.request<TenantFeaturesDto>("GET", `/tenants/${tenantId}/features`),
    /** تحديث أعلام ميزة/ميزات لمؤسسة محدَّدة — SUPER_ADMIN فقط */
    updateTenantFeatures: (tenantId: string, updates: { key: FeatureKey; enabled: boolean }[]) =>
      this.request<TenantFeaturesDto>("PATCH", `/tenants/${tenantId}/features`, { updates }),
  };

  // ------------------------------------------------------------------ misc
  audit = {
    list: (q: {
      query?: string;
      severity?: string;
      entity?: string;
      userId?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    } = {}) =>
      this.request<{ items: AuditItem[]; total: number; page: number; pageSize: number }>(
        "GET",
        `/audit${this.qs(q)}`,
      ),
  };

  dashboard = { get: () => this.request<DashboardPayload>("GET", "/dashboard") };

  search = (q: string) =>
    this.request<{
      students: { id: string; name: string; code: string; section?: { stage: string; name: string } | null }[];
      payments: { id: string; receiptNo: string; amount: number; student: { name: string } }[];
      messages: { id: string; title: string; status: string }[];
    }>("GET", `/search${this.qs({ q })}`);

  ai = {
    requests: () => this.request<AiRequestItem[]>("GET", "/ai/requests"),
    generate: (kind: string, context: Record<string, unknown> = {}) =>
      this.request<AiRequestItem>("POST", "/ai/generate", { kind, context }),
    edit: (id: string, output: string) => this.request<AiRequestItem>("PATCH", `/ai/requests/${id}`, { output }),
    approve: (id: string) => this.request<AiRequestItem>("POST", `/ai/requests/${id}/approve`),
  };

  hr = {
    list: () => this.request<EmployeeItem[]>("GET", "/employees"),
    create: (dto: Partial<EmployeeItem> & { name: string; title: string }) =>
      this.request<EmployeeItem>("POST", "/employees", dto),
    update: (id: string, dto: Partial<EmployeeItem>) => this.request<EmployeeItem>("PATCH", `/employees/${id}`, dto),
  };

  transport = {
    list: () => this.request<RouteItem[]>("GET", "/routes"),
    mine: () => this.request<RouteItem[]>("GET", "/routes/mine"),
  };

  users = {
    list: (role?: string) =>
      this.request<{ id: string; name: string; email: string; role: Role; avatarColor: string }[]>(
        "GET",
        `/users${this.qs({ role })}`,
      ),
  };

  // ------------------------------------------------------ الوثائق الرسمية (روابط طباعة)
  documents = {
    certificateUrl: (studentId: string, kind: "completion" | "graduation" | "enrollment", year: string) =>
      this.absoluteUrl(`/documents/students/${studentId}/certificate${this.qs({ kind, year })}`),
    transcriptUrl: (studentId: string, year: string) =>
      this.absoluteUrl(`/documents/students/${studentId}/transcript${this.qs({ year })}`),
    statementUrl: (studentId: string) => this.absoluteUrl(`/documents/students/${studentId}/statement`),
    verify: (serial: string, code: string) =>
      this.request<{ valid: boolean; reason?: string; kind?: string; serial?: string; issuedAt?: string; summary?: Record<string, unknown> }>(
        "GET",
        `/documents/verify/${encodeURIComponent(serial)}${this.qs({ code })}`,
      ),
  };
}

// ----------------------------------------------------------------- الأنواع
export interface StudentListItem {
  id: string;
  code: string;
  name: string;
  gender: string;
  status: string;
  guardianName: string;
  guardianPhone: string;
  enrolledAt: string;
  healthNotes?: string | null;
  address?: string | null;
  section?: { id: string; stage: string; name: string } | null;
  balance?: number;
  attendanceRate?: number | null;
  gpa?: number | null;
}

export interface StudentDetail extends StudentListItem {
  feeRecords: (FeeRecordItem & { payments: PaymentItem[] })[];
  attendance: { id: string; date: string; mark: string; note?: string | null }[];
  examResults: { id: string; total: number; grade: string; monthly: number; midterm: number; finalExam: number; exam: ExamItem }[];
  discounts: { id: string; percent: number; reason: string; createdAt: string }[];
  documents: { id: string; fileName: string; mimeType: string; size: number }[];
}

export interface CsvImportReport {
  dryRun?: boolean;
  total: number;
  created: number;
  wouldCreate?: number; // في المعاينة: عدد ما سيُنشأ عند التأكيد
  duplicates?: number; // صفوف موجودة مسبقًا/مكررة تُتخطى
  rejected: number;
  report: { row: number; name?: string; ok: boolean; error?: string; duplicate?: boolean }[];
}

export interface FeeRecordItem {
  id: string;
  plan: string;
  total: number;
  paid: number;
  dueDate: string;
  status: string;
  student?: { id: string; name: string; code: string };
}

export interface PaymentItem {
  id: string;
  receiptNo: string;
  amount: number;
  method: string;
  note?: string | null;
  receivedBy: string;
  createdAt: string;
  student?: { id: string; name: string };
}

export interface AdmissionItem {
  id: string;
  applicantName: string;
  stageApplied: string;
  guardianName: string;
  guardianPhone: string;
  stage: string;
  rejectReason?: string | null;
  docs: number;
  submittedAt: string;
  convertedStudentId?: string | null;
}

export interface AttendanceReportRow {
  id: string;
  date: string;
  mark: string;
  note?: string | null;
  student: { id: string; name: string; code: string };
  section: { stage: string; name: string };
}

export interface ExamItem {
  id: string;
  name: string;
  subject: string;
  year: string;
  section?: { id: string; stage: string; name: string };
  _count?: { results: number };
}

export interface ExamResultItem {
  id: string;
  studentId: string;
  monthly: number;
  midterm: number;
  finalExam: number;
  total: number;
  grade: string;
  rank: number | null;
  student: { id: string; name: string; code: string };
}

export interface MessageItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  audienceKind: string;
  audienceMeta: string;
  status: string;
  sentAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  readAt?: string | null;
  createdAt: string;
}

export interface TenantItem {
  id: string;
  name: string;
  city?: string | null;
  plan: string;
  status: string;
  branches: number;
  students?: number;
  staff?: number;
  createdAt: string;
}

export interface TenantSettings {
  blockResultsOnDebt?: boolean;
  autoAbsenceNotify?: boolean;
  easternNumerals?: boolean;
  darkMode?: boolean;
}

/** علم ميزة مؤسسة واحد كما يعيده السيرفر (المفتاح + التسمية العربية + الحالة) */
export interface FeatureFlagDto {
  key: FeatureKey;
  labelAr: string;
  enabled: boolean;
}

export interface TenantFeaturesDto {
  tenantId: string;
  features: FeatureFlagDto[];
}

export interface AuditItem {
  id: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string | null;
  after?: string | null;
  ip?: string | null;
  severity: string;
  createdAt: string;
}

export interface AiRequestItem {
  id: string;
  kind: string;
  output: string;
  status: string;
  createdAt: string;
}

export interface EmployeeItem {
  id: string;
  name: string;
  title: string;
  phone?: string | null;
  contractType: string;
  salary?: number | null;
  status: string;
  hiredAt: string;
}

export interface RouteItem {
  id: string;
  name: string;
  driver?: { id: string; name: string } | null;
  students?: {
    id: string;
    name: string;
    code: string;
    guardianName: string;
    guardianPhone: string;
    address?: string | null;
    section?: { stage: string; name: string } | null;
  }[];
  _count?: { students: number };
}

export interface DashboardPayload {
  role: Role;
  platform?: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    totalStudents: number;
    auditToday: number;
    criticalCount: number;
    warningCount: number;
    collected: number;
    tenants: { id: string; name: string; status: string; plan: string; students: number }[];
  };
  school?: {
    activeStudents: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    collected: number;
    outstanding: number;
    collectionRate: number;
    pendingAdmissions: number;
    receiptsThisMonth: number;
    enrollmentByStage: { stage: string; students: number }[];
  };
  wards?: {
    id: string;
    name: string;
    section: string | null;
    todayMark: string | null;
    balance: number;
    recentResults: { exam: string; subject: string; total: number; grade: string }[];
  }[];
  /** الطالب: بياناته الخاصة فقط — لا حقول مالية/إدارية للمؤسسة */
  student?: {
    name: string;
    section: string | null;
    todayMark: string | null;
    attendanceRate: number | null;
    recentResults: { exam: string; subject: string; total: number; grade: string }[];
  } | null;
  /** المعلم: شعبه فقط — لا حقول مالية/إدارية للمؤسسة */
  teacher?: {
    sectionsCount: number;
    studentsCount: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    sections: { id: string; label: string; students: number }[];
  };
  /** الموارد البشرية: عدد الموظفين فقط */
  hr?: { totalEmployees: number; activeEmployees: number; onLeave: number };
  /** السائق: مساراته وطلابها فقط */
  driver?: { routesCount: number; studentsCount: number; routes: { id: string; name: string; students: number }[] };
  recentAudit: { id: string; userName: string; action: string; severity: string; createdAt: string }[];
}
