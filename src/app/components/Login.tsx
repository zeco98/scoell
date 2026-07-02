import { useState } from "react";
import { DEMO_USERS, ROLE_LABELS, type AppUser } from "../data/mock";
import { LogoFull, BRAND_NAME, LogoMark } from "../brand/Logo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { ShieldCheck, LogIn, ChevronLeft } from "lucide-react";

export function Login({ onLogin }: { onLogin: (u: AppUser) => void }) {
  const [selected, setSelected] = useState<AppUser>(DEMO_USERS[1]);

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
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6"><LogoMark size={44} /></div>
          <h2 className="text-foreground">تسجيل الدخول</h2>
          <p className="text-muted-foreground mt-1 mb-6">اختر حسابًا تجريبيًا لاستعراض المنصة بصلاحياته.</p>

          <div className="space-y-3 mb-5">
            <div className="space-y-1.5">
              <label className="text-foreground">البريد الإلكتروني</label>
              <Input value={selected.email} readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-foreground">كلمة المرور</label>
              <Input type="password" value="demo-password" readOnly />
            </div>
          </div>

          <Button className="w-full gap-2" onClick={() => onLogin(selected)}>
            <LogIn size={18} />
            دخول بصفة {ROLE_LABELS[selected.role]}
          </Button>

          <div className="mt-6">
            <p className="text-muted-foreground mb-2">حسابات تجريبية جاهزة:</p>
            <div className="grid gap-2">
              {DEMO_USERS.map((u) => (
                <Card
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={`p-3 flex-row items-center gap-3 cursor-pointer transition-colors ${
                    selected.id === u.id ? "border-brand ring-1 ring-brand/30 bg-brand-soft/40" : "hover:bg-muted/60"
                  }`}
                >
                  <div className="size-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: u.avatarColor }}>
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate">{u.name}</div>
                    <div className="text-muted-foreground truncate">{ROLE_LABELS[u.role]} · {u.tenant}</div>
                  </div>
                  {selected.id === u.id && <ChevronLeft className="text-brand" size={18} />}
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
