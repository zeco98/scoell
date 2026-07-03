import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import confetti from "canvas-confetti";
import { createAdmissionSchema, type AdmissionStage, type CreateAdmissionDto } from "@manarah/shared";
import type { AdmissionItem } from "@manarah/api-client";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { PageHeader, QueryError } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { FileText, Phone, UserCheck, Plus, Loader2, GripVertical } from "lucide-react";

const COLUMNS: { key: AdmissionStage; label: string; accent: string }[] = [
  { key: "new", label: "طلبات جديدة", accent: "var(--info)" },
  { key: "reviewing", label: "قيد المراجعة", accent: "var(--warning)" },
  { key: "interview", label: "مقابلة", accent: "var(--brand)" },
  { key: "accepted", label: "مقبول", accent: "var(--success)" },
  { key: "rejected", label: "مرفوض", accent: "var(--destructive)" },
];

const DND_TYPE = "admission-card";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------- بطاقة قابلة للسحب
function AdmissionCard({
  a,
  onConvert,
  onReject,
  converting,
}: {
  a: AdmissionItem;
  onConvert: (a: AdmissionItem) => void;
  onReject: (a: AdmissionItem) => void;
  converting: boolean;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_TYPE,
      item: { id: a.id, stage: a.stage },
      canDrag: a.stage !== "rejected" && !a.convertedStudentId,
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [a.id, a.stage, a.convertedStudentId],
  );

  return (
    <div ref={(node) => { drag(node); }} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <Card className="p-3 gap-2 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1.5">
          <GripVertical size={14} className="text-muted-foreground shrink-0" />
          <div className="text-foreground">{a.applicantName}</div>
        </div>
        <div className="text-muted-foreground">{a.stageApplied}</div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1"><FileText size={13} /> {a.docs}</span>
          <span className="flex items-center gap-1" dir="ltr"><Phone size={13} /> {a.guardianPhone}</span>
        </div>
        {a.stage === "rejected" && a.rejectReason && (
          <p className="text-destructive">سبب الرفض: {a.rejectReason}</p>
        )}
        {a.stage === "accepted" && !a.convertedStudentId && (
          <Button size="sm" className="w-full gap-1 mt-1" onClick={() => onConvert(a)} disabled={converting}>
            {converting ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={15} />} تحويل إلى طالب
          </Button>
        )}
        {a.convertedStudentId && <p className="text-success">✓ حُوّل لطالب مسجّل</p>}
        {a.stage !== "rejected" && a.stage !== "accepted" && (
          <Button size="sm" variant="ghost" className="text-destructive w-full" onClick={() => onReject(a)}>
            رفض
          </Button>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- عمود يستقبل الإفلات
function StageColumn({
  col,
  items,
  onDrop,
  children,
}: {
  col: (typeof COLUMNS)[number];
  items: AdmissionItem[];
  onDrop: (id: string, stage: AdmissionStage) => void;
  children: React.ReactNode;
}) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      drop: (item: { id: string; stage: AdmissionStage }) => {
        if (item.stage !== col.key) onDrop(item.id, col.key);
      },
      collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
    }),
    [col.key, onDrop],
  );

  return (
    <div
      ref={(node) => { drop(node); }}
      className={`rounded-xl p-3 transition-colors ${isOver && canDrop ? "bg-brand-soft/50 ring-2 ring-brand/40" : "bg-muted/40"}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: col.accent }} />
          <span className="text-foreground">{col.label}</span>
        </div>
        <span className="text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2.5 min-h-16">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- نموذج طلب جديد
function NewAdmissionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdmissionDto>({ resolver: zodResolver(createAdmissionSchema) });

  const create = useMutation({
    mutationFn: (dto: CreateAdmissionDto) => api.admissions.create(dto),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      toast.success(`سُجّل طلب تقديم ${a.applicantName}`);
      reset();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تسجيل الطلب"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>طلب تقديم جديد</DialogTitle>
          <DialogDescription>يدخل الطلب عمود «طلبات جديدة» في خط القبول.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label>اسم المتقدّم</label>
            <Input {...register("applicantName")} />
            {errors.applicantName && <p className="text-destructive">{errors.applicantName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label>المرحلة المطلوبة</label>
            <Input {...register("stageApplied")} placeholder="الرابع علمي" />
            {errors.stageApplied && <p className="text-destructive">{errors.stageApplied.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label>وليّ الأمر</label>
              <Input {...register("guardianName")} />
              {errors.guardianName && <p className="text-destructive">{errors.guardianName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label>الهاتف</label>
              <Input {...register("guardianPhone")} dir="ltr" placeholder="07XXXXXXXXX" />
              {errors.guardianPhone && <p className="text-destructive">{errors.guardianPhone.message}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={create.isPending}>
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            تسجيل الطلب
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- الصفحة
export function Admissions() {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [rejecting, setRejecting] = useState<AdmissionItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: items, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admissions"], queryFn: () => api.admissions.list() });

  const changeStage = useMutation({
    mutationFn: ({ id, stage, reason }: { id: string; stage: string; reason?: string }) =>
      api.admissions.changeStage(id, stage, reason),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      toast.success(`نُقل طلب ${a.applicantName} إلى «${COLUMNS.find((c) => c.key === a.stage)?.label}»`, {
        description: "سُجّلت العملية في سجل التدقيق.",
      });
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      toast.error(e instanceof Error ? e.message : "فشل نقل الطلب");
    },
  });

  const convert = useMutation({
    mutationFn: (id: string) => api.admissions.convert(id),
    onSuccess: ({ student }) => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (!prefersReducedMotion()) confetti({ particleCount: 110, spread: 75, origin: { y: 0.65 } });
      toast.success(`🎓 ${student.name} أصبح طالبًا مسجّلًا (${student.code})`, {
        description: "أُنشئ سجل الطالب وسُجّلت العملية في التدقيق.",
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل التحويل"),
  });

  function onDrop(id: string, stage: AdmissionStage) {
    if (stage === "rejected") {
      const a = items?.find((x) => x.id === id);
      if (a) setRejecting(a);
      return;
    }
    changeStage.mutate({ id, stage });
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <PageHeader
          title="القبول والتسجيل"
          subtitle="اسحب البطاقات بين المراحل — من الطلب إلى طالب مسجّل"
          action={
            <Button className="gap-2" onClick={() => setNewOpen(true)}>
              <Plus size={17} /> طلب تقديم جديد
            </Button>
          }
        />

        {isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
            {COLUMNS.map((col) => {
              const colItems = (items ?? []).filter((i) => i.stage === col.key);
              return (
                <StageColumn key={col.key} col={col} items={colItems} onDrop={onDrop}>
                  {colItems.map((a) => (
                    <AdmissionCard
                      key={a.id}
                      a={a}
                      converting={convert.isPending && convert.variables === a.id}
                      onConvert={(x) => convert.mutate(x.id)}
                      onReject={(x) => setRejecting(x)}
                    />
                  ))}
                  {colItems.length === 0 && <div className="text-center text-muted-foreground py-6">لا طلبات</div>}
                </StageColumn>
              );
            })}
          </div>
        )}

        <NewAdmissionDialog open={newOpen} onClose={() => setNewOpen(false)} />

        {/* رفض بسبب إلزامي */}
        <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setRejectReason(""); } }}>
          <DialogContent className="sm:max-w-sm" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>رفض طلب {rejecting?.applicantName}</DialogTitle>
              <DialogDescription>سبب الرفض إلزامي ويُسجَّل في التدقيق ويُشعَر به وليّ الأمر.</DialogDescription>
            </DialogHeader>
            <Input placeholder="سبب الرفض..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <Button
              variant="destructive"
              className="w-full"
              disabled={!rejectReason.trim() || changeStage.isPending}
              onClick={() => {
                if (rejecting) {
                  changeStage.mutate({ id: rejecting.id, stage: "rejected", reason: rejectReason.trim() });
                  setRejecting(null);
                  setRejectReason("");
                }
              }}
            >
              تأكيد الرفض
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </DndProvider>
  );
}
