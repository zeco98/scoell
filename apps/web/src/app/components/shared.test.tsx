import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/utils";
import { QueryError, StatusPill } from "./shared";

describe("QueryError", () => {
  it("يعرض رسالة الخطأ وزر إعادة المحاولة ويستدعي onRetry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<QueryError error={new Error("انقطع الاتصال")} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("انقطع الاتصال")).toBeInTheDocument();

    await user.click(screen.getByText("إعادة المحاولة"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("يعرض رسالة افتراضية عند خطأ غير معروف", () => {
    renderWithProviders(<QueryError error={"nope"} />);
    // العنوان + الرسالة الافتراضية بنفس النص
    expect(screen.getAllByText("تعذّر تحميل البيانات").length).toBeGreaterThanOrEqual(1);
  });
});

describe("StatusPill", () => {
  it("يترجم الحالات المعروفة إلى العربية", () => {
    renderWithProviders(<StatusPill status="paid" />);
    expect(screen.getByText("مسدّد")).toBeInTheDocument();
  });
});
