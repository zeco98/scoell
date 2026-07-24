import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceMark } from "@manarah/shared";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Check, X, Clock, LogOut, Save, Loader2, CalendarDays, Users } from "lucide-react";

const MARKS: { key: AttendanceMark; label: string; icon: typeof Check; cls: string; activeCls: string }[] = [
  { key: "present", label: "حاضر", icon: Check, cls: "text-success", activeCls: "bg-success text-success-foreground border-success" },
  { key: "absent", label: "غائب", icon: X, cls: "text-destructive", activeCls: "bg-destructive text-destructive-foreground border-destructive" },
  { key: "late", label: "متأخر", icon: Clock, cls: "text-warning", activeCls: "bg-warning text-warning-foreground border-warning" },
  { key: "early", label: "خروج مبكر", icon: LogOut, cls: "text-info", activeCls: "bg-info text-info-foreground border-info" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Row {
  studentId: string;
  code: string;
  name: string;
  mark: AttendanceMark;
  note?: string;
}

export function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sectionId, setSectionId] = useState<string>("");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  // تسجيل الحضور (حفظ/تعديل + اختيار تاريخ رجعي) → للمعلّم حصرًا؛ يبقى العرض للإدارة للاطّلاع فقط
  const isTeacher = user?.role === "TEACHER";

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ["sections"],
    queryFn: () => api.sections.list(),
  });

  // أول شعبة فيها طلاب تلقائيًا
  useEffect(() => {
    if (!sectionId && sections?.length) {
      const first = sections.find((s) => s.studentCount > 0) ?? sections[0];
      setSectionId(first.id);
    }
  }, [sections, sectionId]);

  const { data: sheet, isLoading: sheetLoading } = useQuery({
    queryKey: ["attendance", "sheet", sectionId, date],
    queryFn: () => api.attendance.sheet(sectionId, date),
    enabled: !!sectionId,
  });

  useEffect(() => {
    if (sheet) {
      setRows(sheet.rows.map((r) => ({ ...r, mark: r.mark as AttendanceMark })));
      setDirty(false);
    }
  }, [sheet]);

  const save = useMutation({
    mutationFn: () =>
      api.attendance.saveBulk({
        sectionId,
        date,
        rows: rows.map((r) => ({ studentId: r.studentId, mark: r.mark, note: r.note })),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDirty(false);
      toast.success(`حُفظ تحضير ${res.saved} طالبًا`, {
        description:
          res.absent > 0
            ? `${res.absent} غائب — أُشعر ${res.guardiansNotified} وليّ أمر تلقائيًا. سُجّل في التدقيق.`
            : "لا غيابات اليوم 🎉 — سُجّلت العملية في التدقيق.",
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حفظ التحضير"),
  });

  function setMark(id: string, mark: AttendanceMark) {
    setRows((prev) => prev.map((r) => (r.studentId === id ? { ...r, mark } : r)));
    setDirty(true);
  }

  function markAll(mark: AttendanceMark) {
    setRows((prev) => prev.map((r) => ({ ...r, mark })));
    setDirty(true);
  }

  const counts = MARKS.map((m) => ({ ...m, n: rows.filter((r) => r.mark === m.key).length }));

  return (
    <div>
      <PageHeader
        title="الحضور والغياب"
        subtitle={`تحضير سريع · ${new Date(date + "T12:00:00").toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" })}${sheet?.saved ? " · محفوظ مسبقًا" : ""}`}
        action={
          isTeacher && (
            <Button className="gap-2" onClick={() => save.mutate()} disabled={save.isPending || rows.length === 0 || !dirty}>
              {save.isPending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {save.isPending ? "جارٍ الحفظ..." : dirty ? "حفظ التحضير" : "محفوظ ✓"}
            </Button>
          )
        }
      />

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {sectionsLoading && <Skeleton className="h-9 w-64 rounded-lg" />}
          {(sections ?? []).filter((s) => s.studentCount > 0).slice(0, 8).map((s) => (
            <Button key={s.id} size="sm" variant={sectionId === s.id ? "default" : "outline"} onClick={() => setSectionId(s.id)}>
              {s.label} <span className="opacity-60">({s.studentCount})</span>
            </Button>
          ))}
        </div>
        {isTeacher && (
          <div className="flex items-center gap-2 mr-auto">
            <CalendarDays size={17} className="text-muted-foreground" />
            <Input type="date" dir="ltr" className="w-40" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            {date !== today() && <span className="text-warning">تحضير بأثر رجعي — يُسجَّل بقيد تدقيق مميز</span>}
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
        {counts.map((c) => (
          <Card key={c.key} className="p-4 flex-row items-center justify-between gap-2">
            <div>
              <div className={c.cls} style={{ fontSize: 24, fontWeight: 700 }}>{c.n}</div>
              <div className="text-muted-foreground">{c.label}</div>
            </div>
            <c.icon className={c.cls} size={22} />
          </Card>
        ))}
      </div>

      <Card className="p-2">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-muted-foreground">{rows.length} طالب في الشعبة</span>
          {isTeacher && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="text-success" onClick={() => markAll("present")}>الكل حاضر</Button>
            </div>
          )}
        </div>

        {sheetLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="لا طلاب في هذه الشعبة" hint="اختر شعبة أخرى أو أضف طلابًا إليها." />
        ) : (
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
                  {isTeacher
                    ? MARKS.map((m) => {
                        const active = r.mark === m.key;
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.key}
                            onClick={() => setMark(r.studentId, m.key)}
                            className={`size-9 rounded-lg border flex items-center justify-center transition-colors ${active ? m.activeCls : `border-border bg-card ${m.cls} hover:bg-muted`}`}
                            title={m.label}
                            aria-label={`${r.name}: ${m.label}`}
                            aria-pressed={active}
                          >
                            <Icon size={17} />
                          </button>
                        );
                      })
                    : (() => {
                        const current = MARKS.find((m) => m.key === r.mark);
                        if (!current) return null;
                        const Icon = current.icon;
                        return (
                          <span
                            className={`size-9 rounded-lg border flex items-center justify-center ${current.activeCls}`}
                            title={current.label}
                            aria-label={`${r.name}: ${current.label}`}
                          >
                            <Icon size={17} />
                          </span>
                        );
                      })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
