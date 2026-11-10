// PROTOTYPE (#58): finds observation posts on the southern part of the square: forest-free within 30 m, high, and seeing
// most of the ground to the north. Usage: node posts.mjs [file=jinan-v2] [clearing m]  (mock-1 for the mock). With a clearing, posts may stand in forest
// and the canopy within that radius of the post is cut (a fire-watch or helipad clearing).
// Fixed posts instead of the search: node posts.mjs <file> <clearing or 0> x,y [x,y ...]. Prints the best few. Throwaway.
/* global process, console */
import { DATA, readTerrain } from './lib.mjs';

const t = readTerrain(`${DATA}/${process.argv[2] ?? 'jinan-v2'}.bin`);
const { n, cell } = t;
const FOREST = 2;
const CLEAR = +(process.argv[3] ?? 0);
const at = (a, x, y) => a[Math.round(y / cell) * n + Math.round(x / cell)];
const clear = (x, y) => {
  if (CLEAR) return true; for (let dy = -30; dy <= 30; dy += 10) for (let dx = -30; dx <= 30; dx += 10) if (at(t.cover, x + dx, y + dy) === FOREST) return false; return true; };
const cands = [];
for (let y = 300; y <= 3500; y += 50) for (let x = 300; x <= 9900; x += 50) if (clear(x, y)) cands.push({ x, y, h: at(t.ground, x, y) });
cands.sort((a, b) => b.h - a.h);
// Over a 200 m target grid north of the post (to 9.9 km), sight line on the surface every 15 m: the share of targets
// whose top (surface) is in sight, and of the forest-free targets, the share whose ground + 1.7 m (a standing man) is.
const seen = (p) => {
  const z = p.h + 3.5;
  const surf = (x, y) => (CLEAR && Math.hypot(x - p.x, y - p.y) < CLEAR ? at(t.ground, x, y) : at(t.surface, x, y));
  let top = 0, all = 0, man = 0, open = 0;
  const los = (tx, ty, tz) => {
    const dx = tx - p.x, dy = ty - p.y, steps = Math.floor(Math.hypot(dx, dy) / 15);
    for (let s = 1; s < steps; s++) { const f = s / steps; if (surf(p.x + dx * f, p.y + dy * f) > z + (tz - z) * f) return false; }
    return true;
  };
  for (let ty = p.y + 600; ty <= 9900; ty += 200) for (let tx = 300; tx <= 9900; tx += 200) {
    all++;
    if (los(tx, ty, at(t.surface, tx, ty) + 0.5)) top++;
    if (at(t.cover, tx, ty) !== FOREST) { open++; if (los(tx, ty, at(t.ground, tx, ty) + 1.7)) man++; }
  }
  return { top: top / all, man: man / open, open };
};
// Fixed posts instead of a search: node posts.mjs <file> 0 x,y x,y ...
if (process.argv[4]) {
  for (const a of process.argv.slice(4)) {
    const [x, y] = a.split(',').map(Number), p = { x, y, h: at(t.ground, x, y) }, v = seen(p);
    console.log(`x ${x} y ${y} ground ${p.h.toFixed(0)} m, cover ${t.cover[Math.round(y / cell) * n + Math.round(x / cell)]}: surface in sight ${(100 * v.top).toFixed(1)}%, a man on open ground ${(100 * v.man).toFixed(1)}% of ${v.open}`);
  }
  process.exit(0);
}
const picked = [];
for (const c of cands.slice(0, 400)) {
  if (picked.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 1200)) continue;
  c.seen = seen(c);
  picked.push(c);
  if (picked.length >= 12) break;
}
picked.sort((a, b) => b.seen.top - a.seen.top);
console.log(`${cands.length} ${CLEAR ? `(clearing ${CLEAR} m)` : 'forest-free'} candidates in y 300–3500`);
for (const p of picked) console.log(`x ${p.x} y ${p.y} ground ${p.h.toFixed(0)} m: surface in sight ${(100 * p.seen.top).toFixed(1)}%, a man on open ground ${(100 * p.seen.man).toFixed(1)}% of ${p.seen.open}`);
console.log(`planned post 5120,1800: cover ${t.cover[180 * n + 512]}, ground ${at(t.ground, 5120, 1800).toFixed(0)}, surface ${at(t.surface, 5120, 1800).toFixed(0)}`);
