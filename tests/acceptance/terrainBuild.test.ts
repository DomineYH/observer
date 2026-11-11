// The 가공 seam (npm run terrain:build) on synthetic input: the cover table and overwrite order, clearings, the stop
// list and the 지형 판 규칙. Results are read back through the app's unpackTerrain, never from 가공's own arrays.
import { describe, expect, test } from 'vitest';
import { COVER, type Cover } from '@sim';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { readConfig, type Config } from '../../terrain/pipeline/config';
import { buildTerrain } from '../../terrain/pipeline/rules/build';
import type { OsmElement, Snapshot } from '../../terrain/pipeline/snapshot';

// A made-up 24×24 square (no real place). Its 1 km remainders (230, 490) match the grid origin's.
const N = 24;
const U = 100; // one cell in the snapshot's 0.1 m units
const ALL: Record<Cover, [number, number]> = { open: [0, 100], field: [0, 100], forest: [0, 100], water: [0, 100], road: [0, 100], village: [0, 100], building: [0, 100] };
const SYNTH: Config = {
  ...readConfig('terrain/mungyeong'),
  coverShare: ALL,
  grid: { letters: 'CH', e0: 40230, n0: 30490 },
  frame: { proj: '+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs', x0: 500230, y0: 4000490, n: N, cell: 10 },
  clearings: [],
};

const k = (i: number, j: number) => j * N + i;
const groundOf = (i: number, j: number) => 10000 + 37 * i + 53 * j; // 0.01 m, never on a 0.1 m rounding tie

/** A snapshot whose WorldCover is `fill` everywhere except `cells`, plus the given OpenStreetMap elements. */
function snapshot(osm: OsmElement[], fill = 10, cells: [number, number, number][] = []): Snapshot {
  const ground = new Int32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) ground[k(i, j)] = groundOf(i, j);
  const cover = new Uint8Array(N * N).fill(fill);
  for (const [i, j, v] of cells) cover[k(i, j)] = v;
  return { ground, cover, osm, sha256: { 'ground.bin': 'g', 'cover.bin': 'c', 'osm.json': 'o' }, osmBase: '2026-11-01T12:00:00Z' };
}

let nextId = 1;
const way = (tags: Record<string, string>, pts: [number, number][]): OsmElement => ({ type: 'way', id: nextId++, tags, pts });
/** A closed ring around (x0, y0)–(x1, y1) in 0.1 m. */
const ring = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
/** A footprint smaller than a cell beside node (i, j), with no node inside. */
const tiny = (i: number, j: number) => ring(i * U + 10, j * U + 10, i * U + 40, j * U + 40);

const name = (c: number) => COVER[c];

describe('가공', () => {
  test('가공: 대응표와 덮어쓰기 순서', async () => {
    const TABLE: [number, Cover][] = [
      [10, 'forest'], [20, 'open'], [30, 'open'], [40, 'field'], [50, 'village'], [60, 'open'],
      [70, 'open'], [80, 'water'], [90, 'open'], [95, 'forest'], [100, 'open'],
    ];
    const osm = [
      way({ natural: 'water' }, ring(150, 350, 650, 850)), // nodes i 2..6, j 4..8
      way({ highway: 'tertiary' }, [[0, 600], [2300, 600]]), // row j 6
      way({ building: 'yes', height: '7.5' }, ring(450, 550, 550, 650)), // node (5, 6): forest + water + road + building
      way({ waterway: 'river' }, [[1500, 200], [1500, 2000]]), // column i 15, j 2..20
      way({ highway: 'primary', tunnel: 'yes' }, [[0, 1200], [2300, 1200]]),
      way({ highway: 'track' }, [[0, 1400], [2300, 1400]]),
      way({ building: 'house', 'building:levels': '2' }, tiny(20, 20)),
      way({ building: 'yes', height: '0' }, tiny(20, 2)),
      way({ building: 'yes', height: 'abc' }, tiny(20, 4)),
      way({ building: 'yes', height: '150' }, tiny(20, 8)),
    ];
    const snap = snapshot(osm, 10, TABLE.map(([v], i) => [i, 0, v]));
    const built = await buildTerrain('synth', SYNTH, snap);
    const t = await unpackTerrain(built.file);

    TABLE.forEach(([, cover], i) => expect(name(t.cover[k(i, 0)]!), `WorldCover column ${i}`).toBe(cover));
    expect(name(t.cover[k(5, 6)]!)).toBe('building');
    expect(name(t.cover[k(3, 6)]!)).toBe('road'); // road over water
    expect(name(t.cover[k(3, 5)]!)).toBe('water'); // water over forest
    for (const j of [10, 11]) expect([14, 15, 16].map((i) => name(t.cover[k(i, j)]!))).toEqual(['forest', 'water', 'forest']);
    const roads = [...t.cover].map((c, at) => (name(c) === 'road' ? at : -1)).filter((at) => at >= 0);
    expect(roads).toEqual([...Array(N).keys()].filter((i) => i !== 5).map((i) => k(i, 6))); // no tunnel, no track

    const heights: [number, number, number][] = [[5, 6, 7.5], [20, 20, 7.5], [20, 2, 6], [20, 4, 6], [20, 8, 6]];
    const buildingCells = [...t.cover].filter((c) => name(c) === 'building').length;
    expect(buildingCells).toBe(heights.length); // each tiny footprint takes exactly one cell
    for (const [i, j, h] of heights) {
      expect(name(t.cover[k(i, j)]!)).toBe('building');
      expect(t.buildings[k(i, j)]).toBeCloseTo(h, 5);
      expect(t.surface[k(i, j)]! - t.ground[k(i, j)]!).toBeCloseTo(h, 3);
    }
    expect(built.log.buildings.discarded).toEqual([
      { id: osm[7]!.id, tag: 'height', value: '0' },
      { id: osm[8]!.id, tag: 'height', value: 'abc' },
      { id: osm[9]!.id, tag: 'height', value: '150' },
    ]);
    expect(built.log.buildings.height).toEqual({ tag: 1, levels: 1, default: 3 });
    // 1판 has no road lines, villages or names (M2-6 replaces this line).
    expect([t.roads, t.villages, t.names]).toEqual([[], [], []]);
  });
});
