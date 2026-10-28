import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a production build on its own port, database
// and build folder (scripts/e2e-server.mjs), so they can run while `next dev`
// is up. Set E2E_BASE_URL to test an already-running server instead.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

// The owner account the e2e server seeds (scripts/e2e-server.mjs reads the same variables). Specs read
// process.env.E2E_OWNER_EMAIL and process.env.E2E_OWNER_PASSWORD; both are set before any worker starts.
process.env.E2E_OWNER_EMAIL ??= 'owner@e2e.test';
process.env.E2E_OWNER_PASSWORD ??= 'e2e-owner-password-1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node scripts/e2e-server.mjs',
        url: `${baseURL}/api/health/`,
        reuseExistingServer: true,
        timeout: 900_000,
        stdout: 'pipe',
      },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /.*\.mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /.*\.mobile\.spec\.ts/ },
  ],
});
