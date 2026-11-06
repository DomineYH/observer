import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { alias } from '../../aliases';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias },
  server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
});
