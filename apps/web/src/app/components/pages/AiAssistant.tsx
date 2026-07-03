import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiRequestItem } from "@manarah/api-client";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { PageHeader, StatusPill } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Sparkles, FileText, MessageCircle, ListChecks, CalendarClock, ShieldAlert, Loader2, Check, PencilLine } from "lucide-react";

const TEMPLATES = [
  { kind: "student_report", icon: FileText, title: "تقرير أداء طالب", desc: "ملخّص أداء أكاديمي وسلوكي جاهز للمراجعة." },
  { kind: "parent_message", icon: MessageCircle, title: "رسالة لوليّ أمر", desc: "صياغة رسالة رسمية-ودودة حسب الحالة." },
  { kind: "exam_questions", icon: ListChecks, title: "توليد أسئلة امتحان", desc: "بنك أسئلة مقترح حسب المادة والمستوى." },
  { kind: "attendance_summary", icon: CalendarClock, title: "ملخّص حضور", desc: "تحليل نمط غياب طالب أو شعبة." },
];

const KIND_LABELS: Record<string, string> = {
  student_report: "تقرير طالب",
  parent_message: "رسالة ولي أمر",
  exam_questions: "أسئلة امتحان",
  attendance_summary: "ملخص حضور",
};

export function AiAssistant() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState<AiRequestItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: history } = useQuery({ queryKey: ["ai", "requests"], queryFn: () => api.ai.requests() });

  const generate = useMutation({
    mutationFn: (kind: string) => api.ai.generate(kind, {}),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ai"] });
      setCurrent(r);
      setEditing(false);
      toast.success("وُلّدت المسودّة — تتطلب مراجعة بشرية قبل الاعتماد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل التوليد"),
  });

  const saveEdit = useMutation({
    mutationFn: () => api.ai.edit(current!.id, draft),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ai"] });
      setCurrent(r);
      setEditing(false);
      toast.success("حُفظ التعديل على المسودّة");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحفظ"),
  });

  const approve = useMutation({
    mutationFn: () => api.ai.approve(current!.id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ai"] });
      setCurrent(r);
      toast.success("اعتُمد المخرَج بعد المراجعة — سُجّل في التدقيق");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الاعتماد"),
  });

  return (
    <div>
      <PageHeader title="المساعد الذكي" subtitle="بنية provider-agnostic — كل مخرجات الذكاء الاصطناعي تمرّ بمراجعة بشرية" />

      <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 flex items-center gap-2 mb-5 text-warning">
        <ShieldAlert size={18} />
        <span>المزوّد الحالي: قوالب محلية (بلا مفاتيح خارجية). عند الربط بمزوّد حقيقي تبقى قاعدة «مسودّة → مراجعة → اعتماد» إلزامية.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 h-fit">
            {TEMPLATES.map((t) => (
              <Card
                key={t.kind}
                className="p-4 gap-2 cursor-pointer hover:border-brand transition-colors"
                onClick={() => !generate.isPending && generate.mutate(t.kind)}
              >
                <div className="size-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><t.icon size={20} /></div>
                <div className="text-foreground">{t.title}</div>
                <div className="text-muted-foreground">{t.desc}</div>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <h3 className="text-foreground mb-2">سجل الطلبات</h3>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {(history ?? []).length === 0 && <p className="text-muted-foreground py-4 text-center">لا طلبات بعد.</p>}
              {(history ?? []).map((r) => (
                <button key={r.id} className="w-full text-right py-2.5 flex items-center gap-2 hover:bg-muted/40 px-2 rounded" onClick={() => { setCurrent(r); setEditing(false); }}>
                  <span className="text-foreground">{KIND_LABELS[r.kind] ?? r.kind}</span>
                  <span className="text-muted-foreground" dir="ltr">{new Date(r.createdAt).toLocaleString("ar-IQ-u-nu-latn")}</span>
                  <span className="mr-auto"><StatusPill status={r.status === "approved" ? "accepted" : r.status} /></span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5 gap-3 min-h-64 h-fit">
          <div className="flex items-center gap-2 text-brand">
            <Sparkles size={18} /> <h3 className="text-foreground">المخرجات</h3>
            {current && <span className="mr-auto"><StatusPill status={current.status === "approved" ? "accepted" : current.status} /></span>}
          </div>

          {generate.isPending ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
          ) : current ? (
            <>
              {editing ? (
                <textarea
                  className="w-full min-h-48 rounded-lg bg-input-background border border-transparent p-3 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              ) : (
                <p className="text-foreground whitespace-pre-line flex-1">{current.output}</p>
              )}
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <Button className="flex-1 gap-2" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                      {saveEdit.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} حفظ التعديل
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>إلغاء</Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => approve.mutate()}
                      disabled={approve.isPending || current.status === "approved"}
                    >
                      {approve.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {current.status === "approved" ? "معتمَد ✓" : "اعتماد"}
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => { setDraft(current.output); setEditing(true); }} disabled={current.status === "approved"}>
                      <PencilLine size={15} /> تعديل
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground py-10">اختر قالبًا من اليمين لتوليد مسودّة.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
