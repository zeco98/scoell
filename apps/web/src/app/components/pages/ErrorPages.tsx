import { Link, useRouteError } from "react-router";
import { Button } from "../ui/button";
import { LogoMark } from "../../brand/Logo";
import { ShieldOff, Compass, AlertTriangle, PowerOff } from "lucide-react";

function ErrorShell({
  icon,
  code,
  title,
  hint,
}: {
  icon: React.ReactNode;
  code: string;
  title: string;
  hint: string;
}) {
  return (
    <div dir="rtl" className="min-h-[70vh] flex flex-col items-center justify-center text-center gap-4 p-8">
      <LogoMark size={52} />
      <div
        className="flex items-center gap-3 text-brand"
        style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}
      >
        {icon}
        {code}
      </div>
      <h1 className="text-foreground">{title}</h1>
      <p className="text-muted-foreground max-w-sm">{hint}</p>
      <Button asChild className="mt-2">
        <Link to="/dashboard">العودة إلى لوحة المعلومات</Link>
      </Button>
    </div>
  );
}

export function Forbidden() {
  return (
    <ErrorShell
      icon={<ShieldOff size={48} />}
      code="403"
      title="لا تملك صلاحية الوصول"
      hint="هذه الصفحة خارج صلاحيات دورك الحالي. إن كنت تعتقد أن هذا خطأ، راجع إدارة المؤسسة."
    />
  );
}

/** تُعرض عند فتح مسار مرتبط بميزة معطّلة لمؤسسة المستخدم — بدل ترك مسار ميت */
export function FeatureDisabled() {
  return (
    <ErrorShell
      icon={<PowerOff size={48} />}
      code="—"
      title="الميزة غير مفعّلة"
      hint="هذه الميزة غير مفعّلة لمؤسستك حاليًا. للاستفسار أو التفعيل تواصل مع إدارة المنصة."
    />
  );
}

export function NotFound() {
  return (
    <ErrorShell
      icon={<Compass size={48} />}
      code="404"
      title="الصفحة غير موجودة"
      hint="الرابط الذي فتحته غير صحيح أو أُزيلت صفحته."
    />
  );
}

/** يُلتقط أخطاء رسم الصفحات عبر React Router errorElement — بهوية منارة */
export function RouteError() {
  const error = useRouteError();
  // eslint-disable-next-line no-console
  console.error("RouteError:", error);
  return (
    <div dir="rtl" className="min-h-[70vh] flex flex-col items-center justify-center text-center gap-4 p-8">
      <LogoMark size={52} />
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle size={40} />
        <h1 className="text-foreground">تعذّر عرض هذه الصفحة</h1>
      </div>
      <p className="text-muted-foreground max-w-sm">
        واجهت الصفحة مشكلة غير متوقعة. أعد المحاولة، وإن استمر الأمر راجع الدعم الفني.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>إعادة التحميل</Button>
        <Button variant="outline" asChild>
          <Link to="/dashboard">لوحة المعلومات</Link>
        </Button>
      </div>
    </div>
  );
}
