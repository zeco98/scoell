import { useMemo, useState } from "react";
import type { AppUser } from "../../data/mock";
import { STUDENTS, formatIQD, type StudentStatus } from "../../data/mock";
import { PageHeader, StatusPill, EmptyState } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Search, UserPlus, Upload, GraduationCap, Phone, Users } from "lucide-react";

const FILTERS: { key: StudentStatus | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشط" },
  { key: "suspended", label: "موقوف" },
  { key: "graduated", label: "متخرّج" },
  { key: "withdrawn", label: "منسحب" },
];

export function Students({ user }: { user: AppUser }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StudentStatus | "all">("all");
  const [selected, setSelected] = useState<(typeof STUDENTS)[number] | null>(null);

  // وليّ الأمر يرى أبناءه فقط (محاكاة عزل البيانات)
  const scoped = user.role === "PARENT" ? STUDENTS.slice(0, 2) : STUDENTS;

  const rows = useMemo(
    () =>
      scoped.filter(
        (s) =>
          (filter === "all" || s.status === filter) &&
          (s.name.includes(q) || s.guardian.includes(q) || s.id.includes(q)),
      ),
    [q, filter, scoped],
  );

  return (
    <div>
      <PageHeader
        title="الطلبة"
        subtitle={`${scoped.length} طالب مسجّل · إدارة الملفات والحالات والنقل`}
        action={
          (user.role === "SCHOOL_ADMIN") && (
            <>
              <Button variant="outline" className="gap-2">
                <Upload size={17} /> استيراد CSV
              </Button>
              <Button className="gap-2">
                <UserPlus size={17} /> تسجيل طالب
              </Button>
            </>
          )
        }
      />

      <Card className="p-4 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input className="pr-10 bg-input-background border-transparent" placeholder="بحث بالاسم أو ولي الأمر أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="لا توجد نتائج مطابقة" hint="جرّب تعديل البحث أو الفلتر." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الطالب</TableHead>
                  <TableHead className="text-right">المرحلة / الشعبة</TableHead>
                  <TableHead className="text-right">وليّ الأمر</TableHead>
                  <TableHead className="text-right">الحضور</TableHead>
                  <TableHead className="text-right">المعدّل</TableHead>
                  <TableHead className="text-right">المتبقّي</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-brand-soft text-brand flex items-center justify-center">{s.name.charAt(0)}</div>
                        <div>
                          <div className="text-foreground">{s.name}</div>
                          <div className="text-muted-foreground">{s.id} · {s.gender}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{s.stage} / {s.section}</TableCell>
                    <TableCell>{s.guardian}</TableCell>
                    <TableCell>{s.attendanceRate}%</TableCell>
                    <TableCell>{s.gpa}</TableCell>
                    <TableCell className={s.balance > 0 ? "text-destructive" : "text-success"}>{s.balance > 0 ? formatIQD(s.balance) : "مسدّد"}</TableCell>
                    <TableCell><StatusPill status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          {selected && (
            <>
              <DialogHeader className="text-right">
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="text-brand" size={20} /> ملف الطالب
                </DialogTitle>
                <DialogDescription>البيانات الأساسية وملخّص الأداء.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <div className="size-14 rounded-full bg-brand text-white flex items-center justify-center" style={{ fontSize: 22 }}>{selected.name.charAt(0)}</div>
                <div>
                  <div className="text-foreground" style={{ fontWeight: 700 }}>{selected.name}</div>
                  <div className="text-muted-foreground">{selected.stage} / {selected.section} · {selected.id}</div>
                </div>
                <div className="mr-auto"><StatusPill status={selected.status} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  ["وليّ الأمر", selected.guardian],
                  ["الهاتف", selected.guardianPhone],
                  ["نسبة الحضور", `${selected.attendanceRate}%`],
                  ["المعدّل العام", `${selected.gpa}`],
                  ["تاريخ التسجيل", selected.enrolledAt],
                  ["الرصيد المتبقّي", selected.balance > 0 ? formatIQD(selected.balance) : "مسدّد بالكامل"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted/60 p-3">
                    <div className="text-muted-foreground">{k}</div>
                    <div className="text-foreground">{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button className="flex-1 gap-2"><Phone size={16} /> تواصل مع ولي الأمر</Button>
                <Button variant="outline" className="flex-1">كشف الدرجات</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
