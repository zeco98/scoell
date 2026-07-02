import { useState } from "react";
import type { AppUser } from "./data/mock";
import type { ViewKey } from "./data/nav";
import { navForRole } from "./data/nav";
import { Login } from "./components/Login";
import { AppShell } from "./components/AppShell";
import { Toaster } from "./components/ui/sonner";

import { Dashboard } from "./components/pages/Dashboard";
import { Schools } from "./components/pages/Schools";
import { Admissions } from "./components/pages/Admissions";
import { Students } from "./components/pages/Students";
import { Attendance } from "./components/pages/Attendance";
import { Fees } from "./components/pages/Fees";
import { Exams } from "./components/pages/Exams";
import { Communication } from "./components/pages/Communication";
import { AiAssistant } from "./components/pages/AiAssistant";
import { AuditLog } from "./components/pages/AuditLog";
import { Settings } from "./components/pages/Settings";

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<ViewKey>("dashboard");

  if (!user) {
    return (
      <>
        <Login
          onLogin={(u) => {
            setUser(u);
            setView("dashboard");
          }}
        />
        <Toaster position="top-center" richColors dir="rtl" />
      </>
    );
  }

  // حماية المسارات: لا يُعرض أي view خارج صلاحيات الدور
  const allowed = navForRole(user.role).some((n) => n.key === view);
  const activeView: ViewKey = allowed ? view : "dashboard";

  function render() {
    switch (activeView) {
      case "dashboard":
        return <Dashboard user={user!} />;
      case "schools":
        return <Schools />;
      case "admissions":
        return <Admissions />;
      case "students":
        return <Students user={user!} />;
      case "attendance":
        return <Attendance />;
      case "fees":
        return <Fees />;
      case "exams":
        return <Exams />;
      case "communication":
        return <Communication />;
      case "ai":
        return <AiAssistant />;
      case "audit":
        return <AuditLog />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard user={user!} />;
    }
  }

  return (
    <>
      <AppShell user={user} view={activeView} onNavigate={setView} onLogout={() => setUser(null)}>
        {render()}
      </AppShell>
      <Toaster position="top-center" richColors dir="rtl" />
    </>
  );
}
