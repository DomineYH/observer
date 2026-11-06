import { fileURLToPath } from 'node:url';

// One alias per module; cross-module imports must use these (lint enforces it).
export const alias = [
  {
    find: /^@(sim|content|adapters|render|ui|app)(?=\/|$)/,
    replacement: fileURLToPath(new URL('./src/$1', import.meta.url)),
  },
];
