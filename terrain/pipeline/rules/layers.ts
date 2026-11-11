// 가공 steps 1–6: 원자료 스냅샷 → the cell layers (ground, cover, building heights) and the counts the 가공 기록 keeps.
// Geometry runs on the snapshot's integer 0.1 m points; node (i, j) sits at (i·u, j·u) with u = cell · 10.
import { COVER, type Cover } from '@sim';
import type { Config } from '../config';
import type { OsmElement, Snapshot } from '../snapshot';

/** 지면 눈금: stored heights are whole 0.1 m. Not the ground source's 값 배율 (config.sources.ground.scale). */
export const SCALE = 10;
export const DEFAULT_HEIGHT = 6;

/** WorldCover 2021 class value → 피복 (가공 규칙 판 2), ascending. */
export const WORLDCOVER: readonly (readonly [number, Cover])[] = [
  [10, 'forest'], [20, 'open'], [30, 'open'], [40, 'field'], [50, 'village'], [60, 'open'],
  [70, 'open'], [80, 'water'], [90, 'open'], [95, 'forest'], [100, 'open'],
];
// ponytail: config.json's Overpass query still asks for the old set (no unclassified_link, residential_link); the manifest
// records that query, so it stays until the next 받기, which must widen it to this set.
const ROAD = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)(_link)?$/;
const STAMP_STEP = 8; // m between stamped points along a line; below one cell, so no cell is skipped

const c = (name: Cover) => COVER.indexOf(name);
const stop = (why: string): never => {
  throw new Error(`가공: ${why}`);
};

export interface Discarded {
  id: number;
  tag: string;
  value: string;
}

export interface Layers {
  ground: Float32Array; // m, whole 0.1 m
  groundTenths: Int32Array; // the same in 0.1 m
  cover: Uint8Array;
  buildings: Float32Array;
  worldcover: { value: number; cells: number }[];
  overwritten: { water: number; road: number; building: number; clearing: number };
  buildingCount: number;
  heightFrom: { tag: number; levels: number; default: number };
  discarded: Discarded[];
}

export function layers(config: Config, snap: Snapshot): Layers {
  const { n, cell } = config.frame;
  const u = cell * 10;
  const cells = n * n;

  // 1. WorldCover → 피복. A cover.bin of another length would leave missing cells as 0 (open) or cut extra ones.
  if (snap.cover.length !== cells) stop(`cover.bin 길이 ${snap.cover.length} ≠ ${cells}`);
  const lookup = new Int16Array(256).fill(-1);
  for (const [v, name] of WORLDCOVER) lookup[v] = c(name);
  const perValue = new Float64Array(256);
  const cover = new Uint8Array(cells);
  for (let k = 0; k < cells; k++) {
    const v = snap.cover[k]!;
    if (lookup[v]! < 0) stop(`대응표에 없는 피복 값 ${v} (칸 ${k})`);
    cover[k] = lookup[v]!;
    perValue[v]!++;
  }
  const worldcover = WORLDCOVER.map(([value]) => ({ value, cells: perValue[value]! }));

  /** Sets `cells` to `to`, returns how many changed. */
  const paint = (ks: Iterable<number>, to: number): number => {
    let changed = 0;
    for (const k of ks)
      if (cover[k] !== to) {
        cover[k] = to;
        changed++;
      }
    return changed;
  };

  /** Nodes on a line: a point every STAMP_STEP m of each segment and its end, each rounded to the nearest node. */
  const stamp = (pts: [number, number][]): Set<number> => {
    const out = new Set<number>();
    const add = (x: number, y: number) => {
      const i = Math.round(x / u);
      const j = Math.round(y / u);
      if (i >= 0 && i < n && j >= 0 && j < n) out.add(j * n + i);
    };
    if (pts.length) add(...pts[0]!);
    for (let s = 1; s < pts.length; s++) {
      const [x1, y1] = pts[s]!;
      const [x0, y0] = pts[s - 1]!;
      const len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      for (let d = STAMP_STEP * 10; d < len; d += STAMP_STEP * 10) add(x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len);
      add(x1, y1);
    }
    return out;
  };

  /** Nodes inside a ring (even-odd test at the node position). */
  const inside = (pts: [number, number][]): number[] => {
    const [minX, minY, maxX, maxY] = box(pts);
    const out: number[] = [];
    for (let j = Math.max(0, Math.ceil(minY / u)); j <= Math.min(n - 1, Math.floor(maxY / u)); j++)
      for (let i = Math.max(0, Math.ceil(minX / u)); i <= Math.min(n - 1, Math.floor(maxX / u)); i++) {
        const X = i * u;
        const Y = j * u;
        let odd = false;
        for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
          const [xa, ya] = pts[a]!;
          const [xb, yb] = pts[b]!;
          if (ya > Y !== yb > Y && X < xa + ((Y - ya) * (xb - xa)) / (yb - ya)) odd = !odd;
        }
        if (odd) out.push(j * n + i);
      }
    return out;
  };

  const ways = (test: (e: OsmElement) => boolean) => snap.osm.filter((e) => e.type === 'way' && test(e)).map((e) => e.pts ?? []);

  // 2. 수면: water areas filled, river centre lines one cell wide. Streams are not taken.
  // ponytail: water relations (multipolygons) stop instead of being filled; the 문경 snapshot has none. Fill the outer rings when one appears.
  if (snap.osm.some((e) => e.type === 'relation' && e.tags.natural === 'water')) stop('natural=water 관계 요소는 아직 다루지 않는다');
  let water = 0;
  for (const pts of ways((e) => e.tags.natural === 'water')) water += paint(inside(pts), c('water'));
  for (const pts of ways((e) => e.tags.waterway === 'river')) water += paint(stamp(pts), c('water'));

  // 3. 도로 칸: every graded road, one cell wide, whatever its grade. Tunnels are left out.
  let road = 0;
  for (const pts of ways((e) => ROAD.test(e.tags.highway ?? '') && e.tags.tunnel !== 'yes')) road += paint(stamp(pts), c('road'));

  // 4. 건물: height tag → levels · 3 + 1.5 → 6 m. A footprint with no node inside takes the node nearest its box centre.
  const height = new Float64Array(cells);
  const heightFrom = { tag: 0, levels: 0, default: 0 };
  const discarded: Discarded[] = [];
  let building = 0;
  let buildingCount = 0;
  for (const e of snap.osm) {
    if (e.type !== 'way' || e.tags.building === undefined) continue;
    const pts = e.pts ?? [];
    let ks = inside(pts);
    if (!ks.length && pts.length) {
      const [minX, minY, maxX, maxY] = box(pts);
      const i = Math.round((minX + maxX) / 2 / u);
      const j = Math.round((minY + maxY) / 2 / u);
      ks = i >= 0 && i < n && j >= 0 && j < n ? [j * n + i] : [];
    }
    if (!ks.length) continue;
    const h = buildingHeight(e, discarded, heightFrom);
    buildingCount++;
    building += paint(ks, c('building'));
    for (const k of ks) height[k] = Math.max(height[k]!, h);
  }

  // 5. 벌채지: forest cells within each circle become open land. Every circle is matched against the cover before any clearing.
  const forest = c('forest');
  const inCircle = config.clearings.map(({ x, y, r }) => {
    const ks: number[] = [];
    for (let j = Math.max(0, Math.ceil((y - r) / cell)); j <= Math.min(n - 1, Math.floor((y + r) / cell)); j++)
      for (let i = Math.max(0, Math.ceil((x - r) / cell)); i <= Math.min(n - 1, Math.floor((x + r) / cell)); i++) {
        const k = j * n + i;
        const dx = i * cell - x;
        const dy = j * cell - y;
        if (dx * dx + dy * dy <= r * r && cover[k] === forest) ks.push(k);
      }
    if (!ks.length) stop(`벌채 원 (${x}, ${y})에 숲 칸이 없다`);
    return ks;
  });
  let clearing = 0;
  for (const ks of inCircle) clearing += paint(ks, c('open'));

  // 6. Building height layer and ground rounded to the 지면 눈금 (packTerrain's own rounding is then the identity).
  const buildings = new Float32Array(cells);
  const ground = new Float32Array(cells);
  const groundTenths = new Int32Array(cells);
  for (let k = 0; k < cells; k++) {
    if (cover[k] === c('building')) buildings[k] = height[k]!;
    groundTenths[k] = Math.round((snap.ground[k]! * SCALE) / 100);
    ground[k] = groundTenths[k]! / SCALE;
  }

  return {
    ground, groundTenths, cover, buildings, worldcover,
    overwritten: { water, road, building, clearing },
    buildingCount, heightFrom, discarded,
  };
}

/** Bounding box [minX, minY, maxX, maxY] of a point list. */
function box(pts: [number, number][]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  return b;
}

/** A tag value is 없는 값 when it is not a number, ≤ 0, or gives a height above 100 m or one that rounds to 0. */
function buildingHeight(e: OsmElement, discarded: Discarded[], from: { tag: number; levels: number; default: number }): number {
  const sources = [['height', 1, 0, 'tag'], ['building:levels', 3, 1.5, 'levels']] as const;
  for (const [tag, per, plus, key] of sources) {
    const value = e.tags[tag];
    if (value === undefined) continue;
    const v = Number(value);
    const h = v * per + plus;
    if (Number.isFinite(v) && v > 0 && h <= 100 && Math.round(h * SCALE) > 0) {
      from[key]++;
      return h;
    }
    discarded.push({ id: e.id, tag, value });
  }
  from.default++;
  return DEFAULT_HEIGHT;
}
