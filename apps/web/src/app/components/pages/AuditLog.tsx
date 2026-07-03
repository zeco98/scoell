import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { PageHeader, StatusPill, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import type { AuditItem } from "@manarah/api-client";
import { Search, ShieldCheck, Diff } from "lucide-react";

const SEV: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "critical", label: "حرج" },
  { key: "warning", label: "تحذير" },
  { key: "info", label: "معلومة" },
];

const PAGE_SIZE = 20;

function JsonDiff({ label, value, tone }: { label: string; value: string | null | undefined; tone: "before" | "after" }) {
  if (!value) return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  return (
    <div className={`rounded-lg p-3 ${tone === "before" ? "bg-destructive/8 border border-destructive/20" : "bg-success/8 border border-success/20"}`}>
      <div className={tone === "before" ? "text-destructive mb-1.5" : "text-success mb-1.5"} style={{ fontWeight: 700 }}>
        {label}
      </div>
      <div className="space-y-1">
        {Object.entries(parsed).map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <span className="text-muted-foreground shrink-0">{k}:</span>
            <span className="text-foreground break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditLog() {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", { q, sev, entity, from, to, page }],
    queryFn: () =>
      api.audit.list({
        query: q || undefined,
        severity: sev,
        entity: entity || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        title="سجل التدقيق"
        subtitle="كل عملية حساسة مُسجّلة بقيمها قبل وبعد — بحث وفلاتر حقيقية server-side"
        action={<span className="flex items-center gap-1.5 text-brand"><ShieldCheck size={18} /> append-only — غير قابل للحذف</span>}
      />

      <Card className="p-4 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input className="pr-10 bg-input-background border-transparent" placeholder="بحث بالإجراء أو المستخدم أو المعرّف..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div className="flex gap-1.5">
            {SEV.map((s) => (
              <Button key={s.key} size="sm" variant={sev === s.key ? "default" : "outline"} onClick={() => { setSev(s.key); setPage(1); }}>{s.label}</Button>
            ))}
          </div>
          <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-input-background px-3">
            <option value="">كل الكيانات</option>
            {["Auth", "Student", "Payment", "Attendance", "Admission", "ExamResult", "Exam", "Message", "Settings", "Discount", "Tenant", "Employee", "AiRequest"].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <Input type="date" dir="ltr" className="w-36" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <span className="text-muted-foreground">إلى</span>
            <Input type="date" dir="ltr" className="w-36" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="لا سجلات مطابقة" hint="جرّب توسيع الفلاتر." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                    <TableHead className="text-right">الكيان</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                    <TableHead className="text-right">الوقت</TableHead>
                    <TableHead className="text-right">الخطورة</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-foreground">{a.userName}</TableCell>
                      <TableCell className="max-w-md truncate">{a.action}</TableCell>
                      <TableCell className="text-muted-foreground">{a.entity}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{a.ip ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">{new Date(a.createdAt).toLocaleString("ar-IQ-u-nu-latn")}</TableCell>
                      <TableCell><StatusPill status={a.severity} /></TableCell>
                      <TableCell>
                        {(a.before || a.after) && (
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelected(a)}>
                            <Diff size={14} /> الفرق
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">صفحة {page} من {totalPages} · {data.total} قيد</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* عرض فرق before/after */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          {selected && (
            <>
              <DialogHeader className="text-right">
                <DialogTitle>تفاصيل القيد</DialogTitle>
                <DialogDescription>
                  {selected.userName} · {selected.entity} ({selected.entityId}) · {new Date(selected.createdAt).toLocaleString("ar-IQ-u-nu-latn")}
                </DialogDescription>
              </DialogHeader>
              <p className="text-foreground">{selected.action}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <JsonDiff label="قبل" value={selected.before} tone="before" />
                <JsonDiff label="بعد" value={selected.after} tone="after" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
