import type { Role } from "./mock";
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
  type LucideIcon,
} from "lucide-react";

export type ViewKey =
  | "dashboard"
  | "schools"
  | "admissions"
  | "students"
  | "attendance"
  | "fees"
  | "exams"
  | "communication"
  | "audit"
  | "ai"
  | "settings";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const ALL: Role[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "AUDITOR"];

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "لوحة المعلومات", icon: LayoutDashboard, roles: ALL },
  { key: "schools", label: "المدارس والاشتراكات", icon: Building2, roles: ["SUPER_ADMIN"] },
  { key: "admissions", label: "القبول والتسجيل", icon: UserPlus, roles: ["SCHOOL_ADMIN"] },
  { key: "students", label: "الطلبة", icon: GraduationCap, roles: ["SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT"] },
  { key: "attendance", label: "الحضور والغياب", icon: CalendarCheck, roles: ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT"] },
  { key: "fees", label: "الرسوم والمالية", icon: Wallet, roles: ["SCHOOL_ADMIN", "ACCOUNTANT", "PARENT"] },
  { key: "exams", label: "الامتحانات والنتائج", icon: ClipboardList, roles: ["SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT"] },
  { key: "communication", label: "التواصل والإشعارات", icon: MessageSquare, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT"] },
  { key: "ai", label: "المساعد الذكي", icon: Sparkles, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER"] },
  { key: "audit", label: "سجل التدقيق", icon: ShieldCheck, roles: ["SUPER_ADMIN", "AUDITOR", "SCHOOL_ADMIN"] },
  { key: "settings", label: "الإعدادات", icon: Settings, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}
