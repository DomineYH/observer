// PROTOTYPE (#58): a 2 km profile across a forested slope for the three variants (question 6), drawn as SVG → PNG.
// Picks the north–south 2 km run with the most relief among runs that are ≥ 95 % forest, unless `x y0` are given.
// Usage: node profile.mjs <out dir> [x y0]. Throwaway.
/* global process, console */
import { readFileSync, writeFileSync } from 'node:fs';
import { DATA, readTerrain } from './lib.mjs';

const out = process.argv[2];
const V = ['v1', 'v2', 'v3'].map((id) => ({ id, t: readTerrain(`${DATA}/jinan-${id}.bin`) }));
const t2 = V[1].t;
const { n, cell } = t2;
const g = readFileSync(`${DATA}/sample-Copernicus_DSM_COG_30_N35_00_E127_00_DEM.tif.f32`); // cached by build.mjs
const glo90 = new Float32Array(g.buffer.slice(g.byteOffset, g.byteOffset + g.length));
const L = 200; // cells: 2 km
let best = process.argv[3] ? { i: +process.argv[3] / cell, j0: +process.argv[4] / cell } : null;
if (!best) {
  let score = -1;
  for (let i = 20; i < n - 20; i += 25) for (let j0 = 20; j0 + L < n - 20; j0 += 25) {
    let f = 0, lo = Infinity, hi = -Infinity;
    for (let j = j0; j <= j0 + L; j++) { const k = j * n + i; if (t2.cover[k] === 2) f++; lo = Math.min(lo, t2.ground[k]); hi = Math.max(hi, t2.ground[k]); }
    if (f / (L + 1) >= 0.95 && hi - lo > score) { score = hi - lo; best = { i, j0 }; }
  }
}
const { i, j0 } = best;
const rows = [];
for (let j = j0; j <= j0 + L; j++) {
  const k = j * n + i;
  rows.push({ y: j * cell, forest: t2.cover[k] === 2, g90: glo90[k], ...Object.fromEntries(V.flatMap(({ id, t }) => [[`${id}g`, t.ground[k]], [`${id}s`, t.surface[k]]])) });
}
const all = rows.flatMap((r) => [r.v1g, r.v2g, r.v3g, r.v1s, r.v2s, r.v3s, r.g90]);
const lo = Math.floor(Math.min(...all) / 20) * 20, hi = Math.ceil(Math.max(...all) / 20) * 20;
const W = 1200, H = 600, P = 60;
const X = (y) => P + ((y - j0 * cell) / (L * cell)) * (W - 2 * P);
const Y = (h) => H - P - ((h - lo) / (hi - lo)) * (H - 2 * P);
const line = (key, colour, dash = '', width = 2) =>
  `<polyline fill="none" stroke="${colour}" stroke-width="${width}" stroke-dasharray="${dash}" points="${rows.map((r) => `${X(r.y).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(' ')}"/>`;
const grid = [];
for (let h = lo; h <= hi; h += 20) grid.push(`<line x1="${P}" x2="${W - P}" y1="${Y(h)}" y2="${Y(h)}" stroke="#ccc"/><text x="${P - 6}" y="${Y(h) + 4}" text-anchor="end" font-size="12">${h}</text>`);
const forest = rows.filter((r) => r.forest).map((r) => `<rect x="${X(r.y) - 3}" y="${H - P + 6}" width="6" height="8" fill="#3a6b35"/>`);
const legend = [['v1g', '#c0392b', 'V1 GEDTM30 지면'], ['v2g', '#2471a3', 'V2 GLO-30 지면'], ['v3g', '#7d3c98', 'V3 GLO-30−숲·건물 지면'], ['g90', '#555', 'GLO-90 (DSM) 참고'], ['v2s', '#2471a3', '표면 (지면+데모 숲 12–17 m), 점선']]
  .map(([, c, s], k) => `<rect x="${P + 10}" y="${20 + k * 18}" width="14" height="4" fill="${c}"/><text x="${P + 30}" y="${26 + k * 18}" font-size="13">${s}</text>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>${grid.join('')}
${line('g90', '#555', '2 3', 1.5)}${line('v1s', '#c0392b', '5 4', 1)}${line('v2s', '#2471a3', '5 4', 1)}${line('v3s', '#7d3c98', '5 4', 1)}
${line('v1g', '#c0392b')}${line('v2g', '#2471a3')}${line('v3g', '#7d3c98')}${forest.join('')}${legend.join('')}
<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-size="13">국지 x = ${i * cell} m, y ${j0 * cell}–${(j0 + L) * cell} m (남→북). 아래 녹색 = 숲 칸 (WorldCover 10)</text></svg>`;
writeFileSync(`${DATA}/profile.svg`, svg); // the SVG carries elevations: keep it out of the repo
const diff = (a, b) => (rows.reduce((s, r) => s + (r[a] - r[b]), 0) / rows.length).toFixed(1);
console.log(`profile x=${i * cell} y=${j0 * cell}..${(j0 + L) * cell}, forest ${rows.filter((r) => r.forest).length}/${rows.length}`);
console.log(`mean ground: v1−v2 ${diff('v1g', 'v2g')} m, v3−v2 ${diff('v3g', 'v2g')} m, v1−v3 ${diff('v1g', 'v3g')} m, v2−glo90 ${diff('v2g', 'g90')} m`);
const { chromium } = await import('@playwright/test');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.setContent(svg);
await p.screenshot({ path: `${out}/profile.png` });
await b.close();
console.log('wrote', `${out}/profile.png`);
