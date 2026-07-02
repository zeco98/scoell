import { useState } from "react";
import { EXAM_RESULTS, type ExamResult } from "../../data/mock";
import { PageHeader, StatusPill } from "../shared";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent } from "../ui/dialog";
import { LogoMark, BRAND_NAME } from "../../brand/Logo";
import { toast } from "sonner";
import { FileText, Printer, Plus, Award } from "lucide-react";

function gradeTone(t: number) {
  return t >= 90 ? "accepted" : t >= 80 ? "interview" : t >= 70 ? "new" : t >= 60 ? "reviewing" : "withdrawn";
}

export function Exams() {
  const [card, setCard] = useState<ExamResult | null>(null);

  return (
    <div>
      <PageHeader
        title="الامتحانات والنتائج"
        subtitle="امتحان: النهائي — الرابع علمي / أ · إدخال الدرجات وإصدار الكشوف"
        action={<Button className="gap-2"><Plus size={17} /> امتحان جديد</Button>}
      />

      <Card className="p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-12">الترتيب</TableHead>
                <TableHead className="text-right">الطالب</TableHead>
                <TableHead className="text-right">الشهري (20)</TableHead>
                <TableHead className="text-right">نصف السنة (30)</TableHead>
                <TableHead className="text-right">النهائي (50)</TableHead>
                <TableHead className="text-right">المجموع</TableHead>
                <TableHead className="text-right">التقدير</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EXAM_RESULTS.map((r) => (
                <TableRow key={r.studentId}>
                  <TableCell>
                    <span className={`size-7 rounded-full flex items-center justify-center ${r.rank <= 3 ? "bg-brand-accent/20 text-warning" : "bg-muted text-muted-foreground"}`}>{r.rank}</span>
                  </TableCell>
                  <TableCell className="text-foreground">{r.name}</TableCell>
                  <TableCell>{r.monthly}</TableCell>
                  <TableCell>{r.midterm}</TableCell>
                  <TableCell>{r.finalExam}</TableCell>
                  <TableCell className="text-brand">{r.total}</TableCell>
                  <TableCell><StatusPill status={gradeTone(r.total)} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setCard(r)}>
                      <FileText size={15} /> كشف
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!card} onOpenChange={(o) => !o && setCard(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden" dir="rtl">
          {card && (
            <div>
              {/* رأس الكشف بالهوية البصرية */}
              <div className="p-5 text-white" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-strong))" }}>
                <div className="flex items-center justify-between">
                  <LogoMark size={40} />
                  <div className="text-left">
                    <div style={{ fontWeight: 700 }}>ثانوية النور الأهلية</div>
                    <div className="text-white/70">كشف درجات — منصة {BRAND_NAME}</div>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-foreground" style={{ fontWeight: 700 }}>{card.name}</div>
                    <div className="text-muted-foreground">الرابع علمي / أ · العام 2025–2026</div>
                  </div>
                  <div className="text-center">
                    <Award className="text-brand-accent mx-auto" size={22} />
                    <div className="text-muted-foreground">الترتيب {card.rank}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-border divide-y divide-border">
                  {[
                    ["درجة الشهري", `${card.monthly} / 20`],
                    ["نصف السنة", `${card.midterm} / 30`],
                    ["الامتحان النهائي", `${card.finalExam} / 50`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between p-3">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground">{v}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-brand-soft">
                    <span className="text-brand-strong" style={{ fontWeight: 700 }}>المجموع النهائي</span>
                    <span className="text-brand-strong" style={{ fontWeight: 700 }}>{card.total} / 100 — {card.grade}</span>
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={() => toast.success("تم تجهيز الكشف للطباعة PDF")}>
                  <Printer size={17} /> طباعة / تصدير PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
