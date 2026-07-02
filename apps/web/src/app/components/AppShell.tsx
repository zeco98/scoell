import { useState, type ReactNode } from "react";
import type { AppUser } from "../data/mock";
import { ROLE_LABELS } from "../data/mock";
import { navForRole, type ViewKey } from "../data/nav";
import { LogoFull } from "../brand/Logo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Search, Bell, LogOut, Menu, X, ChevronDown } from "lucide-react";

export function AppShell({
  user,
  view,
  onNavigate,
  onLogout,
  children,
}: {
  user: AppUser;
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navForRole(user.role);

  const SidebarContent = (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <LogoFull tone="dark" size={34} />
        <button className="lg:hidden text-sidebar-foreground/70" onClick={() => setMobileOpen(false)}>
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const active = view === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                onNavigate(item.key);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-right ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
              }`}
            >
              <Icon size={19} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
            </button>
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
      {/* Sidebar — desktop */}
      <aside className="hidden lg:block w-64 shrink-0">{SidebarContent}</aside>

      {/* Sidebar — mobile */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed right-0 top-0 bottom-0 w-72 z-50 lg:hidden">{SidebarContent}</aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 shrink-0 border-b border-border bg-card px-4 lg:px-6 flex items-center gap-3">
          <button className="lg:hidden text-muted-foreground" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input className="pr-10 bg-input-background border-transparent" placeholder="بحث عن طالب، فاتورة، رسالة..." />
          </div>
          <div className="flex-1 sm:hidden" />
          <div className="flex items-center gap-1.5">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-soft text-brand">
              {user.tenant}
            </span>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-accent" />
            </Button>
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
                <DropdownMenuItem onClick={onLogout} className="text-destructive gap-2">
                  <LogOut size={16} />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
