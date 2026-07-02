import { FEES, PAYMENTS, STATS, formatIQD } from "../../data/mock";
import { PageHeader, StatCard, StatusPill } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { toast } from "sonner";
import { Wallet, AlertTriangle, TrendingUp, Receipt, Plus, Download } from "lucide-react";

export function Fees() {
  const rate = Math.round((STATS.collected / (STATS.collected + STATS.outstanding)) * 100);
  return (
    <div>
      <PageHeader
        title="الرسوم والمالية"
        subtitle="خطط الرسوم، الأقساط، السندات، ومتابعة الديون"
        action={
          <Button className="gap-2" onClick={() => toast.success("تم إنشاء سند قبض جديد", { description: "RC-2026-1064 · سُجّل في سجل التدقيق." })}>
            <Plus size={17} /> سند قبض
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard icon={Wallet} label="إجمالي التحصيل" value={formatIQD(STATS.collected)} tone="success" trend={9} />
        <StatCard icon={AlertTriangle} label="الديون المتأخرة" value={formatIQD(STATS.outstanding)} tone="danger" />
        <StatCard icon={TrendingUp} label="نسبة التحصيل" value={`${rate}%`} tone="info" />
        <StatCard icon={Receipt} label="سندات هذا الشهر" value={String(PAYMENTS.length)} tone="brand" />
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">الأقساط والديون</TabsTrigger>
          <TabsTrigger value="payments">سندات القبض</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <Card className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">الخطة</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">المسدّد</TableHead>
                    <TableHead className="text-right w-40">نسبة السداد</TableHead>
                    <TableHead className="text-right">الاستحقاق</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEES.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-foreground">{f.student}</TableCell>
                      <TableCell>{f.plan}</TableCell>
                      <TableCell>{formatIQD(f.total)}</TableCell>
                      <TableCell>{formatIQD(f.paid)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={(f.paid / f.total) * 100} className="w-24" />
                          <span className="text-muted-foreground">{Math.round((f.paid / f.total) * 100)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{f.dueDate}</TableCell>
                      <TableCell><StatusPill status={f.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم السند</TableHead>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الطريقة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المُحصِّل</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PAYMENTS.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-brand">{p.receipt}</TableCell>
                      <TableCell className="text-foreground">{p.student}</TableCell>
                      <TableCell>{formatIQD(p.amount)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.date}</TableCell>
                      <TableCell>{p.by}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => toast("تحميل السند PDF")}>
                          <Download size={15} /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
