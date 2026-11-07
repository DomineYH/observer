import { defineConfig, devices } from '@playwright/test';

// Determinism failures are never retried.
export default defineConfig({
  testDir: 'tests/engines',
  retries: 0,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:4174' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npx vite --config tests/engines/vite.config.ts --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
  },
});
