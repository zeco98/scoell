import { ManarahClient, memoryTokenStore } from "@manarah/api-client";
import { QueryClient } from "@tanstack/react-query";

// الويب: access token في الذاكرة فقط؛ الـ refresh في httpOnly cookie.
// سطح المكتب (Tauri): يُستبدل المخزن بخزنة النظام عبر نفس الواجهة TokenStore.
export const api = new ManarahClient("/api", memoryTokenStore());

// البيانات المدرسية تتغير ببطء نسبي — 30 ثانية staleTime افتراضية
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
