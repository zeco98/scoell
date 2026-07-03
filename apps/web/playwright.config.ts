import { defineConfig, devices } from "@playwright/test";

// E2E للدورة الكاملة — يفترض أن الـ API يعمل على 3001 (يُشغَّل يدويًا قبل الاختبار)
// والويب يُشغَّل تلقائيًا عبر webServer أدناه.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    locale: "ar",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
