import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build (`npm run build` first). Each run uses a fresh
 * temporary database seeded with the fictional demo data. Uses the locally installed Chrome.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
process.env.E2E_DB ??= path.join(os.tmpdir(), `secure-forms-portal-e2e-${Date.now()}.sqlite`);
export const DEMO_PASSWORD = "e2e-demo-password";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORTAL_DB_PATH: process.env.E2E_DB,
      PORTAL_SEED_DEMO: "true",
      PORTAL_DEMO_PASSWORD: DEMO_PASSWORD,
      PORTAL_TIMEZONE: "Europe/London",
    },
  },
});
