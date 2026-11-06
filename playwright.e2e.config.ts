import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/smoke',
  retries: 1,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
