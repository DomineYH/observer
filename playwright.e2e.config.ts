import { defineConfig, devices } from '@playwright/test';

// Every smoke runs on the mock build; real.spec.ts alone runs on the real build, served from its own folder and port.
export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true, // --shard then splits by test, not by file
  // One worker per shard on CI: the smoke tests are real-time and lose their margin when tests share a CPU (smoke.spec.ts:409).
  workers: process.env.CI ? 1 : undefined,
  retries: 1,
  reporter: process.env.CI ? 'list' : undefined, // per-test durations in the CI log, for shard balancing
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
