import { useState } from "react";
import { ADMISSIONS, type Admission, type AdmissionStage } from "../../data/mock";
import { PageHeader } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { FileText, Phone, UserCheck, ArrowLeftRight, Plus } from "lucide-react";

const COLUMNS: { key: AdmissionStage; label: string; accent: string }[] = [
  { key: "new", label: "طلبات جديدة", accent: "var(--info)" },
  { key: "reviewing", label: "قيد المراجعة", accent: "var(--warning)" },
  { key: "interview", label: "مقابلة", accent: "var(--brand)" },
  { key: "accepted", label: "مقبول", accent: "var(--success)" },
  { key: "rejected", label: "مرفوض", accent: "var(--destructive)" },
];

const NEXT: Record<AdmissionStage, AdmissionStage | null> = {
  new: "reviewing",
  reviewing: "interview",
  interview: "accepted",
  accepted: null,
  rejected: null,
};

export function Admissions() {
  const [items, setItems] = useState<Admission[]>(ADMISSIONS);

  function advance(a: Admission) {
    const next = NEXT[a.stage];
    if (!next) return;
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, stage: next } : x)));
    toast.success(`تم نقل طلب ${a.applicant} إلى «${COLUMNS.find((c) => c.key === next)?.label}»`);
  }

  function convert(a: Admission) {
    toast.success(`تم تحويل ${a.applicant} إلى طالب مسجّل ✓`, { description: "أُنشئ سجل طالب وسُجّل في سجل التدقيق." });
    setItems((prev) => prev.filter((x) => x.id !== a.id));
  }

  return (
    <div>
      <PageHeader
        title="القبول والتسجيل"
        subtitle="خط أنابيب القبول — من الطلب إلى طالب مسجّل"
        action={<Button className="gap-2"><Plus size={17} /> طلب تقديم جديد</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start">
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.stage === col.key);
          return (
            <div key={col.key} className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: col.accent }} />
                  <span className="text-foreground">{col.label}</span>
                </div>
                <span className="text-muted-foreground">{colItems.length}</span>
              </div>
              <div className="space-y-2.5">
                {colItems.map((a) => (
                  <Card key={a.id} className="p-3 gap-2">
                    <div className="text-foreground">{a.applicant}</div>
                    <div className="text-muted-foreground">{a.stageApplied}</div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1"><FileText size={13} /> {a.docs}</span>
                      <span className="flex items-center gap-1"><Phone size={13} /> {a.phone}</span>
                    </div>
                    {a.stage === "accepted" ? (
                      <Button size="sm" className="w-full gap-1 mt-1" onClick={() => convert(a)}>
                        <UserCheck size={15} /> تحويل إلى طالب
                      </Button>
                    ) : a.stage !== "rejected" ? (
                      <div className="flex gap-1.5 mt-1">
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => advance(a)}>
                          <ArrowLeftRight size={14} /> نقل
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setItems((p) => p.map((x) => x.id === a.id ? { ...x, stage: "rejected" } : x)); toast(`تم رفض طلب ${a.applicant}`); }}>
                          رفض
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                ))}
                {colItems.length === 0 && <div className="text-center text-muted-foreground py-6">لا طلبات</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
