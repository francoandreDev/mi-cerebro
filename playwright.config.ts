import { defineConfig, devices } from '@playwright/test';

// why: functional smoke only (docs/proyecto/roadmap-22-25.md ítem 24,
//      decisión 2026-08-03) — no screenshot-diff visual regression, this
//      project's sections redesign too often for baseline upkeep to pay
//      off. `ng serve` is slow to boot; a generous webServer timeout beats
//      a flaky first run in CI.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
