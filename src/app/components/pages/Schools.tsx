import { SCHOOLS, formatNum } from "../../data/mock";
import { PageHeader, StatusPill } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Building2, MapPin, Users, GitBranch, Plus } from "lucide-react";

const PLAN_CLS: Record<string, string> = {
  Basic: "bg-muted text-muted-foreground",
  Pro: "bg-info/12 text-info",
  Enterprise: "bg-brand-soft text-brand",
};

export function Schools() {
  return (
    <div>
      <PageHeader title="المدارس والاشتراكات" subtitle="إدارة المؤسسات المشتركة في المنصة (Multi-Tenant)" action={<Button className="gap-2"><Plus size={17} /> إضافة مؤسسة</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
        {SCHOOLS.map((s) => (
          <Card key={s.id} className="p-5 gap-3">
            <div className="flex items-start justify-between">
              <div className="size-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center"><Building2 size={22} /></div>
              <StatusPill status={s.status} />
            </div>
            <div>
              <div className="text-foreground" style={{ fontWeight: 700 }}>{s.name}</div>
              <div className="text-muted-foreground flex items-center gap-1"><MapPin size={13} /> {s.city}</div>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1"><Users size={14} /> {formatNum(s.students)}</span>
              <span className="flex items-center gap-1"><GitBranch size={14} /> {s.branches} فروع</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className={`px-2.5 py-1 rounded-full ${PLAN_CLS[s.plan]}`}>خطة {s.plan}</span>
              <Button size="sm" variant="ghost">إدارة</Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="text-foreground mb-3">جدول المؤسسات</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المؤسسة</TableHead>
                <TableHead className="text-right">المدينة</TableHead>
                <TableHead className="text-right">الطلبة</TableHead>
                <TableHead className="text-right">الكادر</TableHead>
                <TableHead className="text-right">الخطة</TableHead>
                <TableHead className="text-right">تاريخ الاشتراك</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCHOOLS.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">{s.name}</TableCell>
                  <TableCell>{s.city}</TableCell>
                  <TableCell>{formatNum(s.students)}</TableCell>
                  <TableCell>{formatNum(s.staff)}</TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded-full ${PLAN_CLS[s.plan]}`}>{s.plan}</span></TableCell>
                  <TableCell dir="ltr">{s.createdAt}</TableCell>
                  <TableCell><StatusPill status={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
