import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import confetti from "canvas-confetti";
import {
  createPaymentSchema,
  formatIQD,
  PAYMENT_METHOD_LABELS,
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_LABELS,
  type CreatePaymentDto,
  type PaymentGateway,
} from "@manarah/shared";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { useFeature } from "../../features/FeatureFlagsProvider";
import { PageHeader, StatCard, StatusPill, EmptyState, QueryError } from "../shared";
import { CountUp } from "../motion";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { Skeleton } from "../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Wallet, AlertTriangle, TrendingUp, Receipt, Plus, Printer, Loader2, BellRing, Percent, Smartphone } from "lucide-react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------- سند قبض جديد
function NewPaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [studentQuery, setStudentQuery] = useState("");

  const { data: candidates } = useQuery({
    queryKey: ["fees", "unpaid", studentQuery],
    queryFn: () => api.fees.records({ query: studentQuery || undefined, pageSize: 50 }),
    enabled: open,
  });

  const unpaid = useMemo(() => (candidates?.items ?? []).filter((f) => f.paid < f.total), [candidates]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreatePaymentDto>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: { method: "CASH" },
  });

  const selectedFeeId = watch("feeRecordId");
  const amount = watch("amount");
  const selectedFee = unpaid.find((f) => f.id === selectedFeeId);
  const [gateway, setGateway] = useState<PaymentGateway>("zaincash");
  const onlinePaymentsEnabled = useFeature("ONLINE_PAYMENTS");

  // دفع إلكتروني — يولّد رابط بوابة (زين كاش…) يُفتح في نافذة/يُرسل لولي الأمر
  const checkout = useMutation({
    mutationFn: () => api.fees.checkout({ feeRecordId: selectedFeeId, amount: Number(amount), gateway }),
    onSuccess: (r) => {
      window.open(r.checkoutUrl, "_blank", "noopener");
      toast.success(`رابط دفع ${PAYMENT_GATEWAY_LABELS[gateway]} جاهز`, {
        description: "فُتحت البوابة في نافذة جديدة — يمكن إرسال الرابط لولي الأمر لإتمام الدفع.",
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر إنشاء رابط الدفع"),
  });

  const create = useMutation({
    mutationFn: (dto: CreatePaymentDto) => api.fees.createPayment(dto),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`سند قبض ${p.receiptNo}`, {
        description: "سُجّل في قاعدة البيانات وسجل التدقيق.",
        action: { label: "طباعة", onClick: () => window.open(api.fees.receiptUrl(p.id), "_blank") },
      });
      if (p.fullyPaid && !prefersReducedMotion()) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
        toast.success("🎉 اكتمل سداد رسوم الطالب بالكامل");
      }
      reset({ method: "CASH" });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إنشاء السند"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>سند قبض جديد</DialogTitle>
          <DialogDescription>يُرقَّم السند تسلسليًا تلقائيًا ولا يقبل الفراغات.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label className="text-foreground">الطالب / القسط</label>
            <Input placeholder="ابحث باسم الطالب..." value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {unpaid.length === 0 && <p className="text-muted-foreground text-center py-4">لا أقساط غير مسددة مطابقة.</p>}
              {unpaid.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setValue("feeRecordId", f.id, { shouldValidate: true })}
                  className={`w-full text-right p-2.5 flex items-center gap-2 transition-colors ${selectedFeeId === f.id ? "bg-brand-soft/60" : "hover:bg-muted/60"}`}
                >
                  <span className="text-foreground">{f.student?.name}</span>
                  <span className="text-muted-foreground">{f.plan}</span>
                  <span className="text-destructive mr-auto">{formatIQD(f.total - f.paid)} متبقٍ</span>
                </button>
              ))}
            </div>
            {errors.feeRecordId && <p className="text-destructive">{errors.feeRecordId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-foreground">المبلغ (د.ع)</label>
              <Input type="number" dir="ltr" {...register("amount", { valueAsNumber: true })} aria-invalid={!!errors.amount} />
              {errors.amount && <p className="text-destructive">{errors.amount.message}</p>}
              {selectedFee && (
                <button type="button" className="text-brand hover:underline" onClick={() => setValue("amount", selectedFee.total - selectedFee.paid, { shouldValidate: true })}>
                  كامل المتبقي: {formatIQD(selectedFee.total - selectedFee.paid)}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground">طريقة الدفع</label>
              <select {...register("method")} className="w-full h-9 rounded-md border border-input bg-input-background px-3">
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-foreground">ملاحظة (اختياري)</label>
            <Input {...register("note")} />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={create.isPending}>
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
            {create.isPending ? "جارٍ الحفظ..." : "إصدار السند"}
          </Button>
        </form>

        {/* دفع إلكتروني — بديل عن التحصيل النقدي: يولّد رابط بوابة يُرسل لولي الأمر */}
        {onlinePaymentsEnabled && (
          <div className="mt-1 border-t border-border pt-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Smartphone size={15} className="text-brand" />
              <span>أو حصّل عبر محفظة إلكترونية (رابط دفع لولي الأمر)</span>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="pay-gateway" className="text-foreground">بوابة الدفع</label>
                <select
                  id="pay-gateway"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value as PaymentGateway)}
                  className="w-full h-9 rounded-md border border-input bg-input-background px-3"
                >
                  {PAYMENT_GATEWAYS.map((g) => (
                    <option key={g} value={g}>{PAYMENT_GATEWAY_LABELS[g]}</option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!selectedFeeId || !amount || amount <= 0 || checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                {checkout.isPending ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                رابط دفع
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- قسط جديد
function NewFeeRecordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [plan, setPlan] = useState("قسط سنوي");
  const [total, setTotal] = useState(1500000);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: students } = useQuery({
    queryKey: ["students", { q: query, filter: "active", page: 1 }],
    queryFn: () => api.students.list({ query: query || undefined, status: "active", pageSize: 8 }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => api.fees.createRecord({ studentId, plan, total, dueDate }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      toast.success(`أُنشئ قسط ${formatIQD(f.total)} للطالب ${f.student?.name}`, { description: "سُجّل في التدقيق." });
      setStudentId("");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إنشاء القسط"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>قسط جديد</DialogTitle>
          <DialogDescription>مطالبة مالية لطالب — تظهر في كشف حسابه فورًا.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="ابحث عن الطالب..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-36 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {(students?.items ?? []).map((s) => (
              <button key={s.id} type="button" onClick={() => setStudentId(s.id)} className={`w-full text-right p-2.5 ${studentId === s.id ? "bg-brand-soft/60" : "hover:bg-muted/60"}`}>
                {s.name} <span className="text-muted-foreground">({s.code})</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label>الخطة</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full h-9 rounded-md border border-input bg-input-background px-3">
                {["قسط سنوي", "٣ أقساط", "٤ أقساط", "قسط فصلي"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label>المبلغ (د.ع)</label>
              <Input type="number" dir="ltr" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label>تاريخ الاستحقاق</label>
            <Input type="date" dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button className="w-full gap-2" disabled={!studentId || total <= 0 || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            إنشاء القسط
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- خصم/منحة
function DiscountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [percent, setPercent] = useState(10);
  const [reason, setReason] = useState("");

  const { data: students } = useQuery({
    queryKey: ["students", { q: query, filter: "active", page: 1 }],
    queryFn: () => api.students.list({ query: query || undefined, status: "active", pageSize: 8 }),
    enabled: open,
  });

  const grant = useMutation({
    mutationFn: () => api.fees.createDiscount({ studentId, percent, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      toast.success(`مُنح خصم ${percent}% — أُعيد احتساب الأقساط غير المسددة`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل منح الخصم"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>منح خصم / منحة</DialogTitle>
          <DialogDescription>يُطبَّق على الأقساط غير المسددة ويُسجَّل بقيد تدقيق.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="ابحث عن الطالب..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-36 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {(students?.items ?? []).map((s) => (
              <button key={s.id} type="button" onClick={() => setStudentId(s.id)} className={`w-full text-right p-2.5 ${studentId === s.id ? "bg-brand-soft/60" : "hover:bg-muted/60"}`}>
                {s.name} <span className="text-muted-foreground">({s.code})</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label>النسبة %</label>
              <Input type="number" min={1} max={100} dir="ltr" value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label>السبب</label>
              <Input placeholder="منحة تفوق..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <Button className="w-full gap-2" disabled={!studentId || !reason.trim() || grant.isPending} onClick={() => grant.mutate()}>
            {grant.isPending ? <Loader2 size={16} className="animate-spin" /> : <Percent size={16} />}
            منح الخصم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- الصفحة
export function Fees() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [recordsFilter, setRecordsFilter] = useState("all");

  const canManage = user?.role === "SCHOOL_ADMIN" || user?.role === "ACCOUNTANT";

  const { data: stats } = useQuery({
    queryKey: ["fees", "stats"],
    queryFn: () => api.fees.stats(),
    enabled: canManage || user?.role === "SUPER_ADMIN" || user?.role === "AUDITOR",
  });
  const { data: records, isLoading: recordsLoading, isError: recordsError, error: recordsErrObj, refetch: refetchRecords } = useQuery({
    queryKey: ["fees", "records", recordsFilter],
    queryFn: () => api.fees.records({ status: recordsFilter, pageSize: 50 }),
  });
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.fees.payments({ pageSize: 50 }),
  });

  const remind = useMutation({
    mutationFn: () =>
      api.messages.create({
        title: "تذكير بقسط مستحق",
        body: "نودّ تذكيركم بوجود قسط مستحق غير مسدد. يرجى مراجعة إدارة المدرسة أو التسديد في أقرب وقت. شكرًا لتعاونكم.",
        channel: "IN_APP",
        audience: { kind: "ALL_PARENTS" },
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success(`أُرسل التذكير إلى ${m.recipients} وليّ أمر`, { description: "سُجّل في سجل الرسائل والتدقيق." });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إرسال التذكير"),
  });

  const overdue = (records?.items ?? []).filter((f) => f.status === "overdue");

  return (
    <div>
      <PageHeader
        title="الرسوم والمالية"
        subtitle="خطط الرسوم، الأقساط، السندات، ومتابعة الديون"
        action={
          canManage && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setFeeOpen(true)}>
                <Plus size={16} /> قسط جديد
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setDiscountOpen(true)}>
                <Percent size={16} /> خصم / منحة
              </Button>
              <Button className="gap-2" onClick={() => setPayOpen(true)}>
                <Plus size={17} /> سند قبض
              </Button>
            </>
          )
        }
      />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <StatCard icon={Wallet} label="إجمالي التحصيل" value="" render={<CountUp value={stats.collected} format={(n) => formatIQD(Math.round(n))} />} tone="success" />
          <StatCard icon={AlertTriangle} label="الديون المتبقية" value="" render={<CountUp value={stats.outstanding} format={(n) => formatIQD(Math.round(n))} />} tone="danger" />
          <StatCard icon={TrendingUp} label="نسبة التحصيل" value={`${stats.collectionRate}%`} tone="info" />
          <StatCard icon={Receipt} label="سندات هذا الشهر" value="" render={<CountUp value={stats.receiptsThisMonth} />} tone="brand" />
        </div>
      )}

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">الأقساط والديون</TabsTrigger>
          <TabsTrigger value="payments">سندات القبض</TabsTrigger>
          <TabsTrigger value="overdue">
            المتأخرات {overdue.length > 0 && <span className="mr-1 px-1.5 rounded-full bg-destructive/15 text-destructive">{overdue.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <Card className="p-4 gap-3">
            <div className="flex gap-1.5">
              {[
                ["all", "الكل"],
                ["paid", "مسدّد"],
                ["partial", "جزئي"],
                ["overdue", "متأخر"],
              ].map(([k, l]) => (
                <Button key={k} size="sm" variant={recordsFilter === k ? "default" : "outline"} onClick={() => setRecordsFilter(k)}>
                  {l}
                </Button>
              ))}
            </div>
            {recordsError ? (
              <QueryError error={recordsErrObj} onRetry={() => refetchRecords()} />
            ) : recordsLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : (records?.items ?? []).length === 0 ? (
              <EmptyState icon={Wallet} title="لا أقساط مطابقة" />
            ) : (
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
                    {(records?.items ?? []).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-foreground">{f.student?.name}</TableCell>
                        <TableCell>{f.plan}</TableCell>
                        <TableCell>{formatIQD(f.total)}</TableCell>
                        <TableCell>{formatIQD(f.paid)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={(f.paid / f.total) * 100} className="w-24" />
                            <span className="text-muted-foreground">{Math.round((f.paid / f.total) * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell dir="ltr">{f.dueDate}</TableCell>
                        <TableCell><StatusPill status={f.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="p-4">
            {paymentsLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم السند</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الطريقة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المحصِّل</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payments?.items ?? []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-brand">{p.receiptNo}</TableCell>
                        <TableCell className="text-foreground">{p.student?.name}</TableCell>
                        <TableCell>{formatIQD(p.amount)}</TableCell>
                        <TableCell>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}</TableCell>
                        <TableCell dir="ltr">{new Date(p.createdAt).toLocaleDateString("ar-IQ-u-nu-latn")}</TableCell>
                        <TableCell>{p.receivedBy}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => window.open(api.fees.receiptUrl(p.id), "_blank")}>
                            <Printer size={15} /> طباعة
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          <Card className="p-4 gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-muted-foreground">{overdue.length} قسط متأخر عن موعد استحقاقه.</p>
              {canManage && overdue.length > 0 && (
                <Button className="gap-2" onClick={() => remind.mutate()} disabled={remind.isPending}>
                  {remind.isPending ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
                  تذكير جماعي لأولياء الأمور
                </Button>
              )}
            </div>
            {overdue.length === 0 ? (
              <EmptyState icon={Wallet} title="لا متأخرات 🎉" hint="كل الأقساط ضمن مواعيدها." />
            ) : (
              <div className="divide-y divide-border">
                {overdue.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-2.5 flex-wrap">
                    <span className="text-foreground">{f.student?.name}</span>
                    <span className="text-muted-foreground">{f.plan}</span>
                    <span className="text-muted-foreground" dir="ltr">استحقاق {f.dueDate}</span>
                    <span className="text-destructive mr-auto" style={{ fontWeight: 700 }}>{formatIQD(f.total - f.paid)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <NewPaymentDialog open={payOpen} onClose={() => setPayOpen(false)} />
      <DiscountDialog open={discountOpen} onClose={() => setDiscountOpen(false)} />
      <NewFeeRecordDialog open={feeOpen} onClose={() => setFeeOpen(false)} />
    </div>
  );
}
