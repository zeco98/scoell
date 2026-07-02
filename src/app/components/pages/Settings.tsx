import { PageHeader } from "../shared";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { BRAND_NAME, LogoMark } from "../../brand/Logo";

const PALETTE = [
  ["Primary", "var(--brand)"],
  ["Brand Strong", "var(--brand-strong)"],
  ["Accent", "var(--brand-accent)"],
  ["Success", "var(--success)"],
  ["Warning", "var(--warning)"],
  ["Info", "var(--info)"],
  ["Danger", "var(--destructive)"],
];

const TOGGLES = [
  ["حجب النتائج عند وجود ديون", true],
  ["إشعار ولي الأمر تلقائيًا عند الغياب", true],
  ["استخدام الأرقام الهندية (١٢٣٤)", false],
  ["تفعيل الوضع الداكن للمستخدمين", false],
] as const;

export function Settings() {
  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إعدادات المؤسسة، الهوية البصرية، والسياسات" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 gap-4">
          <h3 className="text-foreground">الهوية البصرية</h3>
          <div className="flex items-center gap-3">
            <LogoMark size={48} />
            <div>
              <div className="text-foreground" style={{ fontWeight: 700 }}>{BRAND_NAME}</div>
              <div className="text-muted-foreground">اسم العلامة قابل للتبديل عبر متغيّر واحد</div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-2">لوحة الألوان (Design Tokens)</div>
            <div className="grid grid-cols-4 gap-2">
              {PALETTE.map(([name, c]) => (
                <div key={name} className="text-center">
                  <div className="h-12 rounded-lg border border-border" style={{ background: c }} />
                  <div className="text-muted-foreground mt-1">{name}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-muted-foreground">الخط: Cairo / IBM Plex Sans Arabic — RTL كامل، تباين WCAG AA.</div>
        </Card>

        <Card className="p-5 gap-1">
          <h3 className="text-foreground mb-2">سياسات المؤسسة</h3>
          {TOGGLES.map(([label, on]) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <span className="text-foreground">{label}</span>
              <Switch defaultChecked={on} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
