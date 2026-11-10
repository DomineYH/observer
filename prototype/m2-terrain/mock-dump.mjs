// PROTOTYPE (#58): writes the mock terrain (seed 1) as $DATA/mock-1.bin in build.mjs's format, for side-by-side metrics.
// Usage (from the repo root, so Vite finds its config): node prototype/m2-terrain/mock-dump.mjs. Throwaway.
/* global console, Buffer */
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { DATA } from './lib.mjs';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { generateTerrain } = await vite.ssrLoadModule('/src/adapters/mock/terrain/index.ts');
const t = generateTerrain(1);
await vite.close();
const header = Buffer.from(JSON.stringify({ n: t.n, cell: t.cell, grid: t.grid, roads: t.roads, villages: t.villages, label: 'mock seed 1' }));
const len = Buffer.alloc(4);
len.writeUInt32LE(header.length);
const pad = Buffer.alloc((4 - ((4 + header.length) % 4)) % 4, 32);
writeFileSync(`${DATA}/mock-1.bin`, Buffer.concat([len, header, pad, ...[t.ground, t.surface, t.buildings].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)), Buffer.from(t.cover.buffer, t.cover.byteOffset, t.cover.byteLength)]));
console.log('wrote', `${DATA}/mock-1.bin`);
