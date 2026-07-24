import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ROLE_LABELS } from "@manarah/shared";
import { toast } from "sonner";
import { api } from "./lib/api";
import { useAuth } from "./auth/AuthProvider";
import { navForRole } from "./data/nav";
import { useFeature, useFeatureFlags } from "./features/FeatureFlagsProvider";
import { FEATURE_NAV_MAP } from "./features/featureMap";
import { LogoFull } from "./brand/Logo";
import { PageTransition } from "./components/motion";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Toaster } from "./components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Search, Bell, LogOut, Menu, X, ChevronDown, CheckCheck, GraduationCap, Receipt, MessageSquare, KeyRound } from "lucide-react";

function NotificationsBell() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(),
    refetchInterval: 30_000,
  });
  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-destructive text-white flex items-center justify-center" style={{ fontSize: 10.5, fontWeight: 700 }}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-0" dir="rtl">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-foreground" style={{ fontWeight: 700 }}>الإشعارات</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="gap-1 text-brand" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck size={15} /> تعليم الكل كمقروء
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {(data?.items ?? []).length === 0 && (
            <p className="text-muted-foreground text-center py-10">لا إشعارات بعد.</p>
          )}
          {(data?.items ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => !n.readAt && markOne.mutate(n.id)}
              className={`w-full text-right p-3 hover:bg-muted/60 transition-colors ${n.readAt ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2">
                {!n.readAt && <span className="size-2 rounded-full bg-brand shrink-0" />}
                <span className="text-foreground" style={{ fontWeight: 600 }}>{n.title}</span>
                <span className="text-muted-foreground mr-auto" style={{ fontSize: 11 }}>
                  {new Date(n.createdAt).toLocaleDateString("ar-IQ-u-nu-latn")}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5">{n.body}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const hasResults = data && (data.students.length || data.payments.length || data.messages.length);

  return (
    <div className="relative flex-1 max-w-md hidden sm:block" ref={boxRef}>
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
      <Input
        className="pr-10 bg-input-background border-transparent"
        placeholder="بحث عن طالب، سند، رسالة..."
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute top-11 inset-x-0 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden" dir="rtl">
          {!hasResults && <p className="text-muted-foreground text-center py-6">لا نتائج مطابقة.</p>}
          {data?.students.map((s) => (
            <button key={s.id} className="w-full text-right px-3 py-2.5 hover:bg-muted/60 flex items-center gap-2" onClick={() => { setOpen(false); setQ(""); navigate(`/students/${s.id}`); }}>
              <GraduationCap size={16} className="text-brand shrink-0" />
              <span className="text-foreground">{s.name}</span>
              <span className="text-muted-foreground mr-auto">{s.section ? `${s.section.stage}/${s.section.name}` : s.code}</span>
            </button>
          ))}
          {data?.payments.map((p) => (
            <button key={p.id} className="w-full text-right px-3 py-2.5 hover:bg-muted/60 flex items-center gap-2" onClick={() => { setOpen(false); setQ(""); navigate("/fees?tab=payments"); }}>
              <Receipt size={16} className="text-info shrink-0" />
              <span className="text-foreground">{p.receiptNo}</span>
              <span className="text-muted-foreground mr-auto">{p.student.name}</span>
            </button>
          ))}
          {data?.messages.map((m) => (
            <button key={m.id} className="w-full text-right px-3 py-2.5 hover:bg-muted/60 flex items-center gap-2" onClick={() => { setOpen(false); setQ(""); navigate("/communication"); }}>
              <MessageSquare size={16} className="text-warning shrink-0" />
              <span className="text-foreground truncate">{m.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { features } = useFeatureFlags();
  const notificationsEnabled = useFeature("NOTIFICATIONS");
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  // إخفاء عناصر القائمة المرتبطة بميزة معطّلة لمؤسسة المستخدم (دفاعي — الحكم الحقيقي في السيرفر)
  const items = navForRole(user.role).filter((item) => {
    const key = FEATURE_NAV_MAP[item.path];
    return !key || features[key];
  });

  async function onLogout() {
    await logout();
    toast.success("تم تسجيل الخروج");
    navigate("/login");
  }

  const SidebarContent = (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <LogoFull tone="dark" size={34} />
        <button className="lg:hidden text-sidebar-foreground/70" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة">
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-right ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
                }`
              }
            >
              <Icon size={19} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="size-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: user.avatarColor }}>
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate">{user.name}</div>
            <div className="truncate text-sidebar-foreground/60">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="h-screen w-full flex bg-background overflow-hidden">
      <aside className="hidden lg:block w-64 shrink-0">{SidebarContent}</aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed right-0 top-0 bottom-0 w-72 z-50 lg:hidden">{SidebarContent}</aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-border bg-card px-4 lg:px-6 flex items-center gap-3">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة">
            <Menu size={22} />
          </button>
          <GlobalSearch />
          <div className="flex-1 sm:hidden" />
          <div className="flex items-center gap-1.5">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-soft text-brand">
              {user.tenantName ?? "المنصة"}
            </span>
            {notificationsEnabled && <NotificationsBell />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <div className="size-8 rounded-full flex items-center justify-center text-white" style={{ background: user.avatarColor }}>
                    {user.name.charAt(0)}
                  </div>
                  <ChevronDown size={16} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>
                  <div>{user.name}</div>
                  <div className="text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2">
                  <KeyRound size={16} />
                  تغيير كلمة المرور
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-destructive gap-2">
                  <LogOut size={16} />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <Toaster position="top-center" richColors dir="rtl" />
    </div>
  );
}
