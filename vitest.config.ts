import { defineConfig } from 'vitest/config';
import { alias } from './aliases';

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/{acceptance,golden,lint}/**/*.test.ts'],
  },
});
