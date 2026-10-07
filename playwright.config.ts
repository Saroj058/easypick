import { defineConfig, devices } from "@playwright/test";

// Browser tests against a dev server with its own throwaway database (.data/postgres-e2e,
// port 5435), so they never touch your dev data or the live database.
const PORT = 3100;

/** Specs that draw 3D or a map (the tour now; the Visit hero and map later). */
const WEBGL_SPECS = /(tour|visit-3d)\.spec\.ts/;
/** Software WebGL (SwiftShader), so 3D renders the same on every machine and in CI. About 3.5× slower, so only for WEBGL_SPECS. */
const SOFTWARE_GL = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // The dev server compiles each page on first visit.
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: WEBGL_SPECS },
    // After desktop: some phone checks use accounts the desktop tests create.
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/, testIgnore: WEBGL_SPECS, dependencies: ["desktop"] },
    // The 3D and map tests, last, on their own and one at a time: software WebGL makes them heavy
    // enough to slow any test running beside them past its timeouts.
    { name: "desktop-3d", use: { ...devices["Desktop Chrome"], launchOptions: SOFTWARE_GL }, testMatch: WEBGL_SPECS, workers: 1, dependencies: ["phone"] },
    { name: "phone-3d", use: { ...devices["Pixel 7"], launchOptions: SOFTWARE_GL }, grep: /@phone/, testMatch: WEBGL_SPECS, workers: 1, dependencies: ["desktop-3d"] },
  ],
  webServer: {
    // A fresh test database every run, so orders from earlier runs never use up the stock.
    command: `node -e "require('fs').rmSync('.data/postgres-e2e',{recursive:true,force:true})" && node scripts/with-db.mjs --local next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      LOCAL_PG_DIR: ".data/postgres-e2e",
      NEXT_DIST_DIR: ".next-e2e",
      LOCAL_PG_PORT: "5435",
      ADMIN_USERNAME: "e2e-owner",
      ADMIN_PASSWORD: "e2e-owner-password",
      SESSION_SECRET: "e2e-session-secret-e2e-session-secret",
      PAYMENTS_MODE: "test",
    },
  },
});
