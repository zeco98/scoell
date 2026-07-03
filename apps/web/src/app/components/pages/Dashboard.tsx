import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ROLE_LABELS, formatIQD } from "@manarah/shared";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, StatCard, SectionCard, StatusPill, QueryError } from "../shared";
import { Stagger, StaggerItem, CountUp } from "../motion";
import { Skeleton } from "../ui/skeleton";
import { Progress } from "../ui/progress";
import {
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  UserPlus,
  TrendingUp,
  GraduationCap,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function DashboardSkeleton() {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

function EnrollmentChart({ data }: { data: { stage: string; students: number }[] }) {
  return (
    <div style={{ width: "100%", height: 240 }} dir="ltr">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} reversed />
          <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} orientation="right" />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontFamily: "var(--font-arabic)" }} />
          <Bar dataKey="students" name="الطلبة" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const MARK_LABELS: Record<string, string> = { present: "حاضر ✓", absent: "غائب", late: "متأخر", early: "خروج مبكر" };

export function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.dashboard.get() });

  if (!user) return null;

  const header = (
    <PageHeader
      title={`أهلاً، ${user.name.split(" ")[0]} 👋`}
      subtitle={`لوحة ${ROLE_LABELS[user.role]} · ${user.tenantName ?? "المنصة"} · ${new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
    />
  );

  if (isError) {
    return (
      <div>
        {header}
        <QueryError error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        {header}
        <DashboardSkeleton />
      </div>
    );
  }

  const iqd = (n: number) => formatIQD(n);
  const grid = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6";

  return (
    <div>
      {header}

      {/* بطاقات المنصة — SUPER_ADMIN / AUDITOR */}
      {data.platform && (
        <Stagger className={grid}>
          <StaggerItem><StatCard icon={Building2} label="المؤسسات المشتركة" value="" render={<CountUp value={data.platform.totalTenants} />} /></StaggerItem>
          <StaggerItem><StatCard icon={Users} label="إجمالي الطلبة" value="" render={<CountUp value={data.platform.totalStudents} />} tone="info" /></StaggerItem>
          <StaggerItem><StatCard icon={TrendingUp} label="اشتراكات نشطة" value="" render={<CountUp value={data.platform.activeTenants} />} tone="success" /></StaggerItem>
          <StaggerItem><StatCard icon={AlertTriangle} label="اشتراكات موقوفة" value="" render={<CountUp value={data.platform.suspendedTenants} />} tone="danger" /></StaggerItem>
        </Stagger>
      )}

      {/* بطاقات المدرسة */}
      {data.school && (
        <Stagger className={grid}>
          <StaggerItem><StatCard icon={GraduationCap} label="الطلبة النشطون" value="" render={<CountUp value={data.school.activeStudents} />} /></StaggerItem>
          <StaggerItem><StatCard icon={CalendarCheck} label="حضور اليوم" value="" render={<CountUp value={data.school.presentToday} />} hint={`غياب ${data.school.absentToday} · تأخر ${data.school.lateToday}`} tone="success" /></StaggerItem>
          <StaggerItem><StatCard icon={Wallet} label="إجمالي التحصيل" value="" render={<CountUp value={data.school.collected} format={(n) => formatIQD(Math.round(n))} />} tone="info" /></StaggerItem>
          {user.role === "ACCOUNTANT" ? (
            <StaggerItem><StatCard icon={Receipt} label="سندات هذا الشهر" value="" render={<CountUp value={data.school.receiptsThisMonth} />} tone="brand" /></StaggerItem>
          ) : (
            <StaggerItem><StatCard icon={UserPlus} label="طلبات قبول معلقة" value="" render={<CountUp value={data.school.pendingAdmissions} />} tone="warning" /></StaggerItem>
          )}
        </Stagger>
      )}

      {/* بطاقات ولي الأمر — أبناؤه */}
      {data.wards && (
        <Stagger className="grid gap-4 sm:grid-cols-2 mb-6">
          {data.wards.map((w) => (
            <StaggerItem key={w.id}>
              <SectionCard title={w.name} action={<Link to={`/students/${w.id}`} className="text-brand hover:underline">الملف الكامل ←</Link>}>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="text-muted-foreground mb-1">اليوم</div>
                    {w.todayMark ? <StatusPill status={w.todayMark} /> : <span className="text-muted-foreground">لم يُسجَّل</span>}
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="text-muted-foreground mb-1">المتبقي</div>
                    <div className={w.balance > 0 ? "text-destructive" : "text-success"} style={{ fontWeight: 700 }}>
                      {w.balance > 0 ? iqd(w.balance) : "مسدد ✓"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="text-muted-foreground mb-1">آخر نتيجة</div>
                    <div className="text-brand" style={{ fontWeight: 700 }}>
                      {w.recentResults[0] ? `${w.recentResults[0].total}/100` : "—"}
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground">{w.section ?? "بلا شعبة"}{w.todayMark ? ` · ${MARK_LABELS[w.todayMark]}` : ""}</p>
              </SectionCard>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {data.school && (
          <SectionCard title="توزيع الطلبة حسب المرحلة" className="lg:col-span-2">
            <EnrollmentChart data={data.school.enrollmentByStage} />
          </SectionCard>
        )}
        {data.platform && (
          <SectionCard title="حالة الاشتراكات" className="lg:col-span-2">
            <div className="space-y-4">
              {data.platform.tenants.map((t) => (
                <div key={t.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-foreground truncate">{t.name}</span>
                    <StatusPill status={t.status} />
                  </div>
                  <Progress value={Math.min(100, (t.students / 1300) * 100)} />
                  <div className="text-muted-foreground mt-1">{t.students} طالب · خطة {t.plan}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {data.recentAudit.length > 0 && (
          <SectionCard title="آخر النشاطات">
            <div className="space-y-3">
              {data.recentAudit.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="size-2 rounded-full mt-2 shrink-0" style={{ background: a.severity === "critical" ? "var(--destructive)" : a.severity === "warning" ? "var(--warning)" : "var(--brand)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{a.action}</p>
                    <p className="text-muted-foreground">{a.userName} · {new Date(a.createdAt).toLocaleString("ar-IQ-u-nu-latn")}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {data.school && (
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          <SectionCard title="ملخص التحصيل">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">نسبة التحصيل</span>
              <span className="text-brand" style={{ fontWeight: 700 }}>{data.school.collectionRate}%</span>
            </div>
            <Progress value={data.school.collectionRate} />
            <div className="flex items-center justify-between mt-3">
              <span className="text-success">{iqd(data.school.collected)} محصَّل</span>
              <span className="text-destructive">{iqd(data.school.outstanding)} متبقٍ</span>
            </div>
          </SectionCard>
          <SectionCard title="ملخص حضور اليوم">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-success/10 p-4">
                <div className="text-success" style={{ fontSize: 24, fontWeight: 700 }}><CountUp value={data.school.presentToday} /></div>
                <div className="text-muted-foreground">حاضر</div>
              </div>
              <div className="rounded-xl bg-destructive/10 p-4">
                <div className="text-destructive" style={{ fontSize: 24, fontWeight: 700 }}><CountUp value={data.school.absentToday} /></div>
                <div className="text-muted-foreground">غائب</div>
              </div>
              <div className="rounded-xl bg-warning/10 p-4">
                <div className="text-warning" style={{ fontSize: 24, fontWeight: 700 }}><CountUp value={data.school.lateToday} /></div>
                <div className="text-muted-foreground">متأخر</div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
