import { describe, it, expect } from "vitest";
import { canAccess, navForRole } from "./nav";

// حارس المسارات (تجميلي في الواجهة، لكن يجب أن يطابق مصفوفة RBAC)
describe("route guards — canAccess", () => {
  it("المدير العام يصل للمدارس، والمحاسب لا", () => {
    expect(canAccess("SUPER_ADMIN", "/schools")).toBe(true);
    expect(canAccess("ACCOUNTANT", "/schools")).toBe(false);
  });

  it("مدير المدرسة يصل للقبول، وولي الأمر لا", () => {
    expect(canAccess("SCHOOL_ADMIN", "/admissions")).toBe(true);
    expect(canAccess("PARENT", "/admissions")).toBe(false);
  });

  it("ولي الأمر يصل للطلبة والرسوم والنتائج فقط ضمن حدوده", () => {
    expect(canAccess("PARENT", "/students")).toBe(true);
    expect(canAccess("PARENT", "/fees")).toBe(true);
    expect(canAccess("PARENT", "/exams")).toBe(true);
    expect(canAccess("PARENT", "/audit")).toBe(false);
    expect(canAccess("PARENT", "/settings")).toBe(false);
  });

  it("المعلم يصل للحضور، والمحاسب لا", () => {
    expect(canAccess("TEACHER", "/attendance")).toBe(true);
    expect(canAccess("ACCOUNTANT", "/attendance")).toBe(false);
  });

  it("HR يصل للموارد البشرية، والسائق للنقل", () => {
    expect(canAccess("HR", "/hr")).toBe(true);
    expect(canAccess("DRIVER", "/transport")).toBe(true);
    expect(canAccess("STUDENT", "/hr")).toBe(false);
  });

  it("المسارات الفرعية ترث صلاحية المسار الأب (/students/:id)", () => {
    expect(canAccess("SCHOOL_ADMIN", "/students/st1000")).toBe(true);
    expect(canAccess("DRIVER", "/students/st1000")).toBe(false);
  });

  it("لوحة المعلومات متاحة لكل الأدوار التسعة", () => {
    for (const role of ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "DRIVER", "HR", "AUDITOR"] as const) {
      expect(canAccess(role, "/dashboard")).toBe(true);
    }
  });

  it("navForRole يعيد فقط عناصر الدور", () => {
    const parentNav = navForRole("PARENT").map((n) => n.path);
    expect(parentNav).toContain("/dashboard");
    expect(parentNav).not.toContain("/schools");
    expect(parentNav).not.toContain("/audit");
  });
});
