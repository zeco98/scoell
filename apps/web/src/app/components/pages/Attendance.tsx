import { useState } from "react";
import { ATTENDANCE_TODAY, type AttendanceMark } from "../../data/mock";
import { PageHeader } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Check, X, Clock, LogOut, Save } from "lucide-react";

const MARKS: { key: AttendanceMark; label: string; icon: typeof Check; cls: string; activeCls: string }[] = [
  { key: "present", label: "حاضر", icon: Check, cls: "text-success", activeCls: "bg-success text-success-foreground border-success" },
  { key: "absent", label: "غائب", icon: X, cls: "text-destructive", activeCls: "bg-destructive text-destructive-foreground border-destructive" },
  { key: "late", label: "متأخر", icon: Clock, cls: "text-warning", activeCls: "bg-warning text-warning-foreground border-warning" },
  { key: "early", label: "خروج مبكر", icon: LogOut, cls: "text-info", activeCls: "bg-info text-info-foreground border-info" },
];

const SECTIONS = ["الرابع علمي / أ", "الرابع علمي / ب", "الخامس علمي / أ", "السادس علمي / أ"];

export function Attendance() {
  const [section, setSection] = useState(SECTIONS[0]);
  const [rows, setRows] = useState(ATTENDANCE_TODAY.map((r) => ({ ...r })));

  const counts = MARKS.map((m) => ({ ...m, n: rows.filter((r) => r.mark === m.key).length }));

  function setMark(id: string, mark: AttendanceMark) {
    setRows((prev) => prev.map((r) => (r.studentId === id ? { ...r, mark } : r)));
  }

  return (
    <div>
      <PageHeader
        title="الحضور والغياب"
        subtitle={`تحضير سريع · ${new Date().toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" })}`}
        action={
          <Button className="gap-2" onClick={() => toast.success("تم حفظ التحضير وإشعار أولياء أمور الغائبين", { description: "سُجّلت العملية في سجل التدقيق." })}>
            <Save size={17} /> حفظ التحضير
          </Button>
        }
      />

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {SECTIONS.map((s) => (
          <Button key={s} size="sm" variant={section === s ? "default" : "outline"} onClick={() => setSection(s)}>
            {s}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
        {counts.map((c) => (
          <Card key={c.key} className="p-4 flex-row items-center justify-between gap-2">
            <div>
              <div className={`${c.cls}`} style={{ fontSize: 24, fontWeight: 700 }}>{c.n}</div>
              <div className="text-muted-foreground">{c.label}</div>
            </div>
            <c.icon className={c.cls} size={22} />
          </Card>
        ))}
      </div>

      <Card className="p-2">
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <div key={r.studentId} className="flex items-center gap-3 p-3 flex-wrap">
              <span className="text-muted-foreground w-6">{i + 1}</span>
              <div className="size-9 rounded-full bg-brand-soft text-brand flex items-center justify-center">{r.name.charAt(0)}</div>
              <div className="flex-1 min-w-32">
                <div className="text-foreground">{r.name}</div>
                {r.note && <div className="text-muted-foreground">{r.note}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                {MARKS.map((m) => {
                  const active = r.mark === m.key;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setMark(r.studentId, m.key)}
                      className={`size-9 rounded-lg border flex items-center justify-center transition-colors ${active ? m.activeCls : `border-border bg-card ${m.cls} hover:bg-muted`}`}
                      title={m.label}
                    >
                      <Icon size={17} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
