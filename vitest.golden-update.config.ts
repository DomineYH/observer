import { defineConfig } from 'vitest/config';
import { alias } from './aliases';

// Maintenance command (npm run golden:update), not a check. Not merged with the base config: mergeConfig concatenates `include`.
export default defineConfig({
  resolve: { alias },
  test: { environment: 'node', include: ['tests/golden/update.golden.ts'] },
});
