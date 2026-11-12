import { defineConfig } from 'vitest/config';
import { alias } from './aliases';

// Maintenance command (npm run terrain:fetch), not a check: it reads the network. Not merged with the base config:
// mergeConfig concatenates `include`.
export default defineConfig({
  resolve: { alias },
  test: { environment: 'node', include: ['terrain/pipeline/fetch/run.ts'], testTimeout: 1_200_000 },
});
