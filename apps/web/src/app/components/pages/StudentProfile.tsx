import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatIQD } from "@manarah/shared";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, SectionCard, StatusPill, EmptyState, QueryError } from "../shared";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { Role } from "@manarah/shared";
import { ArrowRight, Archive, ArrowLeftRight, FileText, Phone, Printer, Loader2, ClipboardList, Award, ScrollText, Wallet, ChevronDown } from "lucide-react";

const MARK_LABELS: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", early: "خروج مبكر" };

export function StudentProfile() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const { data: s, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["student", id],
    queryFn: () => api.students.detail(id),
    enabled: !!id,
  });

  const { data: sections } = useQuery({
    queryKey: ["sections"],
    queryFn: () => api.sections.list(),
    enabled: user?.role === "SCHOOL_ADMIN",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["student", id] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const changeStatus = useMutation({
    mutationFn: (status: string) => api.students.changeStatus(id, status),
    onSuccess: () => {
      invalidate();
      toast.success("تم تغيير حالة الطالب — سُجّلت في التدقيق");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل تغيير الحالة"),
  });

  const moveSection = useMutation({
    mutationFn: (sectionId: string) => api.students.moveSection(id, sectionId),
    onSuccess: () => {
      invalidate();
      setMoveOpen(false);
      toast.success("تم نقل الطالب إلى الشعبة الجديدة");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل النقل"),
  });

  const archive = useMutation({
    mutationFn: () => api.students.archive(id),
    onSuccess: () => {
      invalidate();
      toast.success("تمت أرشفة الطالب (حذف منطقي بقيد تدقيق)");
      navigate("/students");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشلت الأرشفة"),
  });

  if (isError) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="gap-1 mb-3 -mr-2" onClick={() => navigate("/students")}>
          <ArrowRight size={16} /> عودة للطلبة
        </Button>
        <QueryError error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !s) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const latestResult = s.examResults[0];

  // العام الدراسي للوثائق: من آخر نتيجة إن وُجدت، وإلا الافتراضي
  const docYear = latestResult?.exam.year ?? "2025-2026";
  const role = user?.role;
  const can = (roles: Role[]) => !!role && roles.includes(role);
  const canCert = can(["SUPER_ADMIN", "SCHOOL_ADMIN", "PARENT", "STUDENT", "AUDITOR"]);
  const canTranscript = can(["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT", "AUDITOR"]);
  const canStatement = can(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PARENT", "STUDENT", "AUDITOR"]);
  const openDoc = (url: string) => window.open(url, "_blank");

  return (
    <div>
      <Button variant="ghost" size="sm" className="gap-1 mb-3 -mr-2" onClick={() => navigate("/students")}>
        <ArrowRight size={16} /> عودة للطلبة
      </Button>

      <PageHeader
        title={s.name}
        subtitle={`${s.code} · ${s.section ? `${s.section.stage} / ${s.section.name}` : "بلا شعبة"} · مسجّل منذ ${new Date(s.enrolledAt).toLocaleDateString("ar-IQ-u-nu-latn")}`}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={s.status} />
            {latestResult && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => openDoc(api.exams.reportCardUrl(latestResult.exam.id, s.id))}
              >
                <Printer size={16} /> كشف الدرجات
              </Button>
            )}
            {/* الوثائق الرسمية — القوالب مقيَّدة بالدور (الحكم النهائي في السيرفر) */}
            {(canCert || canTranscript || canStatement) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText size={16} /> الوثائق الرسمية <ChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {canCert && (
                    <>
                      <DropdownMenuLabel>الشهادات</DropdownMenuLabel>
                      <DropdownMenuItem className="gap-2" onClick={() => openDoc(api.documents.certificateUrl(s.id, "completion", docYear))}>
                        <Award size={15} /> شهادة إتمام
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => openDoc(api.documents.certificateUrl(s.id, "graduation", docYear))}>
                        <Award size={15} /> شهادة تخرّج
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => openDoc(api.documents.certificateUrl(s.id, "enrollment", docYear))}>
                        <ScrollText size={15} /> تأييد قيد دراسي
                      </DropdownMenuItem>
                    </>
                  )}
                  {canTranscript && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2" onClick={() => openDoc(api.documents.transcriptUrl(s.id, docYear))}>
                        <ClipboardList size={15} /> بيان الدرجات (Transcript)
                      </DropdownMenuItem>
                    </>
                  )}
                  {canStatement && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2" onClick={() => openDoc(api.documents.statementUrl(s.id))}>
                        <Wallet size={15} /> كشف الحساب المالي
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isAdmin && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setMoveOpen(true)}>
                  <ArrowLeftRight size={16} /> نقل شعبة
                </Button>
                <Button variant="outline" className="gap-2 text-destructive" onClick={() => setArchiveOpen(true)}>
                  <Archive size={16} /> أرشفة
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        {[
          ["وليّ الأمر", s.guardianName],
          ["هاتف وليّ الأمر", s.guardianPhone],
          ["الرصيد المتبقي", s.balance && s.balance > 0 ? formatIQD(s.balance) : "مسدّد بالكامل ✓"],
          ["الجنس", s.gender === "FEMALE" ? "أنثى" : "ذكر"],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-card border border-border p-4">
            <div className="text-muted-foreground">{k}</div>
            <div className="text-foreground mt-0.5" style={{ fontWeight: 600 }} dir={k === "هاتف وليّ الأمر" ? "ltr" : "rtl"}>{v}</div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-muted-foreground">تغيير الحالة:</span>
          {["active", "suspended", "graduated", "withdrawn"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={s.status === st ? "default" : "outline"}
              disabled={changeStatus.isPending || s.status === st}
              onClick={() => changeStatus.mutate(st)}
            >
              {{ active: "نشط", suspended: "موقوف", graduated: "متخرّج", withdrawn: "منسحب" }[st]}
            </Button>
          ))}
          {changeStatus.isPending && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
        </div>
      )}

      <Tabs defaultValue="finance">
        <TabsList>
          <TabsTrigger value="finance">المالية</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
          <TabsTrigger value="results">النتائج</TabsTrigger>
          <TabsTrigger value="info">معلومات إضافية</TabsTrigger>
        </TabsList>

        <TabsContent value="finance" className="mt-4 space-y-4">
          <SectionCard title="كشف الحساب">
            {s.feeRecords.length === 0 ? (
              <EmptyState icon={ClipboardList} title="لا أقساط مسجّلة" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الخطة</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">المسدّد</TableHead>
                      <TableHead className="text-right">الاستحقاق</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.feeRecords.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.plan}</TableCell>
                        <TableCell>{formatIQD(f.total)}</TableCell>
                        <TableCell>{formatIQD(f.paid)}</TableCell>
                        <TableCell dir="ltr">{f.dueDate}</TableCell>
                        <TableCell><StatusPill status={f.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="سندات القبض">
            {s.feeRecords.flatMap((f) => f.payments).length === 0 ? (
              <p className="text-muted-foreground">لا سندات بعد.</p>
            ) : (
              <div className="divide-y divide-border">
                {s.feeRecords
                  .flatMap((f) => f.payments)
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-brand" style={{ fontWeight: 600 }}>{p.receiptNo}</span>
                      <span className="text-foreground">{formatIQD(p.amount)}</span>
                      <span className="text-muted-foreground mr-auto" dir="ltr">{new Date(p.createdAt).toLocaleDateString("ar-IQ-u-nu-latn")}</span>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(api.fees.receiptUrl(p.id), "_blank")}>
                        <Printer size={14} /> طباعة
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </SectionCard>

          {s.discounts.length > 0 && (
            <SectionCard title="الخصومات والمنح">
              <div className="space-y-2">
                {s.discounts.map((d) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <span className="text-foreground">{d.reason}</span>
                    <span className="text-success" style={{ fontWeight: 700 }}>{d.percent}%</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <SectionCard title="آخر 30 يومًا">
            {s.attendance.length === 0 ? (
              <p className="text-muted-foreground">لا سجلات حضور بعد.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {s.attendance.map((a) => (
                  <div
                    key={a.id}
                    title={`${a.date} — ${MARK_LABELS[a.mark]}${a.note ? ` (${a.note})` : ""}`}
                    className={`size-9 rounded-lg flex items-center justify-center text-white ${
                      a.mark === "present" ? "bg-success" : a.mark === "absent" ? "bg-destructive" : a.mark === "late" ? "bg-warning" : "bg-info"
                    }`}
                    style={{ fontSize: 11 }}
                  >
                    {a.date.slice(8)}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <SectionCard title="نتائج الامتحانات">
            {s.examResults.length === 0 ? (
              <p className="text-muted-foreground">لا نتائج بعد.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الامتحان</TableHead>
                      <TableHead className="text-right">المادة</TableHead>
                      <TableHead className="text-right">المجموع</TableHead>
                      <TableHead className="text-right">التقدير</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.examResults.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.exam.name}</TableCell>
                        <TableCell>{r.exam.subject}</TableCell>
                        <TableCell className="text-brand" style={{ fontWeight: 700 }}>{r.total} / 100</TableCell>
                        <TableCell>{r.grade}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(api.exams.reportCardUrl(r.exam.id, s.id), "_blank")}>
                            <FileText size={14} /> كشف
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <SectionCard title="معلومات إضافية">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-muted-foreground">العنوان</div>
                <div className="text-foreground">{s.address || "غير مسجّل"}</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-muted-foreground">ملاحظات صحية</div>
                <div className="text-foreground">{s.healthNotes || "لا توجد"}</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-muted-foreground">الوثائق المرفوعة</div>
                <div className="text-foreground">{s.documents.length > 0 ? `${s.documents.length} وثيقة` : "لا وثائق بعد"}</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-muted-foreground flex items-center gap-1"><Phone size={13} /> تواصل</div>
                <a className="text-brand hover:underline" href={`tel:${s.guardianPhone}`} dir="ltr">{s.guardianPhone}</a>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* أرشفة — تأكيد إلزامي */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>أرشفة الطالب {s.name}؟</AlertDialogTitle>
            <AlertDialogDescription>
              حذف منطقي (soft delete): يختفي من القوائم لكن سجلاته المالية والأكاديمية تبقى، والعملية تُسجَّل في سجل التدقيق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => archive.mutate()}>
              {archive.isPending ? "جارٍ الأرشفة..." : "تأكيد الأرشفة"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نقل شعبة */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>نقل {s.name} إلى شعبة أخرى</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 max-h-72 overflow-y-auto">
            {(sections ?? []).map((sec) => (
              <Button
                key={sec.id}
                variant={s.section?.id === sec.id ? "default" : "outline"}
                disabled={moveSection.isPending || s.section?.id === sec.id}
                onClick={() => moveSection.mutate(sec.id)}
                className="justify-between"
              >
                {sec.label}
                <span className="text-muted-foreground">{sec.studentCount} طالب</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
