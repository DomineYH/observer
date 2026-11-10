// PROTOTYPE (#58): writes the capture.mjs run list for o2 from the posts posts.mjs chose. Throwaway.
// Usage: node runs.mjs <out runs.json>. Mock first (fps twice), then each square at R = 60 (best post: fps twice, edge
// view) and R = 30 (best post).
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { DATA } from './lib.mjs';

const best = (site, R) => JSON.parse(readFileSync(`${DATA}/posts-${site}-r${R}.json`, 'utf8')).best[0];
const runs = [{ id: 'o2-mock', terrain: null, posts: { P0: [5120, 1800] }, fps: 2 }];
for (const site of ['jinan', 'mungyeong'])
  for (const R of [60, 30]) {
    const p = best(site, R);
    runs.push({ id: `${site}-r${R}`, terrain: `${site}-r${R}.bin`, posts: { best: [p.x, p.y] }, fps: R === 60 ? 2 : 0, edge: R === 60 });
  }
writeFileSync(process.argv[2], JSON.stringify(runs, null, 1));
