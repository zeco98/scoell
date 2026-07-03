import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStudentSchema, formatIQD, type CreateStudentDto } from "@manarah/shared";
import type { CsvImportReport } from "@manarah/api-client";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, StatusPill, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Search, UserPlus, Upload, Users, Loader2, ChevronRight, ChevronLeft, FileWarning, CheckCircle2 } from "lucide-react";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشط" },
  { key: "suspended", label: "موقوف" },
  { key: "graduated", label: "متخرّج" },
  { key: "withdrawn", label: "منسحب" },
];

const PAGE_SIZE = 15;

// ---------------------------------------------------------------- نموذج تسجيل طالب (متعدد الخطوات)
function CreateStudentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const steps = ["بيانات الطالب", "وليّ الأمر", "معلومات إضافية"];

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentDto>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { gender: "MALE" as const },
  });

  const create = useMutation({
    mutationFn: (dto: CreateStudentDto) => api.students.create(dto),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`تم تسجيل الطالب ${s.name}`, { description: `الرقم: ${s.code} — سُجّلت العملية في سجل التدقيق.` });
      reset();
      setStep(0);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تسجيل الطالب"),
  });

  async function next() {
    const fields: (keyof CreateStudentDto)[][] = [
      ["name", "gender", "stage", "section"],
      ["guardianName", "guardianPhone"],
      [],
    ];
    if (await trigger(fields[step])) setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  const field = (label: string, name: keyof CreateStudentDto, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <label className="text-foreground">{label}</label>
      <Input {...register(name)} aria-invalid={!!errors[name]} {...props} />
      {errors[name] && <p className="text-destructive">{errors[name]?.message as string}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>تسجيل طالب جديد</DialogTitle>
          <DialogDescription>
            الخطوة {step + 1} من {steps.length}: {steps[step]}
          </DialogDescription>
        </DialogHeader>

        {/* مؤشر الخطوات */}
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-brand" : "bg-muted"}`} />
          ))}
        </div>

        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          {step === 0 && (
            <>
              {field("اسم الطالب الثلاثي", "name", { placeholder: "مثال: أحمد علي الساعدي" })}
              <div className="space-y-1.5">
                <label className="text-foreground">الجنس</label>
                <select {...register("gender")} className="w-full h-9 rounded-md border border-input bg-input-background px-3">
                  <option value="MALE">ذكر</option>
                  <option value="FEMALE">أنثى</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field("المرحلة", "stage", { placeholder: "الرابع علمي" })}
                {field("الشعبة", "section", { placeholder: "أ" })}
              </div>
              {field("تاريخ الميلاد (اختياري)", "birthDate", { type: "date", dir: "ltr" })}
            </>
          )}
          {step === 1 && (
            <>
              {field("اسم وليّ الأمر", "guardianName")}
              {field("هاتف وليّ الأمر", "guardianPhone", { placeholder: "07XXXXXXXXX", dir: "ltr" })}
              {field("بريد وليّ الأمر (اختياري)", "guardianEmail", { type: "email", dir: "ltr" })}
            </>
          )}
          {step === 2 && (
            <>
              {field("العنوان (اختياري)", "address")}
              <div className="space-y-1.5">
                <label className="text-foreground">ملاحظات صحية (اختياري)</label>
                <textarea
                  {...register("healthNotes")}
                  className="w-full min-h-20 rounded-lg bg-input-background border border-transparent p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="حساسية، أمراض مزمنة..."
                />
              </div>
              <p className="text-muted-foreground">رفع الوثائق (هوية، بطاقة سكن...) متاح من صفحة ملف الطالب بعد التسجيل.</p>
            </>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="gap-1">
              <ChevronRight size={16} /> السابق
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" onClick={next} className="gap-1">
                التالي <ChevronLeft size={16} />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || create.isPending} className="gap-2">
                {create.isPending && <Loader2 size={16} className="animate-spin" />}
                تسجيل الطالب
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- استيراد CSV
function ImportCsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<CsvImportReport | null>(null);

  const importCsv = useMutation({
    mutationFn: (file: File) => api.students.importCsv(file),
    onSuccess: (r) => {
      setReport(r);
      qc.invalidateQueries({ queryKey: ["students"] });
      if (r.created > 0) toast.success(`استُورد ${r.created} طالبًا من ${r.total} صف`);
      if (r.rejected > 0) toast.warning(`${r.rejected} صف مرفوض — راجع تقرير الأخطاء`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الاستيراد"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setReport(null); onClose(); } }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>استيراد طلبة من CSV</DialogTitle>
          <DialogDescription dir="ltr" className="text-left font-mono" style={{ fontSize: 12 }}>
            name,gender,stage,section,guardianName,guardianPhone
          </DialogDescription>
        </DialogHeader>

        {!report ? (
          <div className="space-y-3">
            <input ref={fileRef} type="file" accept=".csv" className="w-full rounded-lg border border-dashed border-border p-6 text-muted-foreground" />
            <Button
              className="w-full gap-2"
              disabled={importCsv.isPending}
              onClick={() => {
                const f = fileRef.current?.files?.[0];
                if (!f) return toast.error("اختر ملف CSV أولًا");
                importCsv.mutate(f);
              }}
            >
              {importCsv.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importCsv.isPending ? "جارٍ الاستيراد..." : "استيراد"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 p-3"><div style={{ fontWeight: 700 }}>{report.total}</div><div className="text-muted-foreground">صفوف</div></div>
              <div className="rounded-lg bg-success/10 p-3 text-success"><div style={{ fontWeight: 700 }}>{report.created}</div><div>نجحت</div></div>
              <div className="rounded-lg bg-destructive/10 p-3 text-destructive"><div style={{ fontWeight: 700 }}>{report.rejected}</div><div>رُفضت</div></div>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {report.report.map((r) => (
                <div key={r.row} className="flex items-center gap-2 p-2.5">
                  {r.ok ? <CheckCircle2 size={16} className="text-success shrink-0" /> : <FileWarning size={16} className="text-destructive shrink-0" />}
                  <span className="text-muted-foreground">صف {r.row}</span>
                  <span className="text-foreground truncate">{r.name ?? "—"}</span>
                  {r.error && <span className="text-destructive mr-auto">{r.error}</span>}
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setReport(null); onClose(); }}>إغلاق</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- الصفحة
export function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["students", { q, filter, page }],
    queryFn: () => api.students.list({ query: q || undefined, status: filter, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isAdmin = user?.role === "SCHOOL_ADMIN";

  return (
    <div>
      <PageHeader
        title="الطلبة"
        subtitle={data ? `${data.total} طالب مسجّل · إدارة الملفات والحالات والنقل` : "..."}
        action={
          isAdmin && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload size={17} /> استيراد CSV
              </Button>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <UserPlus size={17} /> تسجيل طالب
              </Button>
            </>
          )
        }
      />

      <Card className="p-4 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="pr-10 bg-input-background border-transparent"
              placeholder="بحث بالاسم أو ولي الأمر أو الرقم"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => { setFilter(f.key); setPage(1); }}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Users} title="لا توجد نتائج مطابقة" hint="جرّب تعديل البحث أو الفلتر." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">المرحلة / الشعبة</TableHead>
                    <TableHead className="text-right">وليّ الأمر</TableHead>
                    <TableHead className="text-right">الحضور</TableHead>
                    <TableHead className="text-right">المعدّل</TableHead>
                    <TableHead className="text-right">المتبقّي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-brand-soft text-brand flex items-center justify-center">{s.name.charAt(0)}</div>
                          <div>
                            <div className="text-foreground">{s.name}</div>
                            <div className="text-muted-foreground">{s.code} · {s.gender === "FEMALE" ? "أنثى" : "ذكر"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{s.section ? `${s.section.stage} / ${s.section.name}` : "—"}</TableCell>
                      <TableCell>{s.guardianName}</TableCell>
                      <TableCell>{s.attendanceRate != null ? `${s.attendanceRate}%` : "—"}</TableCell>
                      <TableCell>{s.gpa ?? "—"}</TableCell>
                      <TableCell className={s.balance && s.balance > 0 ? "text-destructive" : "text-success"}>
                        {s.balance && s.balance > 0 ? formatIQD(s.balance) : "مسدّد"}
                      </TableCell>
                      <TableCell><StatusPill status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ترقيم server-side */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">
                صفحة {page} من {totalPages} · {data.total} طالب
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <CreateStudentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
