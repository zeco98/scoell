import { useState } from "react";
import { PageHeader } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Sparkles, FileText, MessageCircle, ListChecks, CalendarClock, ShieldAlert } from "lucide-react";

const TEMPLATES = [
  { icon: FileText, title: "تقرير أداء طالب", desc: "ملخّص أداء أكاديمي وسلوكي جاهز للمراجعة." },
  { icon: MessageCircle, title: "رسالة لوليّ أمر", desc: "صياغة رسالة رسمية-ودودة حسب الحالة." },
  { icon: ListChecks, title: "توليد أسئلة امتحان", desc: "بنك أسئلة مقترح حسب المادة والمستوى." },
  { icon: CalendarClock, title: "ملخّص حضور", desc: "تحليل نمط غياب طالب أو شعبة." },
];

export function AiAssistant() {
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function run(title: string) {
    setLoading(true);
    setOutput(null);
    setTimeout(() => {
      setLoading(false);
      setOutput(
        `مسودّة (${title}) — تتطلب مراجعة بشرية قبل الاعتماد:\n\nالطالب محمد الساعدي أظهر تحسّنًا ملحوظًا في مادة الرياضيات (من 78 إلى 88)، مع انتظام حضور بنسبة 96%. يُوصى بتعزيز المشاركة الصفّية في مادة الإنجليزية. الحالة العامة: جيدة جدًا.`,
      );
    }, 1200);
  }

  return (
    <div>
      <PageHeader title="المساعد الذكي" subtitle="بنية جاهزة (provider-agnostic) — كل مخرجات الذكاء الاصطناعي تمرّ بمراجعة بشرية" />

      <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 flex items-center gap-2 mb-5 text-warning">
        <ShieldAlert size={18} />
        <span>وضع تجريبي: المخرجات هنا محاكاة. عند الربط بمزوّد حقيقي تبقى قاعدة «مسودّة → اعتماد» إلزامية.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid sm:grid-cols-2 gap-3 h-fit">
          {TEMPLATES.map((t) => (
            <Card key={t.title} className="p-4 gap-2 cursor-pointer hover:border-brand transition-colors" onClick={() => run(t.title)}>
              <div className="size-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><t.icon size={20} /></div>
              <div className="text-foreground">{t.title}</div>
              <div className="text-muted-foreground">{t.desc}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5 gap-3 min-h-64">
          <div className="flex items-center gap-2 text-brand"><Sparkles size={18} /> <h3 className="text-foreground">المخرجات</h3></div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
              <span className="size-2 rounded-full bg-brand animate-pulse" /> جارٍ التوليد...
            </div>
          ) : output ? (
            <>
              <p className="text-foreground whitespace-pre-line flex-1">{output}</p>
              <div className="flex gap-2">
                <Button className="flex-1">اعتماد</Button>
                <Button variant="outline" className="flex-1">تعديل</Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">اختر قالبًا من اليمين لتوليد مسودّة.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
