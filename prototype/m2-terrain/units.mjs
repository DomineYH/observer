// PROTOTYPE (#58): where the base scenario's points land on a terrain file (cover and ground). Throwaway.
// Usage: node units.mjs [file=jinan]  ($DATA/<file>.bin)
/* global process, console */
import { DATA, readTerrain } from './lib.mjs';

const t = readTerrain(`${DATA}/${process.argv[2] ?? 'jinan'}.bin`);
const COVER = ['open', 'field', 'forest', 'water', 'road', 'village', 'building'];
const k = (p) => Math.round(p.y / t.cell) * t.n + Math.round(p.x / t.cell);
const at = (name, p) => console.log(`${name.padEnd(14)} ${String(p.x).padStart(5)},${String(p.y).padStart(5)}  ${COVER[t.cover[k(p)]].padEnd(8)} ground ${t.ground[k(p)].toFixed(0)} m`);
// BASE_SCENARIO (src/content/scenario.ts), copied: points only
at('planned post', { x: 5120, y: 1800 });
[{ x: 4350, y: 3380 }, { x: 5150, y: 3460 }, { x: 5950, y: 3380 }].forEach((p, i) => at(`friend ${i + 1}`, p));
[{ x: 3450, y: 6300 }, { x: 5050, y: 6150 }, { x: 5800, y: 7550 }].forEach((p, i) => at(`NAI ${i + 1}`, p));
Object.entries({ A: [[3300, 6900], [3550, 5300]], B: [[5050, 6600], [5000, 5000]], C: [[6800, 6700], [6450, 5100]] })
  .forEach(([r, ps]) => ps.forEach(([x, y], i) => at(`route ${r}${i}`, { x, y })));
at('fixed point', { x: 5000, y: 5500 });
// forest along each route (the last leg ends at a friend): share of 10 m steps in forest
Object.entries({ A: [[3300, 6900], [3550, 5300], [4350, 3380]], B: [[5050, 6600], [5000, 5000], [5150, 3460]], C: [[6800, 6700], [6450, 5100], [5950, 3380]] }).forEach(([r, ps]) => {
  let f = 0, all = 0;
  for (let s = 1; s < ps.length; s++) {
    const [a, b] = [ps[s - 1], ps[s]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d <= L; d += 10, all++) if (t.cover[k({ x: a[0] + ((b[0] - a[0]) * d) / L, y: a[1] + ((b[1] - a[1]) * d) / L })] === 2) f++;
  }
  console.log(`route ${r}: ${((100 * f) / all).toFixed(0)}% of its line in forest`);
});
