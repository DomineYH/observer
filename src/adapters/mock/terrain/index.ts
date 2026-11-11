// mock 지형 원천: seeded procedural terrain (demo lines 200–262). Headless and deterministic: it follows the
// simulation's bans and uses only 결정적 수학 from sim, because server replay regenerates it from the seed.
import type { COVER, Point, Road, TerrainData } from '@sim';
import { cos, exp, sin } from '@sim/math';
import type { TerrainSource } from '../../index';
import { CELL, FRIEND_HILLS, GRID, N, OP_HILL, ROADS, VILLAGES } from './features';
import { fbm, hash, ss } from './noise';

const TAU = Math.PI * 2;
// Only 결정적 수학 may come from sim as values here; the type check keeps this tuple equal to sim's COVER.
const ORDER = ['open', 'field', 'forest', 'water', 'road', 'village', 'building'] as const satisfies typeof COVER;
const C = (c: (typeof ORDER)[number]): number => ORDER.indexOf(c);
const [OPEN, FIELD, FOREST, WATER, ROAD, VILLAGE, BUILDING] = [C('open'), C('field'), C('forest'), C('water'), C('road'), C('village'), C('building')];

/** Gaussian bump a·exp(−q), cut to 0 beyond 4 widths (q ≥ 16), where it is below 1e-7·a. */
const bump = (a: number, q: number): number => (q < 16 ? a * exp(-q) : 0);
const dist2 = (x: number, y: number, p: Point): number => (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y);
const riverY = (x: number): number => 3950 + 180 * sin(x / 900) + 60 * sin(x / 310);

export function generateTerrain(seed: number): TerrainData {
  // The seed salts every noise layer; the authored features stay put (plan A1).
  const salt = Math.imul(seed, 0x9e3779b1);
  const S = (s: number): number => (s + salt) | 0;
  const ground = new Float32Array(N * N);
  const surface = new Float32Array(N * N);
  const buildings = new Float32Array(N * N);
  const cover = new Uint8Array(N * N);
  const road = new Uint8Array(N * N);
  const village = new Uint8Array(N * N);
  const river = new Float64Array(N);
  for (let i = 0; i < N; i++) river[i] = riverY(i * CELL);

  // 지면 높이
  for (let j = 0; j < N; j++) {
    const y = j * CELL;
    const ridge = bump(170, ((y - 1800) / 420) * ((y - 1800) / 420));
    const valley = bump(95, ((y - 3800) / 950) * ((y - 3800) / 950));
    const north = ss(4600, 7600, y);
    const far = ss(8200, 10240, y);
    const south = 60 * ss(1300, 0, y);
    for (let i = 0; i < N; i++) {
      const x = i * CELL;
      let h = 170 + 120 * fbm(x / 2400, y / 2400, S(11), 6);
      if (ridge) h += ridge * (0.75 + 0.35 * fbm(x / 1500, y / 1500, S(23), 3));
      h += bump(80, dist2(x, y, OP_HILL) / (170 * 170));
      h -= valley;
      if (north) h += 150 * north * (0.8 + 0.4 * fbm(x / 1800, y / 1800, S(31), 3));
      if (far) h += 320 * far * (0.7 + 0.5 * fbm(x / 1200, y / 1200, S(41), 4));
      h -= south;
      for (const f of FRIEND_HILLS) h += bump(28, dist2(x, y, f) / (300 * 300));
      const rd = Math.abs(y - river[i]!);
      if (rd < 120) h -= 12 * (1 - rd / 120);
      ground[j * N + i] = Math.max(40, h);
    }
  }

  // 마을 터 고르기
  for (const v of VILLAGES) {
    const c = ground[(v.y / CELL) * N + v.x / CELL]!; // centres sit on cells, where the demo's bilinear read is exact
    const R = v.r * 1.6;
    for (let j = Math.max(0, ((v.y - R) / CELL) | 0); j <= Math.min(N - 1, ((v.y + R) / CELL) | 0); j++)
      for (let i = Math.max(0, ((v.x - R) / CELL) | 0); i <= Math.min(N - 1, ((v.x + R) / CELL) | 0); i++) {
        const d = Math.sqrt(dist2(i * CELL, j * CELL, v));
        if (d > R) continue;
        const w = 0.75 * (1 - ss(v.r * 0.7, R, d));
        const k = j * N + i;
        ground[k] = ground[k]! * (1 - w) + c * w;
        village[k] = 1;
      }
  }

  // 도로: rasterised every 8 m, centreline kept every 40 m for the map
  const roads = ROADS.map((waypoints): Road => {
    const line: Point[] = [];
    for (let s = 1; s < waypoints.length; s++) {
      const a = waypoints[s - 1]!;
      const b = waypoints[s]!;
      const L = Math.sqrt(dist2(a.x, a.y, b));
      for (let t = 0; t <= L; t += 8) {
        const x = a.x + ((b.x - a.x) * t) / L + 18 * sin(t / 260);
        const y = a.y + ((b.y - a.y) * t) / L;
        if (t % 40 === 0) line.push({ x, y });
        const i = (x / CELL) | 0;
        const j = (y / CELL) | 0;
        if (i >= 0 && i < N && j >= 0 && j < N) road[j * N + i] = 1;
      }
    }
    return { class: 'main', line };
  });

  // 건물: draws come from the salted hash, one counter per village
  VILLAGES.forEach((v, vi) => {
    let draw = 0;
    const rnd = () => hash(vi, draw++, S(101));
    for (let n = 0; n < v.houses * 2; n++) {
      const a = rnd() * TAU;
      const d = Math.sqrt(rnd()) * v.r;
      const i = ((v.x + cos(a) * d) / CELL) | 0;
      const j = ((v.y + sin(a) * d) / CELL) | 0;
      if (i < 0 || i >= N || j < 0 || j >= N || road[j * N + i]) continue;
      const big = !!v.town && rnd() < 0.12;
      const height = big ? 18 + rnd() * 14 : v.town ? 6 + rnd() * 5 : 4.5 + rnd() * 3;
      const w = big ? 2 + ((rnd() * 2) | 0) : 1;
      const depth = big ? 2 + ((rnd() * 3) | 0) : rnd() < 0.4 ? 2 : 1;
      for (let dj = 0; dj < depth; dj++)
        for (let di = 0; di < w; di++) {
          const k = Math.min(N - 1, j + dj) * N + Math.min(N - 1, i + di);
          if (!road[k]) buildings[k] = height;
        }
    }
  });

  // 피복 분류와 표면 높이
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = i * CELL;
      const y = j * CELL;
      const rd = Math.abs(y - river[i]!);
      let forest = !(rd < 45 || village[k] || road[k] || buildings[k]) && FRIEND_HILLS.every((f) => dist2(x, y, f) >= 220 * 220);
      if (forest) {
        const g = fbm(x / 700, y / 700, S(57), 4) + 0.25 * fbm(x / 180, y / 180, S(61), 2);
        const dObs = dist2(x, y, OP_HILL);
        forest = y > 2300 ? g > 0.12 && dObs > 350 * 350 : y < 2300 && g > 0.28 && dObs > 500 * 500;
      }
      surface[k] = ground[k]! + (forest ? 12 + 5 * hash(i, j, S(5)) : 0) + buildings[k]!;
      if (buildings[k]) cover[k] = BUILDING;
      else if (road[k]) cover[k] = ROAD;
      else if (rd < 30) cover[k] = WATER;
      else if (village[k]) cover[k] = VILLAGE;
      else if (forest) cover[k] = FOREST;
      else if (ground[k]! < 175 && fbm(x / 500, y / 500, S(83), 3) > -0.15) cover[k] = FIELD;
      else cover[k] = OPEN;
    }

  return {
    id: 'mock',
    version: 1,
    credits: [],
    n: N,
    cell: CELL,
    ground,
    surface,
    cover,
    buildings,
    roads,
    villages: VILLAGES.map(({ name, x, y, r }) => ({ name, x, y, r })),
    names: [],
    edge: 'mirror',
    grid: GRID,
  };
}

export const mockTerrain: TerrainSource = { load: async (seed) => generateTerrain(seed) };
