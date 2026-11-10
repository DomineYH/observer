// PROTOTYPE (#58): numbers for comparing the squares. Throwaway.
// Usage: node compare.mjs <site> <R> x,y   (file $DATA/<site>-r<R>.bin, post x,y in local m)
//   corridors: OSM road cells north of y 4 km (every 10th road cell), share where a man (ground + 1.7 m) is in sight
//   relief: ground percentiles over the square and over the northern half
//   edge: how the mirrored ground beyond the south edge (what the renderer draws) differs from the real GEDTM30 there
/* global process, console */
import { bilinear, DATA, GEDTM, originOf, readBox, readTerrain, toLonLat } from './lib.mjs';

const [site, R, xy] = process.argv.slice(2);
const t = readTerrain(`${DATA}/${site}-r${R}.bin`);
const { n, cell } = t;
const [px, py] = xy.split(',').map(Number);
const at = (a, x, y) => a[Math.round(y / cell) * n + Math.round(x / cell)];
const z = at(t.ground, px, py) + 3.5;
const sees = (tx, ty, tz) => {
  const dx = tx - px, dy = ty - py, steps = Math.floor(Math.hypot(dx, dy) / 15);
  for (let s = 1; s < steps; s++) { const f = s / steps; if (at(t.surface, px + dx * f, py + dy * f) > z + (tz - z) * f) return false; }
  return true;
};
let roads = 0, seenRoads = 0, m = 0;
for (let k = 0; k < n * n; k++) {
  if (t.cover[k] !== 4 || Math.floor(k / n) * cell < 4000 || m++ % 10) continue;
  const x = (k % n) * cell, y = Math.floor(k / n) * cell;
  roads++;
  if (sees(x, y, t.ground[k] + 1.7)) seenRoads++;
}
const pct = (a, p) => a[Math.floor(p * (a.length - 1))].toFixed(0);
const all = Float32Array.from(t.ground).sort();
const north = Float32Array.from(t.ground.subarray(n * 512)).sort();
console.log(`${site} R=${R} post ${px},${py}: road cells north of 4 km in sight ${((100 * seenRoads) / roads).toFixed(1)}% of ${roads}`);
console.log(`  ground p10/p50/p90: all ${pct(all, 0.1)}/${pct(all, 0.5)}/${pct(all, 0.9)} m, northern half ${pct(north, 0.1)}/${pct(north, 0.5)}/${pct(north, 0.9)} m`);

// edge: the real ground 0–2 km south of the square against the mirror the renderer draws there
const [X0, Y0] = originOf(site);
const ll = [toLonLat(X0, Y0 - 2000), toLonLat(X0 + 10230, Y0)];
const r = await readBox(GEDTM, [ll[0][0] - 0.01, ll[0][1] - 0.01, ll[1][0] + 0.01, ll[1][1] + 0.01]);
let d2 = 0, c = 0, d = 0;
for (let y = 10; y <= 2000; y += 50) for (let x = 0; x <= 10230; x += 50) {
  const real = bilinear(r, ...toLonLat(X0 + x, Y0 - y));
  const mirror = at(t.ground, x, y);
  d2 += (real - mirror) ** 2; d += Math.abs(real - mirror); c++;
}
console.log(`  south edge, 0–2 km beyond: mirror vs real GEDTM30 RMS ${Math.sqrt(d2 / c).toFixed(0)} m, mean |Δ| ${(d / c).toFixed(0)} m`);
