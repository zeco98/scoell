import { Link } from "react-router";
import { Button } from "../ui/button";
import { LogoMark } from "../../brand/Logo";
import { ShieldOff, Compass } from "lucide-react";

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
