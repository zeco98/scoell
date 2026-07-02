import { MESSAGES } from "../../data/mock";
import { PageHeader, StatusPill } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { toast } from "sonner";
import { Send, MessageSquare, Smartphone, Bell } from "lucide-react";

const CHANNEL_ICON: Record<string, typeof Bell> = {
  "داخلي": Bell,
  SMS: Smartphone,
  WhatsApp: MessageSquare,
};

export function Communication() {
  return (
    <div>
      <PageHeader
        title="التواصل والإشعارات"
        subtitle="رسائل داخلية، SMS و WhatsApp (طبقة مزوّدين وهمية جاهزة للربط)"
        action={
          <Button className="gap-2" onClick={() => toast.success("تم إرسال الرسالة عبر القناة المحددة")}>
            <Send size={17} /> رسالة جديدة
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 gap-3 lg:col-span-1 h-fit">
          <h3 className="text-foreground">إنشاء إشعار سريع</h3>
          <div className="space-y-1.5">
            <label>الفئة المستهدفة</label>
            <div className="flex flex-wrap gap-1.5">
              {["الكل", "أولياء الأمور", "المعلمون", "الطلبة", "الغائبون"].map((t) => (
                <span key={t} className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground">{t}</span>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label>القناة</label>
            <div className="flex gap-1.5">
              {["داخلي", "SMS", "WhatsApp"].map((c) => (
                <Button key={c} size="sm" variant="outline" className="flex-1">{c}</Button>
              ))}
            </div>
          </div>
          <textarea className="w-full min-h-24 rounded-lg bg-input-background border border-transparent p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring" placeholder="نص الرسالة..." />
          <Button className="gap-2" onClick={() => toast.success("تم جدولة/إرسال الإشعار")}><Send size={16} /> إرسال</Button>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h3 className="text-foreground mb-3">سجل الرسائل</h3>
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
                {MESSAGES.map((m) => {
                  const Icon = CHANNEL_ICON[m.channel];
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-foreground">{m.title}</TableCell>
                      <TableCell>{m.audience}</TableCell>
                      <TableCell><span className="flex items-center gap-1.5"><Icon size={15} /> {m.channel}</span></TableCell>
                      <TableCell>{m.date}</TableCell>
                      <TableCell><StatusPill status={m.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
