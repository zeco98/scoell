import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/utils";
import type { PaymentItem } from "@manarah/api-client";

// mock طبقة الـ API لعزل صفحة الرسوم عن الشبكة الفعلية
const recordsMock = vi.fn();
const paymentsMock = vi.fn();
const statsMock = vi.fn();
vi.mock("../../lib/api", () => ({
  api: {
    fees: {
      records: (...args: unknown[]) => recordsMock(...args),
      payments: (...args: unknown[]) => paymentsMock(...args),
      stats: (...args: unknown[]) => statsMock(...args),
      requestVoid: vi.fn(),
      approveVoid: vi.fn(),
      rejectVoid: vi.fn(),
      receiptUrl: (id: string) => `/api/payments/${id}/receipt`,
    },
    messages: { create: vi.fn() },
  },
}));

// مزوّد أعلام الميزات — الدفع الإلكتروني غير مطلوب لهذا الاختبار
vi.mock("../../features/FeatureFlagsProvider", () => ({
  useFeature: () => true,
}));

let mockUser: { role: string } | null = null;
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { Fees } from "./Fees";

const pendingPayment: PaymentItem = {
  id: "pay-1",
  receiptNo: "RC-2026-1001",
  amount: 100000,
  method: "CASH",
  createdAt: new Date().toISOString(),
  receivedBy: "محاسب أ",
  voidStatus: "PENDING",
  voidReason: "خطأ إدخال",
  student: { id: "st1", name: "طالب الاختبار" },
} as unknown as PaymentItem;

const activePayment: PaymentItem = {
  id: "pay-2",
  receiptNo: "RC-2026-1002",
  amount: 50000,
  method: "CASH",
  createdAt: new Date().toISOString(),
  receivedBy: "محاسب أ",
  voidStatus: "NONE",
  student: { id: "st2", name: "طالب آخر" },
} as unknown as PaymentItem;

describe("Fees: عرض إجراءات إلغاء السند حسب الدور", () => {
  beforeEach(() => {
    recordsMock.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    statsMock.mockReset().mockResolvedValue({ collected: 0, outstanding: 0, collectionRate: 0, receiptsThisMonth: 0, overdueCount: 0 });
    paymentsMock.mockReset().mockResolvedValue({ items: [activePayment, pendingPayment], total: 2, page: 1, pageSize: 50 });
  });

  /** يفتح تبويب «سندات القبض» — Radix Tabs لا يُركِّب محتوى التبويب غير النشط */
  async function openPaymentsTab() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "سندات القبض" }));
  }

  it("المحاسب (ACCOUNTANT) يرى زر «طلب إلغاء» على السند النشط، ولا يرى أزرار الاعتماد/الرفض", async () => {
    mockUser = { role: "ACCOUNTANT" };
    renderWithProviders(<Fees />);
    await openPaymentsTab();
    await waitFor(() => expect(screen.getByText("RC-2026-1002")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /طلب إلغاء/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /اعتماد الإلغاء/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^رفض$/ })).not.toBeInTheDocument();
  });

  it("مدير المدرسة (SCHOOL_ADMIN) يرى أزرار «اعتماد الإلغاء» و«رفض» على السند المعلَّق، ولا يرى «طلب إلغاء»", async () => {
    mockUser = { role: "SCHOOL_ADMIN" };
    renderWithProviders(<Fees />);
    await openPaymentsTab();
    await waitFor(() => expect(screen.getByText("RC-2026-1001")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /اعتماد الإلغاء/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^رفض$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /طلب إلغاء/ })).not.toBeInTheDocument();
  });

  it("مدير المدرسة لا يرى أزرار الاعتماد/الرفض على سند غير معلّق (voidStatus NONE)", async () => {
    mockUser = { role: "SCHOOL_ADMIN" };
    renderWithProviders(<Fees />);
    await openPaymentsTab();
    await waitFor(() => expect(screen.getByText("RC-2026-1002")).toBeInTheDocument());
    // السند النشط بلا حالة إلغاء معلّقة — لا اعتماد ولا رفض بجانبه
    const row = screen.getByText("RC-2026-1002").closest("tr")!;
    expect(row.querySelector("button.text-success")).toBeNull();
  });
});
