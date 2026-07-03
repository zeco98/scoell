import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { renderWithProviders } from "../../test/utils";

// mock طبقة المصادقة والـ API لعزل النموذج
const loginMock = vi.fn();
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false, login: loginMock, logout: vi.fn() }),
}));

import { Login } from "./Login";

function renderLogin() {
  return renderWithProviders(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login form", () => {
  beforeEach(() => loginMock.mockReset());

  it("يعرض حقلي البريد وكلمة المرور وزر الدخول", () => {
    renderLogin();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByLabelText("كلمة المرور")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /دخول/ })).toBeInTheDocument();
  });

  // انحدار forwardRef: لو لم يصل ref لن يقرأ RHF القيم؛ هذا الاختبار يحرس ذلك
  it("يُظهر أخطاء التحقق عند إدخال بيانات غير صالحة ولا يستدعي login", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "not-an-email");
    await user.type(screen.getByLabelText("كلمة المرور"), "123");
    await user.click(screen.getByRole("button", { name: /دخول/ }));

    expect(await screen.findByText("بريد إلكتروني غير صالح")).toBeInTheDocument();
    expect(screen.getByText("كلمة المرور 8 أحرف على الأقل")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  // يثبت أن ref يعمل: RHF يقرأ القيم الصحيحة ويستدعي login بها
  it("يستدعي login بالقيم الصحيحة عند إدخال بيانات سليمة", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ name: "مريم العبيدي" });
    renderLogin();
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "admin@alnoor.edu");
    await user.type(screen.getByLabelText("كلمة المرور"), "Manarah@2026");
    await user.click(screen.getByRole("button", { name: /دخول/ }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("admin@alnoor.edu", "Manarah@2026"));
  });
});
