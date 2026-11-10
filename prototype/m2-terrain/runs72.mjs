// PROTOTYPE (#72): the capture.mjs run list for round 3. Throwaway. Usage: node runs72.mjs <out runs.json> [fallback]
// Mock (planned post) and 문경 (계획 관측소, 예비 1, 예비 2): fps twice per quality 높음/보통 at the planned posts; then
// 작전 개시 and a look at the 정찰조 where it stops (elevation to the route's 2nd point, nearest-cell heights).
/* global process */
import { readFileSync, writeFileSync } from 'node:fs';
import { DATA, readTerrain } from './lib.mjs';

const fb = process.argv[3] === 'fallback';
const elTo = (t, from, to) => {
  const h = (p) => t.ground[Math.round(p.y / t.cell) * t.n + Math.round(p.x / t.cell)];
  return Math.round((Math.atan((h(to) - h(from) - 3.5) / Math.hypot(to.x - from.x, to.y - from.y)) * 32000) / Math.PI); // 0.1 mil
};
const els = (file, sc) => { const t = readTerrain(`${DATA}/${file}.bin`); return Object.fromEntries(['A', 'B'].map((k) => [k, elTo(t, sc.plannedOp, sc.routes[k][1])])); };
const mock = { plannedOp: { x: 5120, y: 1800 }, routes: { A: [0, { x: 3550, y: 5300 }], B: [0, { x: 5050, y: 5000 }] } }; // BASE_SCENARIO
const sc = JSON.parse(readFileSync(`${DATA}/base-mungyeong.json`, 'utf8'));
const file = fb ? 'mungyeong72-fb' : 'mungyeong72';
const p = (q) => [q.x, q.y];
const runs = [
  { id: 'o3-mock', terrain: null, posts: { op: p(mock.plannedOp) }, fps: 2, qualities: ['높음', '보통'], recon: { el: els('mock-1', mock) } },
  { id: fb ? 'mg72fb' : 'mg72', terrain: `${file}.bin`, scenario: 'base-mungyeong.json', posts: { op: p(sc.plannedOp), res1: p(sc.reserveOps[0]), res2: p(sc.reserveOps[1]) },
    fps: 2, fpsPosts: ['op'], qualities: ['높음', '보통'], recon: { el: els(file, sc) } },
];
writeFileSync(process.argv[2], JSON.stringify(runs, null, 1));
