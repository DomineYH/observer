// PROTOTYPE (#58): a 24 km GLO-30 hillshade around a candidate centre, to place the 10.24 km square. Throwaway.
// Usage: node overview.mjs [site=jinan]. Writes $DATA/overview-<site>.png (1 px = 30 m, north up, 1 km ticks).
/* global process, console */
import { bilinear, DATA, readBox, SITES, toLonLat, toUtm, writePng } from './lib.mjs';

const site = process.argv[2] ?? 'jinan';
const [cx, cy] = toUtm(...SITES[site].centre);
const S = 800, D = 30, half = (S * D) / 2;
const ll = [toLonLat(cx - half, cy - half), toLonLat(cx + half, cy + half), toLonLat(cx - half, cy + half), toLonLat(cx + half, cy - half)];
const box = [Math.min(...ll.map((p) => p[0])), Math.min(...ll.map((p) => p[1])), Math.max(...ll.map((p) => p[0])), Math.max(...ll.map((p) => p[1]))];
const r = await readBox(SITES[site].glo30, box);
const h = new Float32Array(S * S);
for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
  const [lon, lat] = toLonLat(cx - half + i * D, cy + half - j * D);
  h[j * S + i] = bilinear(r, lon, lat);
}
let lo = Infinity, hi = -Infinity;
for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
const rgb = new Uint8Array(S * S * 3);
for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) {
  const k = j * S + i;
  const dx = (h[k + 1] - h[k - 1]) / (2 * D), dy = (h[k - S] - h[k + S]) / (2 * D);
  const shade = Math.max(0.35, Math.min(1, 0.8 + (-dx + dy) * 0.5)); // light from NW
  const t = Math.max(0, Math.min(1, (h[k] - 250) / 500));
  const x = cx - half + i * D, y = cy + half - j * D;
  const tick = Math.abs(x % 1000) < D || Math.abs(y % 1000) < D;
  const edge = (Math.abs(Math.abs(x - cx) - 5115) < D && Math.abs(y - cy) < 5115) || (Math.abs(Math.abs(y - cy) - 5115) < D && Math.abs(x - cx) < 5115);
  const c = edge ? [255, 40, 40] : [(40 + 215 * t) * shade, (120 + 60 * t) * shade, (60 - 30 * t) * shade].map((v) => (tick ? v * 0.75 : v));
  rgb.set(c, k * 3);
}
console.log({ cx, cy, lo, hi });
writePng(`${DATA}/overview-${site}.png`, S, S, rgb);
