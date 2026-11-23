import { defineConfig } from 'vitest/config';
import { alias } from './aliases';

// Maintenance command (npm run voice:check), not a check: it needs the 음성 모델 (npm run voice:fetch) and a browser.
// Not merged with the base config: mergeConfig concatenates `include`.
export default defineConfig({
  resolve: { alias },
  test: { environment: 'node', include: ['tests/voice/check.voice.ts'], testTimeout: 600_000 },
});
