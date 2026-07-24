import type { FeatureKey } from "@manarah/shared";

// ---------------------------------------------------------------------------
// نقطة التوسّع الوحيدة لربط مسارات/عناصر التنقّل الحالية بمفاتيح الميزات.
// لإضافة ميزة مستقبلية مرتبطة بصفحة جديدة: أضف سطرًا واحدًا هنا فقط —
// حارس المسار (RequireFeature) وإخفاء التنقّل (Layout) يقرآن من هذا الملف تلقائيًا.
// ---------------------------------------------------------------------------
export const FEATURE_ROUTE_MAP: Partial<Record<string, FeatureKey>> = {
  "/ai": "AI_ASSISTANT",
  "/fees": "ACCOUNTING",
  "/attendance": "ATTENDANCE",
  "/exams": "EXAMS", // يضم أيضًا إدخال/عرض الدرجات والنتائج ضمن الصفحة ذاتها
  "/transport": "TRANSPORTATION",

  // ميزات بلا مسار/صفحة مستقلة قائمة حاليًا — إدخالات جاهزة بلا تأثير (no-op)
  // حتى تُضاف صفحاتها لاحقًا:
  // "/library": "LIBRARY",
  // "/reports": "REPORTS",
  // "/analytics": "ANALYTICS_DASHBOARD",
  // "/files": "FILE_MANAGER",
  // "/api-access": "API_ACCESS",
  // "/backup": "BACKUP_RESTORE",
  // ملاحظة: GRADES_RESULTS و CERTIFICATES_DOCUMENTS و ONLINE_PAYMENTS و
  // NOTIFICATIONS تُطبَّق كعناصر تحكم داخل صفحات قائمة (وليست مسارات مستقلة) —
  // راجع StudentProfile وFees وLayout.
};

/** عناصر التنقّل (الشريط الجانبي) تتقاسم نفس خريطة المسارات */
export const FEATURE_NAV_MAP = FEATURE_ROUTE_MAP;

/** يعيد مفتاح الميزة المرتبط بمسار (أو مساره الفرعي) إن وُجد */
export function featureForPath(pathname: string): FeatureKey | undefined {
  const match = Object.keys(FEATURE_ROUTE_MAP).find((p) => pathname === p || pathname.startsWith(p + "/"));
  return match ? FEATURE_ROUTE_MAP[match] : undefined;
}
