import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import { canAccess } from "../data/nav";
import { Forbidden, FeatureDisabled } from "../components/pages/ErrorPages";
import { LogoMark } from "../brand/Logo";
import { useFeatureFlags } from "../features/FeatureFlagsProvider";
import { featureForPath } from "../features/featureMap";

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <div className="animate-pulse">
        <LogoMark size={56} />
      </div>
      <p className="text-muted-foreground">جارٍ استئناف الجلسة...</p>
    </div>
  );
}

/** يتطلب جلسة صالحة — وإلا إلى صفحة الدخول */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

/** حارس الدور لكل مسار — 403 بهوية منارة عند التجاوز */
export function RequireRole() {
  const { user } = useAuth();
  const location = useLocation();
  if (user && !canAccess(user.role, location.pathname)) return <Forbidden />;
  return <Outlet />;
}

/** حارس أعلام الميزات — يمنع بقاء مسار "ميت" لميزة معطّلة لمؤسسة المستخدم
 *  (الحكم الحقيقي في السيرفر عبر 403؛ هذا دفاع إضافي على الواجهة) */
export function RequireFeature() {
  const { features } = useFeatureFlags();
  const location = useLocation();
  const key = featureForPath(location.pathname);
  if (key && !features[key]) return <FeatureDisabled />;
  return <Outlet />;
}
