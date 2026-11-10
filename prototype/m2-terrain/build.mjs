// PROTOTYPE (#58): builds the TerrainData file of a candidate square from public data. Throwaway.
// Usage: node build.mjs <jinan|mungyeong>   (network; writes $DATA/<site>.bin, the <site>-sample-*.f32 and
// osm-<site>.json caches and stats-<site>.json; nothing in the repo). Ground is GEDTM30 (user decision 2026-11-10).
// Observation-post clearings are applied afterwards by clear.mjs.
//
// The square: UTM 52N nodes at (X0 + 10 i, Y0 + 10 j), i, j = 0..1023 (span 10,230 m), centred on the site's centre as
// #68 checked it. Each node is projected back to lon/lat and every source is sampled AT that point: bilinear between the
// source's pixel centres for elevation, nearest pixel for land cover. No GDAL-style area resampling, so no half-pixel offset.
/* global process, console */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import proj4 from 'proj4';
import { bilinear, DATA, GEDTM, nearest, originOf, readBox, SITES, toLonLat, toUtm, writeTerrain } from './lib.mjs';

const site = process.argv[2];
if (!SITES[site]) throw new Error(`usage: node build.mjs <${Object.keys(SITES).join('|')}>`);
const SRC = SITES[site];
const N = 1024, CELL = 10;
const [X0, Y0] = originOf(site);
console.log(site, 'origin', X0, Y0, 'centre MGRS', proj4.mgrs.forward(SRC.centre), 'SW', proj4.mgrs.forward(toLonLat(X0, Y0)), 'NE', proj4.mgrs.forward(toLonLat(X0 + 10230, Y0 + 10230)));
const GRID = { letters: 'CH', e0: 40000, n0: 30000 }; // virtual 방안 기준, the mock's (#67)

// ESA WorldCover 2021 class → COVER index ('open','field','forest','water','road','village','building'). A proposal.
const OPEN = 0, FIELD = 1, FOREST = 2, WATER = 3, ROAD = 4, VILLAGE = 5, BUILDING = 6;
const WC = new Map([[10, FOREST], [20, OPEN], [30, OPEN], [40, FIELD], [50, VILLAGE], [60, OPEN], [70, OPEN], [80, WATER], [90, FIELD], [95, FOREST], [100, OPEN]]);

// Demo forest height (the mock's rule, 12–17 m per cell); not 임분고.
const hash01 = (i, j) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const forestH = (i, j) => 12 + 5 * hash01(i, j);

// --- node coordinates
const lon = new Float64Array(N * N), lat = new Float64Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) [lon[j * N + i], lat[j * N + i]] = toLonLat(X0 + i * CELL, Y0 + j * CELL);
let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
for (let k = 0; k < N * N; k++) { w = Math.min(w, lon[k]); e = Math.max(e, lon[k]); s = Math.min(s, lat[k]); n = Math.max(n, lat[k]); }
const box = [w, s, e, n];
console.log('lon/lat box', box.map((v) => v.toFixed(5)).join(' '));

// Sampled sources are cached in $DATA (sample-<name>.f32); range reads are retried, the WorldCover host resets sometimes.
async function sampled(url, read) {
  const cache = `${DATA}/${site}-sample-${url.split('/').pop()}.f32`;
  if (existsSync(cache)) return new Float32Array(readFileSync(cache).buffer.slice(0));
  let r;
  for (let a = 1; !r; a++) r = await readBox(url, box).catch((err) => { if (a >= 4) throw err; console.log('retry', a, err.message); });
  console.log(url.split('/').pop(), `window ${r.width}x${r.height}`, `sampleFormat ${r.sampleFormat} bits ${r.bits} nodata ${r.nodata}`);
  const out = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) out[k] = read(r, lon[k], lat[k]);
  writeFileSync(cache, out);
  return out;
}
const glo30 = await sampled(SRC.glo30, bilinear);
const glo90 = await sampled(SRC.glo90, bilinear);
const gedtmRaw = await sampled(GEDTM, bilinear);
const wc = await sampled(SRC.cover, nearest);

// GEDTM30 scale: the file is Float32 with no scale/offset tag. Decide from the values against GLO-30 (metres).
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const gedtmScale = Math.abs(mean(gedtmRaw) / mean(glo30) - 1) < 0.5 ? 1 : 0.1;
console.log('GEDTM30 raw mean', mean(gedtmRaw).toFixed(1), 'GLO-30 mean', mean(glo30).toFixed(1), '→ scale', gedtmScale);
const gedtm = gedtmRaw.map((v) => v * gedtmScale);

// --- OSM roads, buildings, place names: one Overpass request, cached in $DATA/osm-<site>.json
const osmPath = `${DATA}/osm-${site}.json`;
if (!existsSync(osmPath)) {
  const bb = `${s},${w},${n},${e}`;
  const q = `[out:json][timeout:90];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"](${bb});way["building"](${bb});node["place"~"^(town|village|hamlet)$"](${bb}););out geom;`;
  // curl, not fetch: Node's fetch could not connect to overpass-api.de from this WSL host
  execFileSync('curl', ['-sSf', '-m', '180', '-A', 'terrain-prototype/0.1', '--data-urlencode', `data=${q}`, 'https://overpass-api.de/api/interpreter', '-o', osmPath]);
}
const osm = JSON.parse(readFileSync(osmPath, 'utf8')).elements
  // never carry a military feature (none was asked for; drop any that came along)
  .filter((x) => !x.tags?.military && x.tags?.landuse !== 'military' && !['military', 'bunker', 'barracks'].includes(x.tags?.building));
const local = (p) => { const [x, y] = toUtm(p.lon, p.lat); return { x: x - X0, y: y - Y0 }; };
const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= (N - 1) * CELL && p.y <= (N - 1) * CELL;

const road = new Uint8Array(N * N);
const roads = [];
const MAJOR = /^(motorway|trunk|primary|secondary|tertiary)$/;
for (const way of osm.filter((x) => x.type === 'way' && x.tags.highway)) {
  const pts = way.geometry.map(local);
  for (let a = 1; a < pts.length; a++) {
    const p = pts[a - 1], q = pts[a], L = Math.hypot(q.x - p.x, q.y - p.y);
    for (let t = 0; t <= L; t += 8) {
      const i = Math.round((p.x + ((q.x - p.x) * t) / L) / CELL), j = Math.round((p.y + ((q.y - p.y) * t) / L) / CELL);
      if (i >= 0 && i < N && j >= 0 && j < N) road[j * N + i] = 1;
    }
  }
  // the map draws major roads and unclassified links only, as clipped polylines
  if (!MAJOR.test(way.tags.highway) && way.tags.highway !== 'unclassified') continue;
  let run = [];
  for (const p of pts) {
    if (inside(p)) run.push(p);
    else { if (run.length > 1) roads.push(run); run = []; }
  }
  if (run.length > 1) roads.push(run);
}
roads.sort((a, b) => b.length - a.length); // the sim's supply truck takes roads[1]

const buildings = new Float32Array(N * N);
let nb = 0;
for (const way of osm.filter((x) => x.type === 'way' && x.tags.building)) {
  const t = way.tags;
  const H = +t.height || (+t['building:levels'] ? 3 * +t['building:levels'] + 1.5 : 6); // default: a 1–2 storey house
  const poly = way.geometry.map(local);
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const i0 = Math.ceil(Math.min(...xs) / CELL), i1 = Math.floor(Math.max(...xs) / CELL);
  const j0 = Math.ceil(Math.min(...ys) / CELL), j1 = Math.floor(Math.max(...ys) / CELL);
  let hit = false;
  for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
    const x = i * CELL, y = j * CELL;
    let c = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++)
      if (poly[a].y > y !== poly[b].y > y && x < ((poly[b].x - poly[a].x) * (y - poly[a].y)) / (poly[b].y - poly[a].y) + poly[a].x) c = !c;
    if (c) { buildings[j * N + i] = Math.max(buildings[j * N + i], H); hit = true; }
  }
  if (!hit) { // smaller than a cell: the node nearest its middle
    const i = Math.round(xs.reduce((a, b) => a + b) / xs.length / CELL), j = Math.round(ys.reduce((a, b) => a + b) / ys.length / CELL);
    if (i >= 0 && i < N && j >= 0 && j < N) { buildings[j * N + i] = Math.max(buildings[j * N + i], H); hit = true; }
  }
  if (hit) nb++;
}
const R = { town: 330, village: 170, hamlet: 110 };
const villages = osm.filter((x) => x.type === 'node' && x.tags.name)
  .map((x) => ({ name: x.tags.name, ...local(x), r: R[x.tags.place] }))
  .filter(inside).map(({ name, x, y, r }) => ({ name, x: Math.round(x), y: Math.round(y), r }));
console.log(`osm: ${roads.length} road polylines, ${nb} buildings, ${villages.length} places`);

// --- cover
const cover = new Uint8Array(N * N);
const fh = new Float32Array(N * N);
const counts = new Map();
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const k = j * N + i;
  counts.set(wc[k], (counts.get(wc[k]) ?? 0) + 1);
  cover[k] = buildings[k] ? BUILDING : road[k] ? ROAD : WC.get(wc[k]) ?? OPEN;
  if (cover[k] === FOREST) fh[k] = forestH(i, j);
}

// --- the terrain: GEDTM30 ground; surface adds the demo forest height and the buildings
const ground = gedtm;
const surface = ground.map((h, k) => h + fh[k] + buildings[k]);
writeTerrain(`${DATA}/${site}.bin`, { n: N, cell: CELL, grid: GRID, roads, villages, ground, surface, buildings, cover }, `${site} GEDTM30 v1.2`);

// cross-check against GLO-90 (a DSM: coarse sanity check only)
const band = (h) => Math.floor(h / 20);
let d2 = 0, same = 0, lo = Infinity, hi = -Infinity;
for (let k = 0; k < N * N; k++) {
  d2 += (ground[k] - glo90[k]) ** 2;
  if (band(ground[k]) === band(glo90[k])) same++;
  lo = Math.min(lo, ground[k]); hi = Math.max(hi, ground[k]);
}
const stats = {
  site, square: { X0, Y0, N, CELL, box }, gedtmScale,
  ground: { mean: +mean(ground).toFixed(1), min: +lo.toFixed(1), max: +hi.toFixed(1), rmsVsGlo90: +Math.sqrt(d2 / (N * N)).toFixed(1), same20mBandAsGlo90: +(same / (N * N)).toFixed(3) },
  glo30: { mean: +mean(glo30).toFixed(1) }, glo90: { mean: +mean(glo90).toFixed(1) },
  forestShare: +(cover.filter((c) => c === FOREST).length / (N * N)).toFixed(3),
  worldcover: [...counts].sort((a, b) => a[0] - b[0]), osm: { roads: roads.length, buildings: nb, places: villages.length },
};
writeFileSync(`${DATA}/stats-${site}.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
