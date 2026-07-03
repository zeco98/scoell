// مكوّنات مشتركة قابلة لإعادة الاستخدام مبنية على نظام التصميم (shadcn/ui)
import type { ReactNode } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  render,
  hint,
  trend,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** بديل اختياري لعرض القيمة (مثل عدّاد count-up متحرك) */
  render?: ReactNode;
  hint?: string;
  trend?: number;
  tone?: "brand" | "success" | "warning" | "info" | "danger";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="p-5 gap-0 flex-row items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
          {render ?? value}
        </span>
        {(hint || trend !== undefined) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {trend !== undefined && (
              <span className={`flex items-center gap-0.5 ${trend >= 0 ? "text-success" : "text-destructive"}`}>
                {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(trend)}%
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        )}
      </div>
      <div className={`size-12 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <Icon size={22} />
      </div>
    </Card>
  );
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: "نشط", cls: "bg-success/12 text-success border-success/20" },
  suspended: { label: "موقوف", cls: "bg-warning/12 text-warning border-warning/20" },
  graduated: { label: "متخرّج", cls: "bg-info/12 text-info border-info/20" },
  withdrawn: { label: "منسحب", cls: "bg-muted text-muted-foreground border-border" },
  paid: { label: "مسدّد", cls: "bg-success/12 text-success border-success/20" },
  partial: { label: "جزئي", cls: "bg-warning/12 text-warning border-warning/20" },
  overdue: { label: "متأخر", cls: "bg-destructive/12 text-destructive border-destructive/20" },
  trial: { label: "تجريبي", cls: "bg-info/12 text-info border-info/20" },
  new: { label: "جديد", cls: "bg-info/12 text-info border-info/20" },
  reviewing: { label: "قيد المراجعة", cls: "bg-warning/12 text-warning border-warning/20" },
  interview: { label: "مقابلة", cls: "bg-brand-soft text-brand border-brand/20" },
  accepted: { label: "مقبول", cls: "bg-success/12 text-success border-success/20" },
  rejected: { label: "مرفوض", cls: "bg-destructive/12 text-destructive border-destructive/20" },
  sent: { label: "أُرسلت", cls: "bg-success/12 text-success border-success/20" },
  scheduled: { label: "مجدولة", cls: "bg-info/12 text-info border-info/20" },
  draft: { label: "مسودّة", cls: "bg-muted text-muted-foreground border-border" },
  failed: { label: "فشلت", cls: "bg-destructive/12 text-destructive border-destructive/20" },
  info: { label: "معلومة", cls: "bg-info/12 text-info border-info/20" },
  warning: { label: "تحذير", cls: "bg-warning/12 text-warning border-warning/20" },
  critical: { label: "حرج", cls: "bg-destructive/12 text-destructive border-destructive/20" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={`rounded-full ${s.cls}`}>
      {s.label}
    </Badge>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 gap-2">
      <div className="size-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        <Icon size={26} />
      </div>
      <p className="text-foreground">{title}</p>
      {hint && <p className="text-muted-foreground max-w-xs">{hint}</p>}
    </div>
  );
}
