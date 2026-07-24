import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { FEATURES } from "@manarah/shared";
import { renderWithProviders } from "../../test/utils";
import { navForRole } from "../data/nav";
import { FEATURE_NAV_MAP } from "./featureMap";

// mock طبقة المصادقة والـ API لعزل مزوّد أعلام الميزات
const getMyFeaturesMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: { tenants: { getMyFeatures: (...args: unknown[]) => getMyFeaturesMock(...args) } },
}));

let mockUser: { tenantId: string | null } | null = { tenantId: "tenant-a" };
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { FeatureFlagsProvider, useFeature, useFeatureFlags } from "./FeatureFlagsProvider";

function Probe() {
  const attendance = useFeature("ATTENDANCE");
  const exams = useFeature("EXAMS");
  return (
    <div>
      <span data-testid="attendance">{String(attendance)}</span>
      <span data-testid="exams">{String(exams)}</span>
    </div>
  );
}

// يقلّد فلترة القائمة الجانبية في Layout.tsx تمامًا
function NavProbe({ role }: { role: "SCHOOL_ADMIN" | "TEACHER" }) {
  const { features } = useFeatureFlags();
  const items = navForRole(role).filter((item) => {
    const key = FEATURE_NAV_MAP[item.path];
    return !key || features[key];
  });
  return (
    <ul>
      {items.map((i) => (
        <li key={i.path}>{i.path}</li>
      ))}
    </ul>
  );
}

describe("FeatureFlagsProvider / useFeature", () => {
  beforeEach(() => {
    getMyFeaturesMock.mockReset();
    mockUser = { tenantId: "tenant-a" };
  });

  it("ميزة معطّلة صراحة → useFeature يعيد false، وميزة أخرى تبقى مفعّلة", async () => {
    getMyFeaturesMock.mockResolvedValue({
      features: [{ key: "ATTENDANCE", labelAr: "الحضور والغياب", enabled: false }],
    });
    renderWithProviders(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("attendance")).toHaveTextContent("false"));
    expect(screen.getByTestId("exams")).toHaveTextContent("true");
  });

  it("مؤسسة بلا استثناءات محفوظة → كل الميزات مفعّلة", async () => {
    getMyFeaturesMock.mockResolvedValue({ features: [] });
    renderWithProviders(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("attendance")).toHaveTextContent("true"));
    expect(screen.getByTestId("exams")).toHaveTextContent("true");
  });

  it("مستخدم منصة بلا مؤسسة (tenantId=null) → كل الميزات مفعّلة بلا طلب شبكة", async () => {
    mockUser = { tenantId: null };
    renderWithProviders(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("attendance")).toHaveTextContent("true"));
    expect(getMyFeaturesMock).not.toHaveBeenCalled();
  });

  it("عنصر التنقّل المرتبط بميزة معطّلة (الحضور) يُستبعد من القائمة، بينما تبقى العناصر الأخرى", async () => {
    getMyFeaturesMock.mockResolvedValue({
      features: [{ key: "ATTENDANCE", labelAr: "الحضور والغياب", enabled: false }],
    });
    renderWithProviders(
      <FeatureFlagsProvider>
        <NavProbe role="TEACHER" />
      </FeatureFlagsProvider>,
    );
    await waitFor(() => expect(screen.queryByText("جارٍ تحميل إعدادات المؤسسة...")).not.toBeInTheDocument());
    expect(screen.queryByText("/attendance")).not.toBeInTheDocument();
    // مسار غير مرتبط بأي ميزة يبقى ظاهرًا
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
  });

  it("عنصر التنقّل يبقى ظاهرًا حين تكون الميزة مفعّلة أو بلا صف (افتراضي)", async () => {
    getMyFeaturesMock.mockResolvedValue({ features: [] });
    renderWithProviders(
      <FeatureFlagsProvider>
        <NavProbe role="TEACHER" />
      </FeatureFlagsProvider>,
    );
    await waitFor(() => expect(screen.queryByText("جارٍ تحميل إعدادات المؤسسة...")).not.toBeInTheDocument());
    expect(screen.getByText("/attendance")).toBeInTheDocument();
  });

  // عربي/RTL: التسمية العربية لميزة معطّلة سليمة (بلا مشوَّه) عبر سجل FEATURES المشترك
  it("التسمية العربية لميزة معطّلة تُقرأ كنص صحيح من سجل FEATURES المشترك", () => {
    const feature = FEATURES.find((f) => f.key === "ATTENDANCE");
    expect(feature?.labelAr).toBe("الحضور والغياب");
  });
});
