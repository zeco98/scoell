import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import { canAccess } from "../data/nav";
import { Forbidden } from "../components/pages/ErrorPages";
import { LogoMark } from "../brand/Logo";

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
