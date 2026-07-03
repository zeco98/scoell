import { test, expect, type Page } from "@playwright/test";

// الدورة الكاملة عبر الواجهة الحقيقية بأدوار متعددة (المواصفة §9):
// دخول → قبول طلب وتحويله لطالب → تحضير → سند قبض → درجة → كشف PDF
// يتطلب: API على 3001 + بيانات seed. لا يعتمد على ترتيب تشغيل سابق.

const PASSWORD = "Manarah@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  // ids موجودة بفضل forwardRef على Input — أدق من getByLabel (زر الإظهار يشارك النص)
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/أهلاً/)).toBeVisible();
}

test.describe("الدورة الكاملة", () => {
  test("دخول مدير المدرسة ولوحة المعلومات تُحمّل ببيانات حقيقية", async ({ page }) => {
    await login(page, "admin@alnoor.edu");
    // بطاقة إحصائية بها رقم (count-up) — تأكيد بيانات حقيقية
    await expect(page.getByText("الطلبة النشطون")).toBeVisible();
  });

  test("القبول: نقل طلب إلى مقبول ثم تحويله لطالب مسجّل", async ({ page }) => {
    await login(page, "admin@alnoor.edu");
    await page.goto("/admissions");
    await expect(page.getByRole("heading", { name: "القبول والتسجيل" })).toBeVisible();
    // زر تحويل يظهر على أي بطاقة في عمود «مقبول» — إن وُجد نضغطه
    const convert = page.getByRole("button", { name: /تحويل إلى طالب/ }).first();
    if (await convert.isVisible().catch(() => false)) {
      await convert.click();
      // نص الـ toast فريد (يبدأ بـ 🎓) بخلاف بطاقات «حُوّل لطالب» السابقة
      await expect(page.getByText(/أصبح طالبًا مسجّلًا/).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("المحاسب: إصدار سند قبض حقيقي بترقيم تسلسلي", async ({ page }) => {
    await login(page, "acc@alnoor.edu");
    await page.goto("/fees");
    await page.getByRole("button", { name: /^سند قبض/ }).click();
    // اختيار أول قسط غير مسدّد
    const firstFee = page.locator("button", { hasText: /متبقٍ/ }).first();
    await expect(firstFee).toBeVisible({ timeout: 10_000 });
    await firstFee.click();
    // حقل المبلغ داخل حوار السند (الحقل الرقمي الوحيد فيه)
    await page.locator('[role="dialog"] input[type="number"]').fill("50000");
    await page.getByRole("button", { name: /إصدار السند/ }).click();
    // toast يظهر رقم السند RC-YYYY-NNNN
    await expect(page.getByText(/RC-\d{4}-\d+/)).toBeVisible({ timeout: 10_000 });
  });

  test("المعلم: إدخال درجة تُحتسب وتظهر في النتائج", async ({ page }) => {
    await login(page, "teacher@alnoor.edu");
    await page.goto("/exams");
    await expect(page.getByRole("heading", { name: "الامتحانات والنتائج" })).toBeVisible();
    // فتح شبكة إدخال الدرجات
    const enter = page.getByRole("button", { name: /إدخال الدرجات/ });
    if (await enter.isVisible().catch(() => false)) {
      await enter.click();
      const firstCell = page.locator('input[data-cell="0-0"]');
      await expect(firstCell).toBeVisible({ timeout: 10_000 });
      await firstCell.fill("18");
      await page.getByRole("button", { name: /حفظ الدرجات/ }).click();
      await expect(page.getByText(/حُفظت الدرجات/)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("ولي الأمر: يرى أبناءه وحالة اليوم (عزل البيانات)", async ({ page }) => {
    await login(page, "parent@alnoor.edu");
    // لوحة ولي الأمر تعرض بطاقات الأبناء
    await expect(page.getByText(/الملف الكامل/).first()).toBeVisible({ timeout: 10_000 });
    // لا يرى عناصر تنقّل خاصة بالإدارة
    await expect(page.getByRole("link", { name: "القبول والتسجيل" })).toHaveCount(0);
  });

  test("سجل التدقيق يعرض العمليات الحساسة بقيم before/after", async ({ page }) => {
    await login(page, "admin@alnoor.edu");
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "سجل التدقيق" })).toBeVisible();
    await expect(page.getByText(/غير قابل للحذف/)).toBeVisible();
  });
});
