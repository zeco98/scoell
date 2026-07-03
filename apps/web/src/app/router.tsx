import { createBrowserRouter, Navigate } from "react-router";
import { RequireAuth, RequireRole } from "./auth/guards";
import { Layout } from "./Layout";
import { Login } from "./components/Login";
import { NotFound } from "./components/pages/ErrorPages";
import { RouteError } from "./components/pages/ErrorPages";

// تقسيم الكود: كل صفحة مصادَقة تُحمَّل عند الحاجة (lazy) لتقليل حجم التحميل الأول.
// Login وصفحات الأخطاء تبقى eager لأنها مطلوبة فورًا.
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          {
            element: <RequireRole />,
            // أي خطأ رسم داخل صفحة يُلتقط هنا ويُعرض بهوية منارة داخل القشرة
            errorElement: <RouteError />,
            children: [
              { path: "/dashboard", lazy: async () => ({ Component: (await import("./components/pages/Dashboard")).Dashboard }) },
              { path: "/schools", lazy: async () => ({ Component: (await import("./components/pages/Schools")).Schools }) },
              { path: "/admissions", lazy: async () => ({ Component: (await import("./components/pages/Admissions")).Admissions }) },
              { path: "/students", lazy: async () => ({ Component: (await import("./components/pages/Students")).Students }) },
              { path: "/students/:id", lazy: async () => ({ Component: (await import("./components/pages/StudentProfile")).StudentProfile }) },
              { path: "/attendance", lazy: async () => ({ Component: (await import("./components/pages/Attendance")).Attendance }) },
              { path: "/fees", lazy: async () => ({ Component: (await import("./components/pages/Fees")).Fees }) },
              { path: "/exams", lazy: async () => ({ Component: (await import("./components/pages/Exams")).Exams }) },
              { path: "/communication", lazy: async () => ({ Component: (await import("./components/pages/Communication")).Communication }) },
              { path: "/ai", lazy: async () => ({ Component: (await import("./components/pages/AiAssistant")).AiAssistant }) },
              { path: "/audit", lazy: async () => ({ Component: (await import("./components/pages/AuditLog")).AuditLog }) },
              { path: "/settings", lazy: async () => ({ Component: (await import("./components/pages/Settings")).Settings }) },
              { path: "/hr", lazy: async () => ({ Component: (await import("./components/pages/Hr")).Hr }) },
              { path: "/transport", lazy: async () => ({ Component: (await import("./components/pages/Transport")).Transport }) },
            ],
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
