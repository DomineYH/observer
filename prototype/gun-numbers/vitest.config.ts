// PROTOTYPE #118: runs only the prototype's measurement file, with the repo's path aliases.
import { defineConfig } from 'vitest/config';
import { alias } from '../../aliases';

export default defineConfig({
  resolve: { alias },
  test: { environment: 'node', include: ['prototype/gun-numbers/*.proto.ts'], testTimeout: 0 },
});
