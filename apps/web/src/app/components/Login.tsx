import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate, Navigate } from "react-router";
import { loginSchema, ROLE_LABELS, type LoginDto, type Role } from "@manarah/shared";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { LogoFull, BRAND_NAME, LogoMark } from "../brand/Logo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Toaster } from "./ui/sonner";
import { ShieldCheck, LogIn, Eye, EyeOff, Loader2 } from "lucide-react";

// حسابات تجريبية — تعبئة سريعة في وضع التطوير فقط (import.meta.env.DEV)
const DEMO_ACCOUNTS: { name: string; email: string; role: Role; tenant: string; color: string }[] = [
  { name: "علي الحسيني", email: "super@manarah.io", role: "SUPER_ADMIN", tenant: "المنصة", color: "#7c3aed" },
  { name: "مريم العبيدي", email: "admin@alnoor.edu", role: "SCHOOL_ADMIN", tenant: "ثانوية النور الأهلية", color: "#0b6e63" },
  { name: "حسن الطائي", email: "acc@alnoor.edu", role: "ACCOUNTANT", tenant: "ثانوية النور الأهلية", color: "#0284c7" },
  { name: "زينب الجبوري", email: "teacher@alnoor.edu", role: "TEACHER", tenant: "ثانوية النور الأهلية", color: "#d97706" },
  { name: "أبو محمد الساعدي", email: "parent@alnoor.edu", role: "PARENT", tenant: "ثانوية النور الأهلية", color: "#e11d48" },
  { name: "محمد الساعدي", email: "student@alnoor.edu", role: "STUDENT", tenant: "ثانوية النور الأهلية", color: "#16a34a" },
  { name: "كاظم الشمري", email: "driver@alnoor.edu", role: "DRIVER", tenant: "ثانوية النور الأهلية", color: "#9333ea" },
  { name: "ليلى الموسوي", email: "hr@alnoor.edu", role: "HR", tenant: "ثانوية النور الأهلية", color: "#0f766e" },
  { name: "سالم الدليمي", email: "audit@manarah.io", role: "AUDITOR", tenant: "المنصة", color: "#475569" },
];

const DEV_PASSWORD = "Manarah@2026";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (user) {
    const from = (location.state as { from?: string })?.from ?? "/dashboard";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(data: LoginDto) {
    try {
      const u = await login(data.email, data.password);
      toast.success(`أهلاً ${u.name.split(" ")[0]} 👋`);
      navigate((location.state as { from?: string })?.from ?? "/dashboard", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تسجيل الدخول");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* اللوحة الجانبية للعلامة */}
      <div className="lg:w-[42%] p-8 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden" style={{ background: "linear-gradient(160deg, var(--brand) 0%, var(--brand-strong) 100%)" }}>
        <div className="absolute -left-16 -top-16 size-64 rounded-full opacity-10 bg-white" />
        <div className="absolute -right-10 bottom-10 size-40 rounded-full opacity-10 bg-white" />
        <LogoFull tone="dark" size={40} />
        <div className="relative z-10 my-10 lg:my-0">
          <h1 className="text-white" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.35 }}>
            نظام متكامل لإدارة<br />المؤسسات التعليمية
          </h1>
          <p className="text-white/80 mt-4 max-w-md">
            منصة {BRAND_NAME} متعددة المستأجرين لإدارة المدارس والمعاهد ورياض الأطفال —
            قبول، حضور، رسوم، امتحانات، وتقارير، بواجهة عربية كاملة.
          </p>
          <div className="flex items-center gap-2 mt-6 text-white/80">
            <ShieldCheck size={18} />
            <span>عزل كامل للبيانات بين المؤسسات + سجل تدقيق لكل عملية</span>
          </div>
        </div>
        <p className="text-white/50 relative z-10">© 2026 {BRAND_NAME} — جميع الحقوق محفوظة</p>
      </div>

      {/* نموذج الدخول */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md py-6">
          <div className="lg:hidden mb-6"><LogoMark size={44} /></div>
          <h2 className="text-foreground">تسجيل الدخول</h2>
          <p className="text-muted-foreground mt-1 mb-6">ادخل ببريدك وكلمة مرورك المسجّلين في المنصة.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mb-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-foreground">البريد الإلكتروني</label>
              <Input id="email" type="email" dir="ltr" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-foreground">كلمة المرور</label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="current-password" className="pl-10" {...register("password")} aria-invalid={!!errors.password} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <p className="text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {isSubmitting ? "جارٍ التحقق..." : "دخول"}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6">
              <p className="text-muted-foreground mb-2">تعبئة سريعة (وضع التطوير) — الأدوار التسعة:</p>
              <div className="grid gap-2 max-h-72 overflow-y-auto pl-1">
                {DEMO_ACCOUNTS.map((u) => (
                  <Card
                    key={u.email}
                    onClick={() => {
                      setValue("email", u.email, { shouldValidate: true });
                      setValue("password", DEV_PASSWORD, { shouldValidate: true });
                    }}
                    className="p-3 flex-row items-center gap-3 cursor-pointer transition-colors hover:bg-muted/60"
                  >
                    <div className="size-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: u.color }}>
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground truncate">{u.name}</div>
                      <div className="text-muted-foreground truncate">{ROLE_LABELS[u.role]} · {u.tenant}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Toaster position="top-center" richColors dir="rtl" />
    </div>
  );
}
