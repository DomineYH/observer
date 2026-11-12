// 가공 step 7: 도로선. The road cells' ways, cut at the square, joined where exactly two ends of one grade meet, rounded
// to 1 m, started at the south (then west) end and ordered by grade → length → first point. Every key comes from the
// final points, so the order is a function of the lines' shape.
import type { Point, Road, RoadClass } from '@sim';
import { ROAD_CLASS } from '@sim/terrain';
import type { Snapshot } from '../snapshot';
import { isRoad, ROAD } from './layers';

type Pt = [number, number];
interface Piece {
  grade: RoadClass;
  pts: Pt[];
}

const GRADE: Record<string, RoadClass> = {
  motorway: 'trunk', trunk: 'trunk', primary: 'trunk',
  secondary: 'main', tertiary: 'main',
  unclassified: 'local', residential: 'local',
};

/** OpenStreetMap highway value → 도로 등급; a _link is its main road's grade. */
export const gradeOf = (highway: string): RoadClass => GRADE[highway.replace(/_link$/, '')]!;

/** The part [t0, t1] of segment a → b inside [0, max]² (Liang–Barsky), or null. */
function span(a: Pt, b: Pt, max: number): [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let [t0, t1] = [0, 1];
  for (const [p, q] of [[-dx, a[0]], [dx, max - a[0]], [-dy, a[1]], [dy, max - a[1]]] as const) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
  }
  if (t0 > t1 || (t0 === t1 && (dx !== 0 || dy !== 0))) return null; // missed, or touches one point only
  return [t0, t1];
}

/** Pieces of a line inside [0, max]² (0.1 m): each segment is cut on the edge, a line that leaves and returns gives two. */
export function clip(pts: readonly Pt[], max: number): Pt[][] {
  const edge = (v: number) => Math.min(max, Math.max(0, v));
  const at = (a: Pt, b: Pt, t: number): Pt => (t === 0 ? a : t === 1 ? b : [edge(a[0] + (b[0] - a[0]) * t), edge(a[1] + (b[1] - a[1]) * t)]);
  const out: Pt[][] = [];
  let cur: Pt[] | null = null;
  for (let s = 1; s < pts.length; s++) {
    const [a, b] = [pts[s - 1]!, pts[s]!];
    const ts = span(a, b, max);
    if (!ts) {
      cur = null;
      continue;
    }
    if (!cur || ts[0] > 0) out.push((cur = [at(a, b, ts[0])]));
    cur.push(at(a, b, ts[1]));
    if (ts[1] < 1) cur = null;
  }
  return out;
}

/** Joins two pieces wherever exactly two ends of one grade, from two pieces, meet; until none is left. */
function join(pieces: Piece[]): Piece[] {
  const live = pieces.slice();
  for (;;) {
    const ends = new Map<string, number[]>(); // grade|x,y → piece index · 2 + (0 start, 1 end)
    live.forEach(({ grade, pts }, i) =>
      [pts[0]!, pts[pts.length - 1]!].forEach(([x, y], e) => {
        const key = `${grade}|${x},${y}`;
        ends.set(key, [...(ends.get(key) ?? []), i * 2 + e]);
      }),
    );
    let pair: number[] | undefined;
    for (const list of ends.values())
      if (list.length === 2 && list[0]! >> 1 !== list[1]! >> 1) {
        pair = list;
        break;
      }
    if (!pair) return live;
    const [a, b] = pair as [number, number]; // a < b: pieces are listed in order
    const [i, j] = [a >> 1, b >> 1];
    const head = a & 1 ? live[i]!.pts : live[i]!.pts.slice().reverse(); // shared end last
    const tail = b & 1 ? live[j]!.pts.slice().reverse() : live[j]!.pts; // shared end first
    live[i] = { grade: live[i]!.grade, pts: [...head, ...tail.slice(1)] };
    live.splice(j, 1);
  }
}

/** 1 m points without repeated neighbours, from the south end (the west end when both have the same y). */
function finish({ grade, pts }: Piece): Road {
  const line: Point[] = [];
  for (const [x, y] of pts) {
    const q = { x: Math.round(x / 10), y: Math.round(y / 10) };
    const last = line[line.length - 1];
    if (!last || last.x !== q.x || last.y !== q.y) line.push(q);
  }
  // ponytail: a lone piece under 1 m rounds to one point and the 불변 조건 stops 가공; 문경 has none. Drop and count it
  // in the 가공 기록 when data shows one.
  if (startsLater(line)) line.reverse();
  return { class: grade, line };
}

/** True when the line's last point is south of its first (west of it at the same y). */
export function startsLater(line: readonly Point[]): boolean {
  const [a, b] = [line[0]!, line[line.length - 1]!];
  return b.y < a.y || (b.y === a.y && b.x < a.x);
}

export function lineLength(line: readonly Point[]): number {
  let sum = 0;
  for (let k = 1; k < line.length; k++) {
    const dx = line[k]!.x - line[k - 1]!.x;
    const dy = line[k]!.y - line[k - 1]!.y;
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return sum;
}

/** 도로선 order: grade → longer first → first point's y → its x. */
export const compareRoads = (a: Road, b: Road): number =>
  ROAD_CLASS.indexOf(a.class) - ROAD_CLASS.indexOf(b.class) ||
  lineLength(b.line) - lineLength(a.line) ||
  a.line[0]!.y - b.line[0]!.y ||
  a.line[0]!.x - b.line[0]!.x;

export interface RoadLog {
  elements: Record<RoadClass, number>;
  tunnels: number;
  pieces: number;
  lines: Record<RoadClass, number>;
}

export function roadLines(snap: Snapshot, n: number, cell: number): { roads: Road[]; log: RoadLog } {
  const max = (n - 1) * cell * 10;
  const elements = { trunk: 0, main: 0, local: 0 };
  let tunnels = 0;
  const pieces: Piece[] = [];
  for (const e of snap.osm) {
    if (e.type !== 'way') continue;
    if (!isRoad(e)) {
      if (ROAD.test(e.tags.highway ?? '')) tunnels++;
      continue;
    }
    const grade = gradeOf(e.tags.highway!);
    elements[grade]++;
    for (const pts of clip(e.pts ?? [], max)) pieces.push({ grade, pts });
  }
  const roads = join(pieces).map(finish).sort(compareRoads);
  const lines = { trunk: 0, main: 0, local: 0 };
  for (const r of roads) lines[r.class]++;
  return { roads, log: { elements, tunnels, pieces: pieces.length, lines } };
}
