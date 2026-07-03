import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatIQD } from "@manarah/shared";
import type { EmployeeItem } from "@manarah/api-client";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, StatCard, StatusPill, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Users, UserPlus, Briefcase, Loader2 } from "lucide-react";

const employeeSchema = z.object({
  name: z.string().min(3, "اسم الموظف مطلوب"),
  title: z.string().min(2, "المسمى الوظيفي مطلوب"),
  phone: z.string().regex(/^07\d{9}$/, "رقم هاتف صالح مطلوب").optional().or(z.literal("")),
  contractType: z.enum(["full_time", "part_time", "contract"]),
  salary: z.number().int().positive("الراتب رقم موجب").optional(),
});
type EmployeeDto = z.infer<typeof employeeSchema>;

const CONTRACT_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  contract: "عقد",
};

const STATUS_LABELS: Record<string, string> = {
  active: "على رأس العمل",
  on_leave: "إجازة",
  terminated: "منتهي الخدمة",
};

function EmployeeDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: EmployeeItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeDto>({
    resolver: zodResolver(employeeSchema),
    values: editing
      ? {
          name: editing.name,
          title: editing.title,
          phone: editing.phone ?? "",
          contractType: editing.contractType as EmployeeDto["contractType"],
          salary: editing.salary ?? undefined,
        }
      : undefined,
    defaultValues: { contractType: "full_time" },
  });

  const save = useMutation({
    mutationFn: (dto: EmployeeDto) =>
      editing ? api.hr.update(editing.id, dto) : api.hr.create(dto),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editing ? `حُدّث ملف ${e.name}` : `أُضيف الموظف ${e.name}`, { description: "سُجّلت العملية في التدقيق." });
      reset({ contractType: "full_time" });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>{editing ? `تعديل ملف ${editing.name}` : "إضافة موظف"}</DialogTitle>
          <DialogDescription>ملف الموظف الأساسي — عقود وحضور الموظفين في الإصدارات القادمة.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label>الاسم الثلاثي</label>
            <Input {...register("name")} />
            {errors.name && <p className="text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label>المسمى الوظيفي</label>
              <Input {...register("title")} placeholder="معلم رياضيات" />
              {errors.title && <p className="text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label>الهاتف</label>
              <Input {...register("phone")} dir="ltr" placeholder="07XXXXXXXXX" />
              {errors.phone && <p className="text-destructive">{errors.phone.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label>نوع العقد</label>
              <select {...register("contractType")} className="w-full h-9 rounded-md border border-input bg-input-background px-3">
                {Object.entries(CONTRACT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label>الراتب (د.ع)</label>
              <Input type="number" dir="ltr" {...register("salary", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })} />
              {errors.salary && <p className="text-destructive">{errors.salary.message}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={save.isPending}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {editing ? "حفظ التعديلات" : "إضافة الموظف"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Hr() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeItem | null>(null);

  const canEdit = user?.role === "HR";

  const { data: employees, isLoading } = useQuery({ queryKey: ["employees"], queryFn: () => api.hr.list() });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.hr.update(id, { status } as Partial<EmployeeItem>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("حُدّثت حالة الموظف — سُجّلت في التدقيق");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل التحديث"),
  });

  const active = (employees ?? []).filter((e) => e.status === "active").length;
  const payroll = (employees ?? []).reduce((a, e) => a + (e.status === "active" ? (e.salary ?? 0) : 0), 0);

  return (
    <div>
      <PageHeader
        title="الموارد البشرية"
        subtitle="ملفات الموظفين والعقود — حضور الموظفين وPayroll في خارطة الطريق"
        action={
          canEdit && (
            <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <UserPlus size={17} /> إضافة موظف
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard icon={Users} label="إجمالي الموظفين" value={String(employees?.length ?? 0)} />
        <StatCard icon={Briefcase} label="على رأس العمل" value={String(active)} tone="success" />
        <StatCard icon={Briefcase} label="كتلة الرواتب الشهرية" value={formatIQD(payroll)} tone="info" />
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (employees ?? []).length === 0 ? (
          <EmptyState icon={Users} title="لا موظفين بعد" hint={canEdit ? "أضف أول موظف." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">المسمى</TableHead>
                  <TableHead className="text-right">العقد</TableHead>
                  <TableHead className="text-right">الراتب</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  {canEdit && <TableHead className="text-right"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(employees ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-foreground">{e.name}</TableCell>
                    <TableCell>{e.title}</TableCell>
                    <TableCell>{CONTRACT_LABELS[e.contractType] ?? e.contractType}</TableCell>
                    <TableCell>{e.salary ? formatIQD(e.salary) : "—"}</TableCell>
                    <TableCell dir="ltr">{e.phone ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full ${e.status === "active" ? "bg-success/12 text-success" : e.status === "on_leave" ? "bg-warning/12 text-warning" : "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setDialogOpen(true); }}>تعديل</Button>
                          {e.status === "active" ? (
                            <Button size="sm" variant="ghost" className="text-warning" onClick={() => changeStatus.mutate({ id: e.id, status: "on_leave" })}>إجازة</Button>
                          ) : e.status === "on_leave" ? (
                            <Button size="sm" variant="ghost" className="text-success" onClick={() => changeStatus.mutate({ id: e.id, status: "active" })}>إعادة</Button>
                          ) : null}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <EmployeeDialog open={dialogOpen} editing={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
    </div>
  );
}
