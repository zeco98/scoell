import type { Role } from "@manarah/shared";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  GraduationCap,
  CalendarCheck,
  Wallet,
  ClipboardList,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Settings,
  Users,
  Bus,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const ALL: Role[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "ACCOUNTANT",
  "TEACHER",
  "PARENT",
  "STUDENT",
  "DRIVER",
  "HR",
  "AUDITOR",
];

export const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "لوحة المعلومات", icon: LayoutDashboard, roles: ALL },
  { path: "/schools", label: "المدارس والاشتراكات", icon: Building2, roles: ["SUPER_ADMIN"] },
  { path: "/school-features", label: "ميزات المدارس", icon: ToggleLeft, roles: ["SUPER_ADMIN"] },
  { path: "/admissions", label: "القبول والتسجيل", icon: UserPlus, roles: ["SCHOOL_ADMIN"] },
  { path: "/students", label: "الطلبة", icon: GraduationCap, roles: ["SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT"] },
  { path: "/attendance", label: "الحضور والغياب", icon: CalendarCheck, roles: ["SCHOOL_ADMIN", "TEACHER"] },
  { path: "/fees", label: "الرسوم والمالية", icon: Wallet, roles: ["SCHOOL_ADMIN", "ACCOUNTANT", "PARENT"] },
  { path: "/exams", label: "الامتحانات والنتائج", icon: ClipboardList, roles: ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT"] },
  { path: "/communication", label: "التواصل والإشعارات", icon: MessageSquare, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER"] },
  { path: "/hr", label: "الموارد البشرية", icon: Users, roles: ["SCHOOL_ADMIN", "HR"] },
  { path: "/transport", label: "النقل المدرسي", icon: Bus, roles: ["SCHOOL_ADMIN", "DRIVER"] },
  { path: "/ai", label: "المساعد الذكي", icon: Sparkles, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { path: "/audit", label: "سجل التدقيق", icon: ShieldCheck, roles: ["SUPER_ADMIN", "AUDITOR", "SCHOOL_ADMIN"] },
  { path: "/settings", label: "الإعدادات", icon: Settings, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

/** هل يحق للدور فتح هذا المسار؟ (الحكم الحقيقي في السيرفر — هذا تجميلي) */
export function canAccess(role: Role, path: string): boolean {
  const item = NAV_ITEMS.find((n) => path === n.path || path.startsWith(n.path + "/"));
  return item ? item.roles.includes(role) : true;
}
