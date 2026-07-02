import type { AppUser } from "../../data/mock";
import {
  STATS,
  formatIQD,
  formatNum,
  COLLECTION_TREND,
  ENROLLMENT_BY_STAGE,
  SCHOOLS,
  AUDIT_LOG,
  ATTENDANCE_TODAY,
  EXAM_RESULTS,
  STUDENTS,
  FEES,
  ROLE_LABELS,
} from "../../data/mock";
import { PageHeader, StatCard, SectionCard, StatusPill } from "../shared";
import { Progress } from "../ui/progress";
import {
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  UserPlus,
  TrendingUp,
  GraduationCap,
  ClipboardList,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function TrendChart() {
  return (
    <div style={{ width: "100%", height: 240 }} dir="ltr">
      <ResponsiveContainer>
        <AreaChart data={COLLECTION_TREND} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} reversed />
          <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} orientation="right" />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontFamily: "var(--font-arabic)" }} />
          <Area type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2.5} fill="url(#g1)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EnrollmentChart() {
  return (
    <div style={{ width: "100%", height: 240 }} dir="ltr">
      <ResponsiveContainer>
        <BarChart data={ENROLLMENT_BY_STAGE} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} reversed />
          <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} orientation="right" />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontFamily: "var(--font-arabic)" }} />
          <Bar dataKey="students" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentActivity() {
  return (
    <SectionCard title="آخر النشاطات">
      <div className="space-y-3">
        {AUDIT_LOG.slice(0, 5).map((a) => (
          <div key={a.id} className="flex items-start gap-3">
            <div className="size-2 rounded-full mt-2 shrink-0" style={{ background: a.severity === "critical" ? "var(--destructive)" : a.severity === "warning" ? "var(--warning)" : "var(--brand)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-foreground truncate">{a.action}</p>
              <p className="text-muted-foreground">{a.user} · {a.createdAt}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function Dashboard({ user }: { user: AppUser }) {
  const role = user.role;
  const collectionRate = Math.round((STATS.collected / (STATS.collected + STATS.outstanding)) * 100);

  return (
    <div>
      <PageHeader
        title={`أهلاً، ${user.name.split(" ")[0]} 👋`}
        subtitle={`لوحة ${ROLE_LABELS[role]} · ${user.tenant} · ${new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
      />

      {/* بطاقات إحصائية حسب الدور */}
      {role === "SUPER_ADMIN" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={Building2} label="المؤسسات المشتركة" value={formatNum(STATS.totalSchools)} trend={12} hint="هذا الربع" />
          <StatCard icon={Users} label="إجمالي الطلبة" value={formatNum(STATS.totalStudents)} trend={8} tone="info" />
          <StatCard icon={TrendingUp} label="اشتراكات نشطة" value={formatNum(SCHOOLS.filter((s) => s.status === "active").length)} tone="success" />
          <StatCard icon={AlertTriangle} label="اشتراكات موقوفة" value={formatNum(SCHOOLS.filter((s) => s.status === "suspended").length)} tone="danger" />
        </div>
      )}

      {(role === "SCHOOL_ADMIN") && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={GraduationCap} label="الطلبة النشطون" value={formatNum(STATS.activeStudents)} trend={5} />
          <StatCard icon={CalendarCheck} label="حضور اليوم" value={formatNum(STATS.presentToday)} hint={`غياب ${STATS.absentToday} · تأخّر ${STATS.lateToday}`} tone="success" />
          <StatCard icon={Wallet} label="التحصيل الشهري" value={formatIQD(STATS.collected)} trend={9} tone="info" />
          <StatCard icon={UserPlus} label="طلبات قبول معلّقة" value={formatNum(STATS.pendingAdmissions)} tone="warning" />
        </div>
      )}

      {role === "ACCOUNTANT" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={Wallet} label="إجمالي التحصيل" value={formatIQD(STATS.collected)} trend={9} tone="success" />
          <StatCard icon={AlertTriangle} label="الديون المتأخرة" value={formatIQD(STATS.outstanding)} tone="danger" />
          <StatCard icon={TrendingUp} label="نسبة التحصيل" value={`${collectionRate}%`} tone="info" />
          <StatCard icon={ClipboardList} label="سندات هذا الشهر" value={formatNum(14)} tone="brand" />
        </div>
      )}

      {role === "TEACHER" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={BookOpen} label="شعبي الدراسية" value={formatNum(4)} />
          <StatCard icon={CalendarCheck} label="تحضير اليوم" value="2 / 4" hint="بقي شعبتان" tone="warning" />
          <StatCard icon={ClipboardList} label="درجات معلّقة" value={formatNum(23)} tone="info" />
          <StatCard icon={Users} label="طلابي" value={formatNum(112)} tone="success" />
        </div>
      )}

      {role === "PARENT" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={GraduationCap} label="الأبناء" value={formatNum(2)} />
          <StatCard icon={CalendarCheck} label="نسبة الحضور" value="94%" tone="success" />
          <StatCard icon={ClipboardList} label="معدّل الأبناء" value="88.5" tone="info" />
          <StatCard icon={Wallet} label="المتبقي عليك" value={formatIQD(500000)} tone="danger" />
        </div>
      )}

      {role === "STUDENT" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={ClipboardList} label="معدّلي العام" value="89.2" tone="success" />
          <StatCard icon={CalendarCheck} label="نسبة حضوري" value="96%" tone="info" />
          <StatCard icon={BookOpen} label="موادي" value={formatNum(9)} />
          <StatCard icon={ClipboardList} label="واجبات معلّقة" value={formatNum(3)} tone="warning" />
        </div>
      )}

      {role === "AUDITOR" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={ClipboardList} label="عمليات مسجّلة اليوم" value={formatNum(AUDIT_LOG.length)} />
          <StatCard icon={AlertTriangle} label="عمليات حرجة" value={formatNum(AUDIT_LOG.filter((a) => a.severity === "critical").length)} tone="danger" />
          <StatCard icon={AlertTriangle} label="تحذيرات" value={formatNum(AUDIT_LOG.filter((a) => a.severity === "warning").length)} tone="warning" />
          <StatCard icon={Building2} label="المؤسسات المراقَبة" value={formatNum(STATS.totalSchools)} tone="info" />
        </div>
      )}

      {/* الرسوم البيانية + النشاطات */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title={role === "ACCOUNTANT" || role === "SUPER_ADMIN" ? "اتجاه التحصيل (مليون د.ع)" : "توزيع الطلبة حسب المرحلة"} className="lg:col-span-2">
          {role === "ACCOUNTANT" || role === "SUPER_ADMIN" ? <TrendChart /> : <EnrollmentChart />}
        </SectionCard>
        <RecentActivity />
      </div>

      {/* صف سياقي إضافي */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        {(role === "SCHOOL_ADMIN" || role === "ACCOUNTANT") && (
          <SectionCard title="أعلى المديونيات">
            <div className="space-y-3">
              {FEES.filter((f) => f.status !== "paid").slice(0, 5).map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground truncate">{f.student}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-destructive">{formatIQD(f.total - f.paid)}</span>
                    <StatusPill status={f.status} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {(role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "STUDENT" || role === "PARENT") && (
          <SectionCard title="أوائل الطلبة">
            <div className="space-y-3">
              {EXAM_RESULTS.slice(0, 5).map((r) => (
                <div key={r.studentId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-brand-soft text-brand flex items-center justify-center">{r.rank}</span>
                    <span className="text-foreground truncate">{r.name}</span>
                  </div>
                  <span className="text-brand">{r.total} / 100</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {(role === "SUPER_ADMIN") && (
          <SectionCard title="حالة الاشتراكات">
            <div className="space-y-4">
              {SCHOOLS.slice(0, 4).map((s) => (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-foreground truncate">{s.name}</span>
                    <StatusPill status={s.status} />
                  </div>
                  <Progress value={Math.min(100, (s.students / 1300) * 100)} />
                  <div className="text-muted-foreground mt-1">{formatNum(s.students)} طالب · خطة {s.plan}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {(role === "SCHOOL_ADMIN" || role === "TEACHER") && (
          <SectionCard title="ملخّص حضور اليوم">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-success/10 p-4">
                <div className="text-success" style={{ fontSize: 24, fontWeight: 700 }}>{ATTENDANCE_TODAY.filter((a) => a.mark === "present").length}</div>
                <div className="text-muted-foreground">حاضر</div>
              </div>
              <div className="rounded-xl bg-destructive/10 p-4">
                <div className="text-destructive" style={{ fontSize: 24, fontWeight: 700 }}>{ATTENDANCE_TODAY.filter((a) => a.mark === "absent").length}</div>
                <div className="text-muted-foreground">غائب</div>
              </div>
              <div className="rounded-xl bg-warning/10 p-4">
                <div className="text-warning" style={{ fontSize: 24, fontWeight: 700 }}>{ATTENDANCE_TODAY.filter((a) => a.mark === "late").length}</div>
                <div className="text-muted-foreground">متأخر</div>
              </div>
            </div>
            <p className="text-muted-foreground mt-1">من أصل {formatNum(STUDENTS.length)} طالب مسجّل في الشعب.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
