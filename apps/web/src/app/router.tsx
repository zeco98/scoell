import { createBrowserRouter, Navigate } from "react-router";
import { RequireAuth, RequireRole } from "./auth/guards";
import { Layout } from "./Layout";
import { Login } from "./components/Login";
import { Dashboard } from "./components/pages/Dashboard";
import { Schools } from "./components/pages/Schools";
import { Admissions } from "./components/pages/Admissions";
import { Students } from "./components/pages/Students";
import { StudentProfile } from "./components/pages/StudentProfile";
import { Attendance } from "./components/pages/Attendance";
import { Fees } from "./components/pages/Fees";
import { Exams } from "./components/pages/Exams";
import { Communication } from "./components/pages/Communication";
import { AiAssistant } from "./components/pages/AiAssistant";
import { AuditLog } from "./components/pages/AuditLog";
import { Settings } from "./components/pages/Settings";
import { Hr } from "./components/pages/Hr";
import { Transport } from "./components/pages/Transport";
import { NotFound } from "./components/pages/ErrorPages";

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
            children: [
              { path: "/dashboard", element: <Dashboard /> },
              { path: "/schools", element: <Schools /> },
              { path: "/admissions", element: <Admissions /> },
              { path: "/students", element: <Students /> },
              { path: "/students/:id", element: <StudentProfile /> },
              { path: "/attendance", element: <Attendance /> },
              { path: "/fees", element: <Fees /> },
              { path: "/exams", element: <Exams /> },
              { path: "/communication", element: <Communication /> },
              { path: "/ai", element: <AiAssistant /> },
              { path: "/audit", element: <AuditLog /> },
              { path: "/settings", element: <Settings /> },
              { path: "/hr", element: <Hr /> },
              { path: "/transport", element: <Transport /> },
            ],
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
