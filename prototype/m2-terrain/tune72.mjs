// PROTOTYPE (#72): finds rule-keeping replacements for draft points (sim lineOfSight). Throwaway.
// Usage (repo root): node prototype/m2-terrain/tune72.mjs <route> <point index> [radius=200]   on $DATA/mungyeong72.bin
// Prints where the route's 5 m samples hit water/houses, then candidate points within the radius (20 m grid) that keep
// the rules (cell not forest/house/water, both adjacent legs sample-clean and closer to the goal; a 2nd point must also be
// seen from the planned post and ≤ 5.67 km), best route visibility first.
/* global process, console */
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { DATA, readTerrain } from './lib.mjs';

const [k, idx, rad = 200] = process.argv.slice(2);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { heightAt, lineOfSight, EYE_HEIGHT } = await vite.ssrLoadModule('/src/sim/index.ts');
await vite.close();
const t = readTerrain(`${DATA}/mungyeong72.bin`);
const d = JSON.parse(readFileSync(process.env.DRAFT ?? `${DATA}/../m2-t64-draft.json`, 'utf8'));
const coverAt = (x, y) => t.cover[Math.round(y / 10) * t.n + Math.round(x / 10)];
const op = { x: d.posts[0][0], y: d.posts[0][1] }, eye = { ...op, z: heightAt(t, op.x, op.y) + EYE_HEIGHT };
const seen = (x, y) => lineOfSight(t, eye, { x, y, z: heightAt(t, x, y) + 1.7 * 0.85 });
const bad = (c) => c === 2 || c === 3 || c === 5 || c === 6;
const r = d.routes[k].map(([x, y]) => ({ x, y })), goal = r.at(-1), i = +idx;
const legHits = (a, b) => { const out = []; const L = Math.hypot(b.x - a.x, b.y - a.y); for (let m = 0; m <= L; m += 5) { const x = a.x + ((b.x - a.x) * m) / L, y = a.y + ((b.y - a.y) * m) / L, c = coverAt(x, y); if (c === 3 || c === 5 || c === 6) out.push([Math.round(x), Math.round(y), c]); } return out; };
r.slice(1).forEach((p, q) => { const h = legHits(r[q], p); if (h.length) console.log(`leg ${q}→${q + 1}: hits`, JSON.stringify(h)); });
const legSeen = (a, b) => { let n = 0, s = 0; const L = Math.hypot(b.x - a.x, b.y - a.y); for (let m = 0; m < L; m += 25) { n++; if (seen(a.x + ((b.x - a.x) * m) / L, a.y + ((b.y - a.y) * m) / L)) s++; } return [s, n]; };
const dist = (p) => Math.hypot(p.x - goal.x, p.y - goal.y);
const cands = [];
let seed = 1; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (let dy = -rad; dy <= rad; dy += 20) for (let dx = -rad; dx <= rad; dx += 20) {
  const p = { x: r[i].x + dx, y: r[i].y + dy };
  if (bad(coverAt(p.x, p.y))) continue;
  if (i === 1 && (!seen(p.x, p.y) || Math.hypot(p.x - op.x, p.y - op.y) > 5670)) continue;
  const prev = r[i - 1], next = r[i + 1];
  if (prev && (dist(p) >= dist(prev) || legHits(prev, p).length)) continue;
  if (next && (dist(next) >= dist(p) || legHits(p, next).length)) continue;
  const [s1, n1] = prev ? legSeen(prev, p) : [0, 0], [s2, n2] = next ? legSeen(p, next) : [0, 0];
  // a 2nd point is where the 정찰조 stops after deploy's 30 m jitter: share of 200 jittered stops seen
  let js = 0; for (let q = 0; q < 200; q++) { const g = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()); if (seen(p.x + 30 * g(), p.y + 30 * g())) js++; }
  cands.push({ x: p.x, y: p.y, move: Math.round(Math.hypot(dx, dy)), seen: Math.round((100 * (s1 + s2)) / Math.max(1, n1 + n2)), jitterSeen: Math.round(js / 2) });
}
cands.sort(i === 1 ? (a, b) => b.jitterSeen - a.jitterSeen || a.move - b.move : (a, b) => b.seen - a.seen || a.move - b.move);
console.log(`${k}[${i}] (${r[i].x}, ${r[i].y}): ${cands.length} candidates; best`, JSON.stringify(cands.slice(0, 8)));
console.log('nearest', JSON.stringify([...cands].sort((a, b) => a.move - b.move).slice(0, 5)));
