import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { FEATURES, type FeatureKey } from "@manarah/shared";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { LogoMark } from "../brand/Logo";

type FeatureMap = Record<FeatureKey, boolean>;

function allEnabled(): FeatureMap {
  return Object.fromEntries(FEATURES.map((f) => [f.key, true])) as FeatureMap;
}

interface FeatureFlagsState {
  /** خريطة المفتاح ← مفعّلة؟ (القيمة النهائية بعد التحميل، أو الكل مفعّل مؤقتًا أثناء ذلك) */
  features: FeatureMap;
  loading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsState | null>(null);

/**
 * يجلب أعلام الميزات لمؤسسة المستخدم الحالي مرة واحدة بعد الدخول، ويعرضها عبر
 * السياق. حسابات مستوى المنصة (بلا مؤسسة، أي SUPER_ADMIN) تُعامَل بكل الميزات
 * مفعّلة دون طلب شبكة. أثناء الجلب لا نُخفي أي عنصر (لا وميض إخفاء) — نعرض
 * شاشة تحميل قصيرة إلى حين استقرار القيم الحقيقية.
 */
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [features, setFeatures] = useState<FeatureMap>(allEnabled());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user?.tenantId) {
      // مالك المنصة (SUPER_ADMIN بلا مؤسسة) — كل الميزات متاحة له دائمًا
      setFeatures(allEnabled());
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const { features: list } = await api.tenants.getMyFeatures();
        if (cancelled) return;
        const map = allEnabled();
        for (const f of list) map[f.key] = f.enabled;
        setFeatures(map);
      } catch {
        // فشل الجلب لا يجب أن يخفي كل شيء — نُبقي الافتراضي (الكل مفعّل)
        if (!cancelled) setFeatures(allEnabled());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.tenantId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="animate-pulse">
          <LogoMark size={56} />
        </div>
        <p className="text-muted-foreground">جارٍ تحميل إعدادات المؤسسة...</p>
      </div>
    );
  }

  return <FeatureFlagsContext.Provider value={{ features, loading }}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagsState {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags خارج FeatureFlagsProvider");
  return ctx;
}

/** هل الميزة مفعّلة لمؤسسة المستخدم الحالي؟ */
export function useFeature(key: FeatureKey): boolean {
  const { features } = useFeatureFlags();
  return features[key] ?? true;
}
