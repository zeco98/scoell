import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageChannel } from "@manarah/shared";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { PageHeader, StatusPill, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Send, MessageSquare, Smartphone, Bell, Loader2 } from "lucide-react";

const AUDIENCES: { key: string; label: string }[] = [
  { key: "ALL_PARENTS", label: "أولياء الأمور" },
  { key: "TEACHERS", label: "المعلمون" },
  { key: "STUDENTS", label: "الطلبة" },
  { key: "ABSENTEES", label: "أولياء الغائبين اليوم" },
  { key: "SECTION", label: "شعبة محددة" },
];

const CHANNELS: { key: MessageChannel; label: string; icon: typeof Bell }[] = [
  { key: "IN_APP", label: "داخلي", icon: Bell },
  { key: "SMS", label: "SMS", icon: Smartphone },
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
];

const CHANNEL_ICON: Record<string, typeof Bell> = { IN_APP: Bell, SMS: Smartphone, WHATSAPP: MessageSquare };
const CHANNEL_LABEL: Record<string, string> = { IN_APP: "داخلي", SMS: "SMS", WHATSAPP: "WhatsApp" };

const TEMPLATES: { label: string; title: string; body: string }[] = [
  { label: "تذكير اجتماع", title: "تذكير بموعد الاجتماع", body: "نذكّركم بموعد اجتماع أولياء الأمور يوم الخميس الساعة العاشرة صباحًا في قاعة المدرسة." },
  { label: "تنبيه أقساط", title: "تنبيه بقسط مستحق", body: "نودّ تذكيركم بوجود قسط مستحق. يرجى مراجعة الإدارة للتسديد. شكرًا لتعاونكم." },
  { label: "تهنئة", title: "تهنئة بالتفوق", body: "نبارك لأبنائنا الطلبة تفوقهم في الامتحانات، ونتمنى لهم دوام النجاح." },
];

export function Communication() {
  const qc = useQueryClient();
  const [audience, setAudience] = useState("ALL_PARENTS");
  const [sectionId, setSectionId] = useState("");
  const [channel, setChannel] = useState<MessageChannel>("IN_APP");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: messages, isLoading } = useQuery({ queryKey: ["messages"], queryFn: () => api.messages.list() });
  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: () => api.sections.list(),
    enabled: audience === "SECTION",
  });

  const send = useMutation({
    mutationFn: () =>
      api.messages.create({
        title: title.trim(),
        body: body.trim(),
        channel,
        audience: { kind: audience as "ALL_PARENTS", sectionId: audience === "SECTION" ? sectionId : undefined },
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success(`أُرسلت الرسالة إلى ${m.recipients} مستلم عبر ${CHANNEL_LABEL[channel]}`, {
        description: "سُجّلت في سجل الرسائل والتدقيق.",
      });
      setTitle("");
      setBody("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الإرسال"),
  });

  const canSend = title.trim().length >= 3 && body.trim().length > 0 && (audience !== "SECTION" || !!sectionId);

  return (
    <div>
      <PageHeader
        title="التواصل والإشعارات"
        subtitle="رسائل داخلية حقيقية + بنية SMS/WhatsApp جاهزة للربط بمزوّد"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* composer */}
        <Card className="p-5 gap-3 lg:col-span-1 h-fit">
          <h3 className="text-foreground">إنشاء رسالة / تعميم</h3>

          <div className="space-y-1.5">
            <label>الفئة المستهدفة</label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setAudience(t.key)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    audience === t.key ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {audience === "SECTION" && (
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input-background px-3 mt-1">
                <option value="">اختر الشعبة...</option>
                {(sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label>القناة</label>
            <div className="flex gap-1.5">
              {CHANNELS.map((c) => (
                <Button key={c.key} size="sm" variant={channel === c.key ? "default" : "outline"} className="flex-1 gap-1" onClick={() => setChannel(c.key)}>
                  <c.icon size={14} /> {c.label}
                </Button>
              ))}
            </div>
            {channel !== "IN_APP" && (
              <p className="text-muted-foreground">القناة الخارجية عبر provider تجريبي حاليًا — تصل الرسالة داخليًا دائمًا.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label>قوالب جاهزة</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.label} onClick={() => { setTitle(t.title); setBody(t.body); }} className="px-2.5 py-1 rounded-full bg-brand-soft text-brand hover:bg-brand-soft/70">
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label>العنوان</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الرسالة..." />
          </div>
          <textarea
            className="w-full min-h-24 rounded-lg bg-input-background border border-transparent p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="نص الرسالة..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button className="gap-2" onClick={() => send.mutate()} disabled={!canSend || send.isPending}>
            {send.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {send.isPending ? "جارٍ الإرسال..." : "إرسال"}
          </Button>
        </Card>

        {/* السجل */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-foreground mb-3">سجل الرسائل</h3>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : (messages ?? []).length === 0 ? (
            <EmptyState icon={MessageSquare} title="لا رسائل بعد" hint="أنشئ أول رسالة من النموذج المجاور." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">الفئة</TableHead>
                    <TableHead className="text-right">القناة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(messages ?? []).map((m) => {
                    const Icon = CHANNEL_ICON[m.channel] ?? Bell;
                    let audienceLabel = m.audienceKind;
                    try {
                      const meta = JSON.parse(m.audienceMeta);
                      audienceLabel = meta.label ?? m.audienceKind;
                      if (meta.recipients != null) audienceLabel += ` (${meta.recipients})`;
                    } catch { /* تجاهل */ }
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-foreground">{m.title}</TableCell>
                        <TableCell>{audienceLabel}</TableCell>
                        <TableCell><span className="flex items-center gap-1.5"><Icon size={15} /> {CHANNEL_LABEL[m.channel] ?? m.channel}</span></TableCell>
                        <TableCell dir="ltr">{m.sentAt ? new Date(m.sentAt).toLocaleDateString("ar-IQ-u-nu-latn") : m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString("ar-IQ-u-nu-latn") : "—"}</TableCell>
                        <TableCell><StatusPill status={m.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
