// شعار العلامة التجارية "منارة" (Manarah) — برمجي SVG
// يعمل على الخلفيات الفاتحة والداكنة عبر التحكم بالألوان.

export const BRAND_NAME = "منارة";
export const BRAND_NAME_EN = "Manarah";
export const BRAND_TAGLINE = "منصة إدارة المدارس والمعاهد";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="48" height="48" rx="12" fill="var(--brand)" />
      {/* منارة / علم معرفي */}
      <path d="M24 9L38 16.5V19H10V16.5L24 9Z" fill="var(--brand-accent)" />
      <rect x="14" y="21" width="4.5" height="14" rx="1.2" fill="#ffffff" />
      <rect x="21.75" y="21" width="4.5" height="14" rx="1.2" fill="#ffffff" />
      <rect x="29.5" y="21" width="4.5" height="14" rx="1.2" fill="#ffffff" />
      <rect x="10" y="37" width="28" height="3.5" rx="1.4" fill="#ffffff" />
    </svg>
  );
}

export function LogoFull({ size = 36, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  const text = tone === "dark" ? "#ffffff" : "var(--brand-strong)";
  const sub = tone === "dark" ? "rgba(255,255,255,0.65)" : "var(--muted-foreground)";
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div style={{ color: text, fontWeight: 800, fontSize: size * 0.5 }}>{BRAND_NAME}</div>
        <div style={{ color: sub, fontSize: size * 0.3 }}>{BRAND_TAGLINE}</div>
      </div>
    </div>
  );
}
