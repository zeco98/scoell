import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TenantSettings } from "@manarah/api-client";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader } from "../shared";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { BRAND_NAME, LogoMark } from "../../brand/Logo";
import { Loader2, KeyRound } from "lucide-react";

const PALETTE = [
  ["Primary", "var(--brand)"],
  ["Brand Strong", "var(--brand-strong)"],
  ["Accent", "var(--brand-accent)"],
  ["Success", "var(--success)"],
  ["Warning", "var(--warning)"],
  ["Info", "var(--info)"],
  ["Danger", "var(--destructive)"],
];

const POLICY_LABELS: { key: keyof TenantSettings; label: string; hint: string }[] = [
  { key: "blockResultsOnDebt", label: "حجب النتائج عند وجود ديون", hint: "يُطبَّق في السيرفر على ولي الأمر والطالب" },
  { key: "autoAbsenceNotify", label: "إشعار ولي الأمر تلقائيًا عند الغياب", hint: "يُرسل فور حفظ التحضير" },
  { key: "easternNumerals", label: "استخدام الأرقام الهندية (١٢٣٤)", hint: "في العرض والتقارير" },
  { key: "darkMode", label: "تفعيل الوضع الداكن للمستخدمين", hint: "قريبًا في الواجهة" },
];

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const change = useMutation({
    mutationFn: () => api.auth.changePassword(current, next),
    onSuccess: () => {
      toast.success("غُيّرت كلمة المرور — سُجّلت العملية في التدقيق");
      setCurrent("");
      setNext("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تغيير كلمة المرور"),
  });

  return (
    <Card className="p-5 gap-3">
      <h3 className="text-foreground flex items-center gap-2"><KeyRound size={18} className="text-brand" /> تغيير كلمة المرور</h3>
      <div className="space-y-1.5">
        <label>كلمة المرور الحالية</label>
        <Input type="password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <label>كلمة المرور الجديدة</label>
        <Input type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <p className="text-muted-foreground">10 أحرف على الأقل وتحوي حروفًا وأرقامًا.</p>
      </div>
      <Button className="gap-2" disabled={!current || next.length < 10 || change.isPending} onClick={() => change.mutate()}>
        {change.isPending && <Loader2 size={16} className="animate-spin" />}
        تغيير كلمة المرور
      </Button>
    </Card>
  );
}

export function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEditPolicies = user?.role === "SCHOOL_ADMIN";
  const hasTenant = !!user?.tenantId;

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.tenants.mySettings(),
    enabled: hasTenant,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<TenantSettings>) => api.tenants.updateSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("حُفظت الإعدادات — سُجّل التعديل بقيمتيه في التدقيق");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حفظ الإعدادات"),
  });

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إعدادات المؤسسة، الهوية البصرية، والسياسات — تُحفظ في قاعدة البيانات" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 gap-4">
          <h3 className="text-foreground">الهوية البصرية</h3>
          <div className="flex items-center gap-3">
            <LogoMark size={48} />
            <div>
              <div className="text-foreground" style={{ fontWeight: 700 }}>{BRAND_NAME}</div>
              <div className="text-muted-foreground">هوية موحّدة على الويب وويندوز والموبايل</div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-2">لوحة الألوان (Design Tokens)</div>
            <div className="grid grid-cols-4 gap-2">
              {PALETTE.map(([name, c]) => (
                <div key={name} className="text-center">
                  <div className="h-12 rounded-lg border border-border" style={{ background: c }} />
                  <div className="text-muted-foreground mt-1">{name}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-muted-foreground">الخط: Cairo / IBM Plex Sans Arabic — RTL كامل، تباين WCAG AA.</div>
        </Card>

        {hasTenant ? (
          <Card className="p-5 gap-1">
            <h3 className="text-foreground mb-2">سياسات المؤسسة {data?.name ? `— ${data.name}` : ""}</h3>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : (
              POLICY_LABELS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3">
                  <div>
                    <div className="text-foreground">{label}</div>
                    <div className="text-muted-foreground">{hint}</div>
                  </div>
                  <Switch
                    checked={!!data?.settings?.[key]}
                    disabled={!canEditPolicies || update.isPending}
                    onCheckedChange={(v) => update.mutate({ [key]: v })}
                  />
                </div>
              ))
            )}
            {!canEditPolicies && <p className="text-muted-foreground mt-2">تعديل السياسات صلاحية مدير المدرسة.</p>}
          </Card>
        ) : (
          <Card className="p-5">
            <h3 className="text-foreground mb-2">سياسات المؤسسة</h3>
            <p className="text-muted-foreground">حسابات مستوى المنصة لا ترتبط بمؤسسة — افتح تفاصيل مؤسسة من «المدارس والاشتراكات».</p>
          </Card>
        )}

        <ChangePasswordCard />
      </div>
    </div>
  );
}
