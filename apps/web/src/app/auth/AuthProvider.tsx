import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUserInfo } from "@manarah/api-client";
import { api, queryClient } from "../lib/api";

interface AuthState {
  user: AuthUserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUserInfo>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // عند التحميل: محاولة استئناف الجلسة عبر refresh cookie ثم /auth/me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.auth.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // انتهاء الجلسة من أي طلب → خروج فوري للواجهة
  useEffect(() => {
    api.onSessionExpired = () => setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.auth.login(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    queryClient.clear();
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth خارج AuthProvider");
  return ctx;
}
