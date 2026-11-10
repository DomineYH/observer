// PROTOTYPE (#58): the observation-post clearing rule, applied as data. Throwaway.
// Usage: node clear.mjs <site> <R>   reads $DATA/<site>.bin and the posts posts.mjs chose ($DATA/posts-<site>-r<R>.json),
// writes $DATA/<site>-r<R>.bin. Rule: every cell within R m of a post becomes `open` with no forest and no building, so
// surface = ground there. Nothing else changes.
/* global process, console */
import { readFileSync } from 'node:fs';
import { DATA, readTerrain, writeTerrain } from './lib.mjs';

const [site, r] = process.argv.slice(2);
const R = +r;
const t = readTerrain(`${DATA}/${site}.bin`);
const { best } = JSON.parse(readFileSync(`${DATA}/posts-${site}-r${R}.json`, 'utf8'));
const OPEN = 0;
let cleared = 0;
for (const p of best)
  for (let j = Math.max(0, Math.floor((p.y - R) / t.cell)); j <= Math.min(t.n - 1, Math.ceil((p.y + R) / t.cell)); j++)
    for (let i = Math.max(0, Math.floor((p.x - R) / t.cell)); i <= Math.min(t.n - 1, Math.ceil((p.x + R) / t.cell)); i++) {
      if ((i * t.cell - p.x) ** 2 + (j * t.cell - p.y) ** 2 > R * R) continue;
      const k = j * t.n + i;
      t.cover[k] = OPEN;
      t.buildings[k] = 0;
      t.surface[k] = t.ground[k];
      cleared++;
    }
console.log(`${site} R=${R}: cleared ${cleared} cells around ${best.map((p) => `(${p.x}, ${p.y})`).join(' ')}`);
writeTerrain(`${DATA}/${site}-r${R}.bin`, t, `${t.label} + ${R} m post clearings`);
