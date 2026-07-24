import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureKey } from "@manarah/shared";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { PageHeader, QueryError, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { Skeleton } from "../ui/skeleton";
import { ToggleLeft, Building2 } from "lucide-react";

/** إدارة أعلام الميزات لكل مؤسسة — SUPER_ADMIN فقط (قراءة/كتابة على مستوى المنصة) */
export function SchoolFeatures() {
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState("");

  const { data: tenants, isLoading: tenantsLoading, isError: tenantsError, error: tenantsErrObj, refetch: refetchTenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => api.tenants.list(),
  });

  const {
    data: featuresData,
    isLoading: featuresLoading,
    isError: featuresError,
    error: featuresErrObj,
    refetch: refetchFeatures,
  } = useQuery({
    queryKey: ["tenant-features", tenantId],
    queryFn: () => api.tenants.getTenantFeatures(tenantId),
    enabled: !!tenantId,
  });

  const toggle = useMutation({
    mutationFn: (payload: { key: FeatureKey; enabled: boolean }) =>
      api.tenants.updateTenantFeatures(tenantId, [payload]),
    onSuccess: (t, payload) => {
      qc.setQueryData(["tenant-features", tenantId], t);
      const name = tenantsById[tenantId]?.name ?? "";
      toast.success(`${payload.enabled ? "فُعّلت" : "عُطّلت"} الميزة لمؤسسة ${name}`.trim());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تحديث الميزة"),
  });

  const tenantsById = Object.fromEntries((tenants ?? []).map((t) => [t.id, t]));

  return (
    <div dir="rtl">
      <PageHeader
        title="ميزات المدارس"
        subtitle="تفعيل/تعطيل ميزات كل مؤسسة على حدة — تُطبَّق فورًا على واجهتها وسيرفرها"
      />

      <Card className="p-5 gap-4 mb-4">
        <div className="space-y-1.5">
          <label htmlFor="tenant-select" className="text-foreground flex items-center gap-2">
            <Building2 size={16} className="text-brand" /> اختر مؤسسة
          </label>
          {tenantsError ? (
            <QueryError error={tenantsErrObj} onRetry={() => refetchTenants()} />
          ) : (
            <select
              id="tenant-select"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={tenantsLoading}
              className="w-full h-9 rounded-md border border-input bg-input-background px-3"
            >
              <option value="">{tenantsLoading ? "جارٍ التحميل..." : "— اختر مؤسسة —"}</option>
              {(tenants ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.city ? `(${t.city})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {!tenantId ? (
        <EmptyState icon={ToggleLeft} title="اختر مؤسسة لعرض ميزاتها" hint="ستظهر هنا كل الميزات المتاحة وحالتها لهذه المؤسسة." />
      ) : featuresError ? (
        <QueryError error={featuresErrObj} onRetry={() => refetchFeatures()} />
      ) : (
        <Card className="p-5 gap-1">
          <h3 className="text-foreground mb-2">
            ميزات {tenantsById[tenantId]?.name ?? ""}
          </h3>
          {featuresLoading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : (
            (featuresData?.features ?? []).map((f) => (
              <div key={f.key} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3">
                <div className="text-foreground">{f.labelAr}</div>
                <Switch
                  checked={f.enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ key: f.key, enabled: v })}
                />
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
