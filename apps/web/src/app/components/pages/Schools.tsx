import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatNum } from "@manarah/shared";
import type { TenantItem } from "@manarah/api-client";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { PageHeader, StatusPill, QueryError } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Building2, MapPin, Users, GitBranch, Plus, Loader2 } from "lucide-react";

const PLAN_CLS: Record<string, string> = {
  Basic: "bg-muted text-muted-foreground",
  Pro: "bg-info/12 text-info",
  Enterprise: "bg-brand-soft text-brand",
};

const createTenantSchema = z.object({
  name: z.string().min(3, "اسم المؤسسة مطلوب"),
  city: z.string().optional(),
  plan: z.enum(["Basic", "Pro", "Enterprise"]),
  branches: z.number().int().min(1),
});
type CreateTenantDto = z.infer<typeof createTenantSchema>;

function CreateTenantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTenantDto>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { plan: "Basic", branches: 1 },
  });

  const create = useMutation({
    mutationFn: (dto: CreateTenantDto) => api.tenants.create(dto),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`أُضيفت مؤسسة «${t.name}» بحالة تجريبية`);
      reset({ plan: "Basic", branches: 1 });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إضافة المؤسسة"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>إضافة مؤسسة</DialogTitle>
          <DialogDescription>تبدأ بحالة «تجريبي» وتُفعَّل من تفاصيلها.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label>اسم المؤسسة</label>
            <Input {...register("name")} />
            {errors.name && <p className="text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <label>المدينة</label>
              <Input {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <label>الخطة</label>
              <select {...register("plan")} className="w-full h-9 rounded-md border border-input bg-input-background px-3">
                {["Basic", "Pro", "Enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label>الفروع</label>
              <Input type="number" dir="ltr" min={1} {...register("branches", { valueAsNumber: true })} />
            </div>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={create.isPending}>
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            إضافة
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageTenantDialog({ tenant, onClose }: { tenant: TenantItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const changeStatus = useMutation({
    mutationFn: (status: string) => api.tenants.changeStatus(tenant!.id, status),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`حُدّثت حالة ${t.name} — سُجّلت في التدقيق`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تحديث الحالة"),
  });

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        {tenant && (
          <>
            <DialogHeader className="text-right">
              <DialogTitle>إدارة {tenant.name}</DialogTitle>
              <DialogDescription>
                {tenant.city ?? "—"} · خطة {tenant.plan} · {formatNum(tenant.students ?? 0)} طالب · {formatNum(tenant.staff ?? 0)} مستخدم
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <label className="text-foreground">حالة الاشتراك</label>
              <div className="grid gap-1.5">
                {[
                  ["active", "نشط — تشغيل كامل"],
                  ["trial", "تجريبي — فترة تقييم"],
                  ["suspended", "موقوف — يمنع الدخول"],
                ].map(([st, label]) => (
                  <Button
                    key={st}
                    variant={tenant.status === st ? "default" : "outline"}
                    disabled={changeStatus.isPending || tenant.status === st}
                    onClick={() => changeStatus.mutate(st)}
                    className="justify-start"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Schools() {
  const [createOpen, setCreateOpen] = useState(false);
  const [managing, setManaging] = useState<TenantItem | null>(null);

  const { data: tenants, isLoading, isError, error, refetch } = useQuery({ queryKey: ["tenants"], queryFn: () => api.tenants.list() });

  return (
    <div>
      <PageHeader
        title="المدارس والاشتراكات"
        subtitle="إدارة المؤسسات المشتركة في المنصة (Multi-Tenant)"
        action={
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus size={17} /> إضافة مؤسسة
          </Button>
        }
      />

      {isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
          {(tenants ?? []).map((s) => (
            <Card key={s.id} className="p-5 gap-3">
              <div className="flex items-start justify-between">
                <div className="size-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center"><Building2 size={22} /></div>
                <StatusPill status={s.status} />
              </div>
              <div>
                <div className="text-foreground" style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="text-muted-foreground flex items-center gap-1"><MapPin size={13} /> {s.city ?? "—"}</div>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1"><Users size={14} /> {formatNum(s.students ?? 0)}</span>
                <span className="flex items-center gap-1"><GitBranch size={14} /> {s.branches} فروع</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className={`px-2.5 py-1 rounded-full ${PLAN_CLS[s.plan]}`}>خطة {s.plan}</span>
                <Button size="sm" variant="ghost" onClick={() => setManaging(s)}>إدارة</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <h3 className="text-foreground mb-3">جدول المؤسسات</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المؤسسة</TableHead>
                <TableHead className="text-right">المدينة</TableHead>
                <TableHead className="text-right">الطلبة</TableHead>
                <TableHead className="text-right">المستخدمون</TableHead>
                <TableHead className="text-right">الخطة</TableHead>
                <TableHead className="text-right">تاريخ الاشتراك</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tenants ?? []).map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setManaging(s)}>
                  <TableCell className="text-foreground">{s.name}</TableCell>
                  <TableCell>{s.city ?? "—"}</TableCell>
                  <TableCell>{formatNum(s.students ?? 0)}</TableCell>
                  <TableCell>{formatNum(s.staff ?? 0)}</TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded-full ${PLAN_CLS[s.plan]}`}>{s.plan}</span></TableCell>
                  <TableCell dir="ltr">{new Date(s.createdAt).toISOString().slice(0, 10)}</TableCell>
                  <TableCell><StatusPill status={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CreateTenantDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ManageTenantDialog tenant={managing} onClose={() => setManaging(null)} />
    </div>
  );
}
