import { useState } from "react";
import { AUDIT_LOG } from "../../data/mock";
import { PageHeader, StatusPill } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Search, ShieldCheck } from "lucide-react";

const SEV: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "critical", label: "حرج" },
  { key: "warning", label: "تحذير" },
  { key: "info", label: "معلومة" },
];

export function AuditLog() {
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const rows = AUDIT_LOG.filter(
    (a) => (sev === "all" || a.severity === sev) && (a.action.includes(q) || a.user.includes(q) || a.entity.includes(q)),
  );

  return (
    <div>
      <PageHeader title="سجل التدقيق" subtitle="كل عملية حساسة مُسجّلة: المستخدم، الإجراء، الكيان، العنوان، والوقت" action={<span className="flex items-center gap-1.5 text-brand"><ShieldCheck size={18} /> غير قابل للحذف</span>} />

      <Card className="p-4 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input className="pr-10 bg-input-background border-transparent" placeholder="بحث في السجل..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1.5">
            {SEV.map((s) => (
              <Button key={s.key} size="sm" variant={sev === s.key ? "default" : "outline"} onClick={() => setSev(s.key)}>{s.label}</Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">الإجراء</TableHead>
                <TableHead className="text-right">الكيان</TableHead>
                <TableHead className="text-right">المعرّف</TableHead>
                <TableHead className="text-right">IP</TableHead>
                <TableHead className="text-right">الوقت</TableHead>
                <TableHead className="text-right">الخطورة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-foreground">{a.user}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>{a.entity}</TableCell>
                  <TableCell className="text-muted-foreground">{a.entityId}</TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">{a.ip}</TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">{a.createdAt}</TableCell>
                  <TableCell><StatusPill status={a.severity} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
