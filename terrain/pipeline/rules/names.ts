// 가공 step 8: 마을 점과 지명. Every position is rounded to 1 m first and every rule runs on the rounded values, so what
// the 지형 파일 holds is what was checked.
import type { PlaceName, Point, Village } from '@sim';
import type { OsmElement, Snapshot } from '../snapshot';
import { box } from './layers';
import { clip, lineLength } from './roads';

/** Label radius (m) per place kind. */
export const RADIUS = new Map([['town', 330], ['village', 170], ['hamlet', 110]]);
export const NAME_CAP = { water: 4, peak: 8, pass: 4 } as const;
/** m between two peaks. */
export const PEAK_GAP = 1000;

type Pt = [number, number];
const metre = ([x, y]: Pt): Point => ({ x: Math.round(x / 10), y: Math.round(y / 10) });

/** 정사각 안: 0 … (n − 1)·cell on both axes (m). */
export const inSquare = (n: number, cell: number) => (p: Point) => {
  const max = (n - 1) * cell;
  return p.x >= 0 && p.x <= max && p.y >= 0 && p.y <= max;
};

/** Named nodes passing `test`, in snapshot order, with their 1 m point. */
const namedNodes = (snap: Snapshot, test: (e: OsmElement) => boolean) =>
  snap.osm.filter((e) => e.type === 'node' && e.tags.name && e.pts?.length && test(e)).map((e) => ({ e, name: e.tags.name!, p: metre(e.pts![0]!) }));

export function villagesOf(snap: Snapshot, n: number, cell: number): Village[] {
  const inside = inSquare(n, cell);
  return namedNodes(snap, (e) => RADIUS.has(e.tags.place ?? ''))
    .filter(({ p }) => inside(p))
    .map(({ e, name, p }) => ({ name, x: p.x, y: p.y, r: RADIUS.get(e.tags.place!)! }));
}

/** The point at half the length of a 0.1 m line. */
function half(pts: Pt[]): Pt {
  let rest = lineLength(pts.map(([x, y]) => ({ x, y }))) / 2;
  for (let s = 1; s < pts.length; s++) {
    const [[x0, y0], [x1, y1]] = [pts[s - 1]!, pts[s]!];
    const len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    if (len >= rest && len > 0) return [x0 + ((x1 - x0) * rest) / len, y0 + ((y1 - y0) * rest) / len];
    rest -= len;
  }
  return pts[pts.length - 1]!;
}

/** Shoelace area of a ring (0.1 m units squared). */
function area(pts: Pt[]): number {
  let sum = 0;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) sum += (pts[b]![0] - pts[a]![0]) * (pts[b]![1] + pts[a]![1]);
  return Math.abs(sum) / 2;
}

/** 지명: water (rivers by length inside the square, then reservoirs by area, each name once), peaks by ground height
 *  at the nearest node at least PEAK_GAP from those picked, passes by height. Array order water → peak → pass. */
export function namesOf(snap: Snapshot, groundTenths: Int32Array, n: number, cell: number): PlaceName[] {
  const inside = inSquare(n, cell);
  const max = (n - 1) * cell * 10;
  const ways = snap.osm.filter((e) => e.type === 'way' && e.tags.name && e.pts?.length);

  const rivers = new Map<string, { length: number; best: number; longest: Pt[] }>();
  for (const e of ways.filter((e) => e.tags.waterway === 'river'))
    for (const piece of clip(e.pts!, max)) {
      const len = lineLength(piece.map(([x, y]) => ({ x, y })));
      const r = rivers.get(e.tags.name!) ?? { length: 0, best: -1, longest: piece };
      r.length += len;
      if (len > r.best) [r.best, r.longest] = [len, piece];
      rivers.set(e.tags.name!, r);
    }
  const reservoirs = ways
    .filter((e) => e.tags.natural === 'water')
    .map((e) => {
      const [x0, y0, x1, y1] = box(e.pts!);
      return { name: e.tags.name!, area: area(e.pts!), at: [(x0 + x1) / 2, (y0 + y1) / 2] as Pt };
    })
    .sort((a, b) => b.area - a.area);
  const water: { name: string; p: Point }[] = [];
  const seen = new Set<string>();
  const candidates = [
    ...[...rivers].sort((a, b) => b[1].length - a[1].length).map(([name, r]) => ({ name, at: half(r.longest) })),
    ...reservoirs,
  ];
  for (const { name, at } of candidates) {
    const p = metre(at);
    if (water.length < NAME_CAP.water && !seen.has(name) && inside(p)) {
      seen.add(name);
      water.push({ name, p });
    }
  }

  const byHeight = (test: (e: OsmElement) => boolean) =>
    namedNodes(snap, test)
      .filter(({ p }) => inside(p))
      .map(({ name, p }) => ({ name, p, h: groundTenths[Math.round(p.y / cell) * n + Math.round(p.x / cell)]! }))
      .sort((a, b) => b.h - a.h);
  const peaks: { name: string; p: Point }[] = [];
  for (const c of byHeight((e) => e.tags.natural === 'peak'))
    if (peaks.length < NAME_CAP.peak && peaks.every(({ p }) => gap2(p, c.p) >= PEAK_GAP * PEAK_GAP)) peaks.push(c);
  const passes = byHeight((e) => e.tags.mountain_pass === 'yes').slice(0, NAME_CAP.pass);

  const out = (kind: PlaceName['kind']) => ({ name, p }: { name: string; p: Point }): PlaceName => ({ name, x: p.x, y: p.y, kind });
  return [...water.map(out('water')), ...peaks.map(out('peak')), ...passes.map(out('pass'))];
}

/** Squared distance (m²). */
export const gap2 = (a: Point, b: Point): number => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
