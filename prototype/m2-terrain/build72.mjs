// PROTOTYPE (#72): the 문경 terrain for prototype round 3, built from the #58 caches with #60's cover rules, #59 rule 8's
// joined road lines and #70's 100 m clearings round the draft's three posts. Throwaway.
// Usage: node build72.mjs [fallback]   reads $DATA/mungyeong-sample-*.f32, osm-mungyeong.json, osm-water-mungyeong.json
// (and fetches osm-links-mungyeong.json once: the `_link` roads build.mjs did not ask for); writes $DATA/mungyeong72.bin,
// or with `fallback` $DATA/mungyeong72-fb.bin with #70 §6's forest height 8–11.4 m.
/* global process, console */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DATA, originOf, osmWater, toLonLat, toUtm, writeTerrain } from './lib.mjs';

const FALLBACK = process.argv[2] === 'fallback';
const site = 'mungyeong';
const N = 1024, CELL = 10, SPAN = (N - 1) * CELL;
const [X0, Y0] = originOf(site);
const GRID = { letters: 'CH', e0: 40000, n0: 30000 };
const draft = JSON.parse(readFileSync(`${DATA}/../m2-t64-draft.json`, 'utf8'));
const f32 = (name) => new Float32Array(readFileSync(`${DATA}/${site}-sample-${name}.tif.f32`).buffer.slice(0));
const ground = f32('gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2'); // scale 1 (#58 o1)
const wc = f32('ESA_WorldCover_10m_2021_v200_N36E126_Map');

// #60 §2: WorldCover → COVER ('open','field','forest','water','road','village','building'); an unknown value fails
const OPEN = 0, FIELD = 1, FOREST = 2, WATER = 3, ROAD = 4, VILLAGE = 5, BUILDING = 6;
const WC = new Map([[10, FOREST], [95, FOREST], [40, FIELD], [20, OPEN], [30, OPEN], [60, OPEN], [70, OPEN], [90, OPEN], [100, OPEN], [50, VILLAGE], [80, WATER]]);
const hash01 = (i, j) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const FOREST_H = FALLBACK ? [8, 3.4] : [12, 5]; // #70 §6 fallback, else the demo's 12–17 m

const local = (p) => { const [x, y] = toUtm(p.lon, p.lat); return { x: x - X0, y: y - Y0 }; };
const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= SPAN && p.y <= SPAN;
const noMilitary = (x) => !x.tags?.military && x.tags?.landuse !== 'military' && !['military', 'bunker', 'barracks'].includes(x.tags?.building);
const base = JSON.parse(readFileSync(`${DATA}/osm-${site}.json`, 'utf8')).elements.filter(noMilitary);

// the `_link` roads: one Overpass request (same box as build.mjs: the lon/lat extent of the square's edge nodes)
const linksPath = `${DATA}/osm-links-${site}.json`;
if (!existsSync(linksPath)) {
  const edge = [];
  for (let k = 0; k < N; k += 8) for (const [i, j] of [[k, 0], [k, N - 1], [0, k], [N - 1, k]]) edge.push(toLonLat(X0 + i * CELL, Y0 + j * CELL));
  const lons = edge.map((p) => p[0]), lats = edge.map((p) => p[1]);
  const bb = `${Math.min(...lats)},${Math.min(...lons)},${Math.max(...lats)},${Math.max(...lons)}`;
  const q = `[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)_link$"](${bb});out geom;`;
  execFileSync('curl', ['-sSf', '-m', '120', '-A', 'terrain-prototype/0.1', '--data-urlencode', `data=${q}`, 'https://overpass-api.de/api/interpreter', '-o', linksPath]);
}
const links = JSON.parse(readFileSync(linksPath, 'utf8')).elements.filter(noMilitary);

// --- roads (#60 §4: one cell wide, no tunnels; #59 rule 8: grade, clip, join where exactly two same-grade ends meet, order)
const GRADE = (hw) => (/^(motorway|trunk|primary)/.test(hw) ? 0 : /^(secondary|tertiary)/.test(hw) ? 1 : 2); // trunk, main, local
const ways = [...base, ...links].filter((x) => x.type === 'way' && x.tags.highway && x.tags.tunnel !== 'yes');
const road = new Uint8Array(N * N);
const stamp = (pts, arr) => {
  for (let a = 1; a < pts.length; a++) {
    const p = pts[a - 1], q = pts[a], L = Math.hypot(q.x - p.x, q.y - p.y);
    for (let t = 0; t <= L; t += 8) {
      const i = Math.round((p.x + ((q.x - p.x) * t) / L) / CELL), j = Math.round((p.y + ((q.y - p.y) * t) / L) / CELL);
      if (i >= 0 && i < N && j >= 0 && j < N) arr[j * N + i] = 1;
    }
  }
};
let runs = [];
for (const way of ways) {
  const pts = way.geometry.map((g) => ({ ...local(g), key: `${g.lat},${g.lon}` }));
  stamp(pts, road);
  let run = [];
  for (const p of pts) {
    if (inside(p)) run.push(p);
    else { if (run.length > 1) runs.push({ g: GRADE(way.tags.highway), pts: run }); run = []; }
  }
  if (run.length > 1) runs.push({ g: GRADE(way.tags.highway), pts: run });
}
const rawLines = runs.length;
for (let joined = true; joined;) {
  joined = false;
  const ends = new Map(); // grade|key → [run index, which end]
  runs.forEach((r, k) => { for (const e of [0, 1]) { const key = `${r.g}|${(e ? r.pts.at(-1) : r.pts[0]).key}`; ends.set(key, [...(ends.get(key) ?? []), [k, e]]); } });
  for (const list of ends.values()) {
    if (list.length !== 2 || list[0][0] === list[1][0]) continue;
    const [[a, ea], [b, eb]] = list;
    const A = ea ? runs[a].pts : [...runs[a].pts].reverse(); // ends at the meeting point
    const B = eb ? [...runs[b].pts].reverse() : runs[b].pts; // starts at it
    runs[a] = { g: runs[a].g, pts: [...A, ...B.slice(1)] };
    runs.splice(b, 1);
    joined = true;
    break;
  }
}
const lenOf = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.y - pts[k].y), 0);
runs = runs.map((r) => {
  const [a, z] = [r.pts[0], r.pts.at(-1)];
  const south = a.y < z.y || (a.y === z.y && a.x <= z.x);
  return { g: r.g, len: lenOf(r.pts), pts: (south ? r.pts : [...r.pts].reverse()).map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })) };
});
runs.sort((p, q) => p.g - q.g || q.len - p.len || p.pts[0].y - q.pts[0].y || p.pts[0].x - q.pts[0].x);
const roads = runs.map((r) => r.pts);
const grades = runs.map((r) => ['trunk', 'main', 'local'][r.g]);

// --- buildings (#60 §3), as build.mjs
const buildings = new Float32Array(N * N);
const okH = (v) => (Number.isFinite(v) && v > 0 && v <= 100 ? v : 0);
let nb = 0;
for (const way of base.filter((x) => x.type === 'way' && x.tags.building)) {
  const t = way.tags;
  const H = okH(parseFloat(t.height)) || okH(3 * parseFloat(t['building:levels']) + 1.5) || 6;
  const poly = way.geometry.map(local);
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  let hit = false;
  for (let j = Math.max(0, Math.ceil(Math.min(...ys) / CELL)); j <= Math.min(N - 1, Math.floor(Math.max(...ys) / CELL)); j++)
    for (let i = Math.max(0, Math.ceil(Math.min(...xs) / CELL)); i <= Math.min(N - 1, Math.floor(Math.max(...xs) / CELL)); i++) {
      const x = i * CELL, y = j * CELL;
      let c = false;
      for (let a = 0, b = poly.length - 1; a < poly.length; b = a++)
        if (poly[a].y > y !== poly[b].y > y && x < ((poly[b].x - poly[a].x) * (y - poly[a].y)) / (poly[b].y - poly[a].y) + poly[a].x) c = !c;
      if (c) { buildings[j * N + i] = Math.max(buildings[j * N + i], H); hit = true; }
    }
  if (!hit) {
    const i = Math.round(xs.reduce((a, b) => a + b) / xs.length / CELL), j = Math.round(ys.reduce((a, b) => a + b) / ys.length / CELL);
    if (i >= 0 && i < N && j >= 0 && j < N) { buildings[j * N + i] = Math.max(buildings[j * N + i], H); hit = true; }
  }
  if (hit) nb++;
}
const R = { town: 330, village: 170, hamlet: 110 };
const villages = base.filter((x) => x.type === 'node' && x.tags.name && R[x.tags.place])
  .map((x) => ({ name: x.tags.name, ...local(x), r: R[x.tags.place] })).filter(inside)
  .map(({ name, x, y, r }) => ({ name, x: Math.round(x), y: Math.round(y), r }));

// --- OSM water (#60 §2 수면 보강)
const { river, water } = osmWater(JSON.parse(readFileSync(`${DATA}/osm-water-${site}.json`, 'utf8')).elements, local, N, CELL);

// --- cover: building > road > OSM water > WorldCover; then the clearings; then heights
const cover = new Uint8Array(N * N);
for (let k = 0; k < N * N; k++) {
  const c = WC.get(wc[k]);
  if (c === undefined) throw new Error(`WorldCover value ${wc[k]} at cell ${k} is not in the table`);
  cover[k] = buildings[k] ? BUILDING : road[k] ? ROAD : river[k] || water[k] ? WATER : c;
}
// #70 §3: forest cells within 100 m of each post become open; a friendly position on a forest cell gets 220 m
const P = ([x, y]) => ({ x, y });
const clearings = draft.posts.map((p) => ({ ...P(p), r: 100, kind: 'post' }));
for (const f of draft.friends.map(P)) if (cover[Math.round(f.y / CELL) * N + Math.round(f.x / CELL)] === FOREST) clearings.push({ ...f, r: 220, kind: 'friend' });
let cleared = 0;
for (const c of clearings)
  for (let j = Math.max(0, Math.floor((c.y - c.r) / CELL)); j <= Math.min(N - 1, Math.ceil((c.y + c.r) / CELL)); j++)
    for (let i = Math.max(0, Math.floor((c.x - c.r) / CELL)); i <= Math.min(N - 1, Math.ceil((c.x + c.r) / CELL)); i++)
      if ((i * CELL - c.x) ** 2 + (j * CELL - c.y) ** 2 <= c.r * c.r && cover[j * N + i] === FOREST) { cover[j * N + i] = OPEN; cleared++; }
const surface = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const k = j * N + i;
  surface[k] = ground[k] + buildings[k] + (cover[k] === FOREST ? FOREST_H[0] + FOREST_H[1] * hash01(i, j) : 0);
}
const counts = Object.fromEntries(['open', 'field', 'forest', 'water', 'road', 'village', 'building'].map((n, c) => [n, cover.filter((v) => v === c).length]));
const out = `${DATA}/${site}72${FALLBACK ? '-fb' : ''}.bin`;
writeTerrain(out, { n: N, cell: CELL, grid: GRID, roads, villages, ground, surface, buildings, cover, clearings }, `${site} GEDTM30 v1.2, #60 cover, forest ${FOREST_H[0]}–${FOREST_H[0] + FOREST_H[1]} m, #70 clearings`);
console.log(JSON.stringify({ rawLines, joinedLines: roads.length, byGrade: { trunk: grades.filter((g) => g === 'trunk').length, main: grades.filter((g) => g === 'main').length, local: grades.filter((g) => g === 'local').length }, links: links.length, tunnelsDropped: [...base, ...links].filter((x) => x.tags?.highway && x.tags.tunnel === 'yes').length, buildings: nb, places: villages.length, clearings, cleared, counts }));
// grades of the road lines, in order (the map's three widths; not in the terrain file the app reads)
writeFileSync(`${DATA}/${site}72-grades.json`, JSON.stringify(grades));
