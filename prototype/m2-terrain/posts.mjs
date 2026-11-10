// PROTOTYPE (#58): observation posts as a player would pick them, scored with the post clearing rule. Throwaway.
// Usage: node posts.mjs <file> <R> [x,y ...]     file: jinan | mungyeong | mock-1 ($DATA/<file>.bin), R: clearing m (0 = none)
//   search (no x,y): candidates are local high points (the highest ground within 100 m) in the southern third
//     (y 200–3410 m, x 200–10030 m); each is scored as if cleared with radius R; the best three at least 1 km apart are
//     kept. Writes $DATA/posts-<file>-r<R>.json.
//   fixed posts (x,y given): scores those posts only.
// Score (o1 metric): a 200 m target grid from 600 m north of the post to y 9.9 km, x 0.3–9.9 km, sight line every 15 m on
// the surface from ground + 3.5 m: the share of targets whose surface is in sight, and of the forest-free targets, the
// share where a standing man (ground + 1.7 m) is. Inside the clearing the sight line sees ground, not forest.
/* global process, console */
import { writeFileSync } from 'node:fs';
import { DATA, readTerrain } from './lib.mjs';

const [file, r, ...fixed] = process.argv.slice(2);
const R = +(r ?? 0);
const t = readTerrain(`${DATA}/${file}.bin`);
const { n, cell } = t;
const FOREST = 2;
const at = (a, x, y) => a[Math.round(y / cell) * n + Math.round(x / cell)];

function seen(p) {
  const z = p.h + 3.5;
  const surf = (x, y) => (R && (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) <= R * R ? at(t.ground, x, y) : at(t.surface, x, y));
  const los = (tx, ty, tz) => {
    const dx = tx - p.x, dy = ty - p.y, steps = Math.floor(Math.hypot(dx, dy) / 15);
    for (let s = 1; s < steps; s++) { const f = s / steps; if (surf(p.x + dx * f, p.y + dy * f) > z + (tz - z) * f) return false; }
    return true;
  };
  let top = 0, all = 0, man = 0, open = 0;
  for (let ty = p.y + 600; ty <= 9900; ty += 200) for (let tx = 300; tx <= 9900; tx += 200) {
    all++;
    if (los(tx, ty, at(t.surface, tx, ty) + 0.5)) top++;
    if (at(t.cover, tx, ty) !== FOREST) { open++; if (los(tx, ty, at(t.ground, tx, ty) + 1.7)) man++; }
  }
  return { top: +((100 * top) / all).toFixed(1), man: +((100 * man) / open).toFixed(1) };
}
const line = (p) => `x ${p.x} y ${p.y} ground ${p.h.toFixed(0)} m${p.forest ? ' (forest)' : ''}: surface ${p.top}%, man ${p.man}%`;
const post = (x, y) => ({ x, y, h: at(t.ground, x, y), forest: at(t.cover, x, y) === FOREST });

if (fixed.length) {
  for (const a of fixed) { const p = post(...a.split(',').map(Number)); console.log(line({ ...p, ...seen(p) })); }
  process.exit(0);
}

// local high points: the highest node within 100 m (10 nodes) on the 10 m grid
const W = 10, cands = [];
for (let j = 20; j <= 341; j++) for (let i = 20; i <= n - 21; i++) {
  const h = t.ground[j * n + i];
  let top = true;
  for (let dj = -W; dj <= W && top; dj++) for (let di = -W; di <= W; di++) {
    if (di * di + dj * dj > W * W || (!di && !dj)) continue;
    const k = (j + dj) * n + i + di;
    if (k >= 0 && t.ground[k] >= h) { top = false; break; }
  }
  if (top) cands.push(post(i * cell, j * cell));
}
for (const c of cands) Object.assign(c, seen(c));
cands.sort((a, b) => b.top - a.top || b.man - a.man);
const apart = (list) => list.reduce((kept, c) => (kept.every((k) => Math.hypot(k.x - c.x, k.y - c.y) >= 1000) ? [...kept, c] : kept), []);
const best = apart(cands).slice(0, 3);
const over30 = cands.filter((c) => c.top >= 30);
const result = {
  file, R, candidates: cands.length, over30: over30.length, over30Apart: apart(over30).length,
  // no post reached 30 % on the real squares, so lower bars too: [bar, candidates, of them ≥ 1 km apart]
  bars: [15, 20].map((b) => [b, cands.filter((c) => c.top >= b).length, apart(cands.filter((c) => c.top >= b)).length]),
  best, median: cands[cands.length >> 1] ? { top: cands[cands.length >> 1].top, man: cands[cands.length >> 1].man } : null,
};
writeFileSync(`${DATA}/posts-${file}-r${R}.json`, JSON.stringify(result, null, 1));
console.log(`${file} R=${R}: ${cands.length} local high points in the southern third; ${over30.length} reach ≥30% surface (${result.over30Apart} of them ≥1 km apart); median ${JSON.stringify(result.median)}; [bar, n, apart] ${JSON.stringify(result.bars)}`);
best.forEach((p, k) => console.log(`  best ${k + 1}: ${line(p)}`));
