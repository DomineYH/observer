import { defineConfig } from 'vitest/config';
import { alias } from './aliases';

// Maintenance command (npm run terrain:build): 가공 from the committed 원자료 스냅샷, no network. Writes the 지형 파일
// set. Not merged with the base config: mergeConfig concatenates `include`.
export default defineConfig({
  resolve: { alias },
  test: { environment: 'node', include: ['terrain/pipeline/build/run.ts'], testTimeout: 120_000 },
});
