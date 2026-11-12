import { defineConfig, devices } from '@playwright/test';

// Every smoke runs on the mock build; real.spec.ts alone runs on the real build, served from its own folder and port.
export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true, // --shard then splits by test, not by file
  retries: 1,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: 'real.spec.ts' },
    { name: 'real', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4175' }, testMatch: 'real.spec.ts' },
  ],
  webServer: [
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite build --outDir dist-real && npx vite preview --outDir dist-real --port 4175 --strictPort',
      env: { VITE_OBSERVER_BACKEND: 'real' },
      url: 'http://localhost:4175',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
