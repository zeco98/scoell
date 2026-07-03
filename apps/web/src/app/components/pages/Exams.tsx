import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, StatusPill, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { FileText, Printer, Plus, Loader2, ClipboardList, Save, PencilLine } from "lucide-react";

const createExamSchema = z.object({
  name: z.string().min(2, "اسم الامتحان مطلوب"),
  subject: z.string().min(2, "المادة مطلوبة"),
  sectionId: z.string().min(1, "اختر الشعبة"),
  year: z.string().min(4, "العام الدراسي مطلوب"),
});
type CreateExamDto = z.infer<typeof createExamSchema>;

function gradeTone(t: number) {
  return t >= 90 ? "accepted" : t >= 80 ? "interview" : t >= 70 ? "new" : t >= 60 ? "reviewing" : "withdrawn";
}

// ---------------------------------------------------------------- إنشاء امتحان
function CreateExamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: sections } = useQuery({ queryKey: ["sections"], queryFn: () => api.sections.list(), enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateExamDto>({
    resolver: zodResolver(createExamSchema),
    defaultValues: { year: "2025-2026" },
  });

  const create = useMutation({
    mutationFn: (dto: CreateExamDto) => api.exams.create(dto),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success(`أُنشئ امتحان «${e.name}» — سُجّل في التدقيق`);
      reset({ year: "2025-2026" });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إنشاء الامتحان"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>امتحان جديد</DialogTitle>
          <DialogDescription>الأوزان: شهري 20 + نصف السنة 30 + نهائي 50.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label>اسم الامتحان</label>
            <Input {...register("name")} placeholder="الامتحان النهائي" />
            {errors.name && <p className="text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label>المادة</label>
              <Input {...register("subject")} placeholder="الرياضيات" />
              {errors.subject && <p className="text-destructive">{errors.subject.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label>العام الدراسي</label>
              <Input {...register("year")} dir="ltr" />
              {errors.year && <p className="text-destructive">{errors.year.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label>الشعبة</label>
            <select {...register("sectionId")} className="w-full h-9 rounded-md border border-input bg-input-background px-3">
              <option value="">اختر الشعبة...</option>
              {(sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.label} ({s.studentCount} طالب)</option>
              ))}
            </select>
            {errors.sectionId && <p className="text-destructive">{errors.sectionId.message}</p>}
          </div>
          <Button type="submit" className="w-full gap-2" disabled={create.isPending}>
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            إنشاء الامتحان
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- شبكة إدخال الدرجات (تنقل كيبورد)
interface GridRow {
  studentId: string;
  name: string;
  monthly: number;
  midterm: number;
  finalExam: number;
}

function GradeGrid({ examId, sectionId, onDone }: { examId: string; sectionId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<GridRow[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const MAX = { monthly: 20, midterm: 30, finalExam: 50 } as const;
  const COLS = ["monthly", "midterm", "finalExam"] as const;

  const { data: students } = useQuery({
    queryKey: ["sections", sectionId, "students"],
    queryFn: () => api.sections.students(sectionId),
  });
  const { data: existing } = useQuery({
    queryKey: ["exams", examId, "results"],
    queryFn: () => api.exams.results(examId),
  });

  useEffect(() => {
    if (students && existing) {
      const map = new Map(existing.results.map((r) => [r.studentId, r]));
      setRows(
        students.map((s) => {
          const r = map.get(s.id);
          return {
            studentId: s.id,
            name: s.name,
            monthly: r?.monthly ?? 0,
            midterm: r?.midterm ?? 0,
            finalExam: r?.finalExam ?? 0,
          };
        }),
      );
    }
  }, [students, existing]);

  const save = useMutation({
    mutationFn: () =>
      api.exams.saveResults(
        examId,
        rows.map(({ studentId, monthly, midterm, finalExam }) => ({ studentId, monthly, midterm, finalExam })),
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success(`حُفظت الدرجات: ${r.created} جديدة، ${r.updated} معدّلة`, {
        description: r.updated > 0 ? "كل تعديل سُجّل بقيمته القديمة والجديدة في التدقيق." : "سُجّلت في التدقيق.",
      });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حفظ الدرجات"),
  });

  function setCell(i: number, col: keyof typeof MAX, value: number) {
    const v = Math.max(0, Math.min(MAX[col], value));
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [col]: v } : r)));
  }

  /** تنقّل مثل Excel: أسهم + Enter للأسفل + Tab افتراضي */
  function onKey(e: React.KeyboardEvent<HTMLInputElement>, row: number, colIdx: number) {
    const move = (r: number, c: number) => {
      const target = gridRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${r}-${c}"]`);
      if (target) {
        e.preventDefault();
        target.focus();
        target.select();
      }
    };
    if (e.key === "Enter" || e.key === "ArrowDown") move(row + 1, colIdx);
    else if (e.key === "ArrowUp") move(row - 1, colIdx);
    else if (e.key === "ArrowRight") move(row, colIdx - 1); // RTL
    else if (e.key === "ArrowLeft") move(row, colIdx + 1);
  }

  return (
    <div ref={gridRef}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-muted-foreground">تنقّل بالأسهم وEnter مثل Excel · الحد الأقصى: شهري 20، نصف السنة 30، نهائي 50.</p>
        <Button className="gap-2" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ الدرجات
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الطالب</TableHead>
              <TableHead className="text-right">الشهري (20)</TableHead>
              <TableHead className="text-right">نصف السنة (30)</TableHead>
              <TableHead className="text-right">النهائي (50)</TableHead>
              <TableHead className="text-right">المجموع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.studentId}>
                <TableCell className="text-foreground">{r.name}</TableCell>
                {COLS.map((col, ci) => (
                  <TableCell key={col}>
                    <Input
                      data-cell={`${i}-${ci}`}
                      type="number"
                      dir="ltr"
                      className="w-20 h-8 text-center"
                      value={r[col]}
                      min={0}
                      max={MAX[col]}
                      onChange={(e) => setCell(i, col, Number(e.target.value))}
                      onKeyDown={(e) => onKey(e, i, ci)}
                      onFocus={(e) => e.target.select()}
                    />
                  </TableCell>
                ))}
                <TableCell className="text-brand" style={{ fontWeight: 700 }}>{r.monthly + r.midterm + r.finalExam}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- الصفحة
export function Exams() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [editing, setEditing] = useState(false);

  const canEdit = user?.role === "SCHOOL_ADMIN" || user?.role === "TEACHER";

  const { data: exams, isLoading: examsLoading } = useQuery({ queryKey: ["exams"], queryFn: () => api.exams.list() });

  useEffect(() => {
    if (!selectedExamId && exams?.length) setSelectedExamId(exams[0].id);
  }, [exams, selectedExamId]);

  const selectedExam = useMemo(() => exams?.find((e) => e.id === selectedExamId), [exams, selectedExamId]);

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ["exams", selectedExamId, "results"],
    queryFn: () => api.exams.results(selectedExamId),
    enabled: !!selectedExamId && !editing,
  });

  return (
    <div>
      <PageHeader
        title="الامتحانات والنتائج"
        subtitle={selectedExam ? `${selectedExam.name} — ${selectedExam.subject} · ${selectedExam.section ? `${selectedExam.section.stage}/${selectedExam.section.name}` : ""}` : "إدخال الدرجات وإصدار الكشوف"}
        action={
          canEdit && (
            <div className="flex gap-2">
              {selectedExam && (
                <Button variant="outline" className="gap-2" onClick={() => setEditing((v) => !v)}>
                  <PencilLine size={16} /> {editing ? "عرض النتائج" : "إدخال الدرجات"}
                </Button>
              )}
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus size={17} /> امتحان جديد
              </Button>
            </div>
          )
        }
      />

      {/* اختيار الامتحان */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {examsLoading && <Skeleton className="h-9 w-72 rounded-lg" />}
        {(exams ?? []).map((e) => (
          <Button key={e.id} size="sm" variant={selectedExamId === e.id ? "default" : "outline"} onClick={() => { setSelectedExamId(e.id); setEditing(false); }}>
            {e.name} · {e.subject}
          </Button>
        ))}
      </div>

      {!selectedExam ? (
        !examsLoading && (
          <Card className="p-4">
            <EmptyState icon={ClipboardList} title="لا امتحانات بعد" hint={canEdit ? "أنشئ أول امتحان لبدء إدخال الدرجات." : "لم تُنشأ امتحانات بعد."} />
          </Card>
        )
      ) : editing && canEdit ? (
        <Card className="p-4">
          <GradeGrid examId={selectedExam.id} sectionId={selectedExam.section!.id} onDone={() => setEditing(false)} />
        </Card>
      ) : (
        <Card className="p-4">
          {resultsLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : !resultsData || resultsData.results.length === 0 ? (
            <EmptyState icon={ClipboardList} title="لا درجات مدخلة بعد" hint={canEdit ? "استخدم زر «إدخال الدرجات» أعلاه." : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-12">الترتيب</TableHead>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">الشهري (20)</TableHead>
                    <TableHead className="text-right">نصف السنة (30)</TableHead>
                    <TableHead className="text-right">النهائي (50)</TableHead>
                    <TableHead className="text-right">المجموع</TableHead>
                    <TableHead className="text-right">التقدير</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultsData.results.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className={`size-7 rounded-full flex items-center justify-center ${r.rank && r.rank <= 3 ? "bg-brand-accent/20 text-warning" : "bg-muted text-muted-foreground"}`}>
                          {r.rank ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground">{r.student.name}</TableCell>
                      {r.total < 0 ? (
                        <TableCell colSpan={4} className="text-warning">{r.grade}</TableCell>
                      ) : (
                        <>
                          <TableCell>{r.monthly}</TableCell>
                          <TableCell>{r.midterm}</TableCell>
                          <TableCell>{r.finalExam}</TableCell>
                          <TableCell className="text-brand" style={{ fontWeight: 700 }}>{r.total}</TableCell>
                        </>
                      )}
                      {r.total >= 0 && <TableCell><StatusPill status={gradeTone(r.total)} /></TableCell>}
                      <TableCell>
                        {r.total >= 0 && (
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(api.exams.reportCardUrl(selectedExam.id, r.studentId), "_blank")}>
                            <Printer size={15} /> كشف
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      <CreateExamDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
