// The 가공 seam (npm run terrain:build) on synthetic input: the cover table and overwrite order, clearings, the stop
// list and the 지형 판 규칙. Results are read back through the app's unpackTerrain, never from 가공's own arrays.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { COVER, type Cover } from '@sim';
import { bodyStart, unpackTerrain } from '@adapters/terrainFile/unpack';
import { readConfig, type Config } from '../../terrain/pipeline/config';
import { buildAndWrite, checkFile, text } from '../../terrain/pipeline/build/build';
import { buildTerrain, checkInvariants } from '../../terrain/pipeline/rules/build';
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

const fresh = () => ({ data: mkdtempSync(join(tmpdir(), 'terrain-data-')), source: mkdtempSync(join(tmpdir(), 'terrain-source-')) });
type Dirs = ReturnType<typeof fresh>;
/** Every file in both folders with its bytes, so "nothing written" is checked byte for byte. */
const contents = (d: Dirs) =>
  [d.data, d.source].flatMap((dir) => readdirSync(dir).sort().map((f) => [join(dir, f), readFileSync(join(dir, f)).toString('base64')]));

/** Runs 가공 into fresh folders, expects it to stop with `message`, and both folders to stay empty. */
async function expectStop(cfg: Config, snap: Snapshot, message: RegExp) {
  const dirs = fresh();
  await expect(buildAndWrite(dirs, 'synth', cfg, snap)).rejects.toThrow(message);
  expect(contents(dirs)).toEqual([]);
}

/** Integer hash in [0, 1), for noise no gzip can shrink. */
const noise = (i: number, j: number) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

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

  test('가공: 벌채지는 숲 칸만 바꾼다', async () => {
    // A 40 m circle on node (12, 12) over forest, a road row, a building, water, a village and a field cell.
    const osm = [
      way({ highway: 'residential' }, [[1000, 1400], [1400, 1400]]), // nodes (10..14, 14)
      way({ building: 'yes' }, tiny(13, 13)),
      way({ natural: 'water' }, ring(1050, 1050, 1150, 1150)), // node (11, 11)
    ];
    const cfg = { ...SYNTH, clearings: [{ x: 120, y: 120, r: 40, kind: 'planned' as const }] };
    const snap = snapshot(osm, 10, [[12, 10, 50], [10, 12, 40]]);
    const before = await unpackTerrain((await buildTerrain('synth', SYNTH, snap)).file);
    const t = await unpackTerrain((await buildTerrain('synth', cfg, snap)).file);

    let cleared = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const at = k(i, j);
        const d2 = (i - 12) * (i - 12) + (j - 12) * (j - 12);
        if (d2 <= 16 && name(before.cover[at]!) === 'forest') {
          cleared++;
          expect(name(t.cover[at]!)).toBe('open');
          expect(t.surface[at]).toBe(t.ground[at]);
        } else {
          expect(name(t.cover[at]!), `cell (${i}, ${j})`).toBe(name(before.cover[at]!));
          expect(t.surface[at]).toBe(before.surface[at]);
          expect(t.buildings[at]).toBe(before.buildings[at]);
        }
      }
    expect(cleared).toBe(49 - 5 - 4); // 49 nodes within 4 cells; road 5, building, water, village, field 4
    for (const [i, j] of [[17, 12], [12, 17], [7, 12], [12, 7]] as const) {
      expect(name(t.cover[k(i, j)]!)).toBe('forest');
      const h = t.surface[k(i, j)]! - t.ground[k(i, j)]!;
      expect(h >= 12 && h < 17, `forest height ${h}`).toBe(true);
    }
  });

  test('가공: 멈춤 목록', async () => {
    const plain = snapshot([]);
    await expectStop(SYNTH, snapshot([], 10, [[3, 4, 15]]), /^가공: 대응표에 없는 피복 값 15 \(칸 99\)$/);
    await expectStop({ ...SYNTH, grid: { ...SYNTH.grid, e0: 40000 } }, plain, /^가공: 방안 기준/);
    await expectStop({ ...SYNTH, grid: { ...SYNTH.grid, letters: 'AB' } }, plain, /^가공: 방안 기준/);
    await expectStop({ ...SYNTH, coverShare: { ...ALL, forest: [0, 50] } }, plain, /^가공: 피복 forest 비율 100%가 범위 \[0, 50\] 밖이다$/);
    await expectStop({ ...SYNTH, coverShare: null }, plain, /^가공: 피복 비율 범위가 비어 있다\. 잰 비율: \{"open":0,"field":0,"forest":100,/);
    await expectStop({ ...SYNTH, clearings: [{ x: 50, y: 50, r: 100, kind: 'reserve' }] }, snapshot([], 40), /^가공: 벌채 원 \(50, 50\)에 숲 칸이 없다$/);
    await expectStop({ ...SYNTH, sources: { ...SYNTH.sources, ground: { ...SYNTH.sources.ground, kind: 'DSM' } } }, plain, /^가공: 불변 조건: 지면의 종류가 DTM이 아니다/);
    await expectStop(SYNTH, snapshot([{ type: 'relation', id: 1, tags: { natural: 'water' }, members: [] }]), /^가공: natural=water 관계 요소는 아직 다루지 않는다$/);

    // Over 1.5 MB: 1024² cells of ground noise (±300 m) that gzip cannot shrink.
    const big = 1024;
    const ground = new Int32Array(big * big);
    for (let j = 0; j < big; j++) for (let i = 0; i < big; i++) ground[j * big + i] = Math.round(50000 + (noise(i, j) - 0.5) * 60000);
    const noisy: Snapshot = { ...plain, ground, cover: new Uint8Array(big * big).fill(10) };
    await expectStop({ ...SYNTH, frame: { ...SYNTH.frame, n: big } }, noisy, /^가공: 지형 파일이 1\.5 MB를 넘는다 \(\d+ bytes\)$/);

    // Same 판, other content: the committed files stay byte for byte.
    const dirs = fresh();
    await buildAndWrite(dirs, 'synth', SYNTH, plain);
    const before = contents(dirs);
    const changed = snapshot([]);
    changed.ground[k(7, 7)]! += 100;
    await expect(buildAndWrite(dirs, 'synth', SYNTH, changed)).rejects.toThrow(/^가공: 판이 같은데 내용이 다르다\. 가공 설정의 version을 올린다$/);
    expect(contents(dirs)).toEqual(before);

    // Not reachable through inputs: the exported checks on doctored values.
    const built = await buildTerrain('synth', SYNTH, plain);
    const body = gunzipSync(built.file);
    const L = body.readUInt32LE(0);
    const head = JSON.parse(body.subarray(4, 4 + L).toString('utf8'));
    const json = Buffer.from(JSON.stringify({ ...head, frame: SYNTH.frame }));
    const doctored = Buffer.alloc(bodyStart(json.length) + body.length - bodyStart(L), 0x20);
    doctored.writeUInt32LE(json.length, 0);
    json.copy(doctored, 4);
    body.copy(doctored, bodyStart(json.length), bodyStart(L));
    expect(() => checkFile(gzipSync(doctored))).toThrow(/^가공: 지형 파일 머리의 키가 허용 목록과 다르다/);
    expect(() => checkFile(built.file)).not.toThrow();

    const t = await unpackTerrain(built.file);
    expect(() => checkInvariants(t, built.header)).not.toThrow();
    const sunk = { ...t, surface: t.surface.slice() };
    sunk.surface[5] = sunk.ground[5]! - 1;
    expect(() => checkInvariants(sunk, built.header)).toThrow(/^가공: 불변 조건: 표면이 지면보다 낮다 \(칸 5\)$/);
    const nan = { ...t, ground: t.ground.slice() };
    nan.ground[6] = NaN;
    expect(() => checkInvariants(nan, built.header)).toThrow(/^가공: 불변 조건: 유한하지 않은 값 \(칸 6\)$/);
    const counts = { ...built.header, coverCounts: { ...built.header.coverCounts, forest: 1 } };
    expect(() => checkInvariants(t, counts)).toThrow(/^가공: 불변 조건: 머리의 피복 칸 수가 실제와 다르다$/);
  }, 30_000);

  test('가공: 지형 판 규칙', async () => {
    const plain = snapshot([]);
    const other = snapshot([]);
    other.ground[k(7, 7)]! += 100;
    const v = (version: number) => ({ ...SYNTH, version });
    const dirs = fresh();
    const bin = join(dirs.source, 'terrain.bin');
    const head = join(dirs.data, 'header.json');
    const rejects = async (cfg: Config, snap: Snapshot, message: RegExp) => {
      const before = contents(dirs);
      await expect(buildAndWrite(dirs, 'synth', cfg, snap)).rejects.toThrow(message);
      expect(contents(dirs)).toEqual(before);
    };

    // No committed 기대값: all four are written.
    const first = await buildAndWrite(dirs, 'synth', v(1), plain);
    expect([readdirSync(dirs.data).sort(), readdirSync(dirs.source).sort()]).toEqual([['header.json', 'log.json'], ['expected.json', 'terrain.bin']]);
    expect(readFileSync(bin)).toEqual(Buffer.from(first.file));

    // Same 판, same content: the file is the canon and is not rewritten even when its gzip bytes differ; the rest is.
    const level1 = gzipSync(gunzipSync(first.file), { level: 1 });
    writeFileSync(bin, level1);
    writeFileSync(head, '{}\n');
    await buildAndWrite(dirs, 'synth', v(1), plain);
    expect(readFileSync(bin)).toEqual(level1);
    expect(readFileSync(head, 'utf8')).toBe(text(first.header));

    // Same 판, other content; 판 + 2; 판 − 1: rejected, nothing changes.
    await rejects(v(1), other, /^가공: 판이 같은데 내용이 다르다/);
    await rejects(v(3), other, /^가공: 지형 판 규칙: 커밋된 판 1에서 3로 갈 수 없다$/);

    // 판 + 1: all four are written again.
    const second = await buildAndWrite(dirs, 'synth', v(2), other);
    expect(readFileSync(bin)).toEqual(Buffer.from(second.file));
    expect(JSON.parse(readFileSync(join(dirs.source, 'expected.json'), 'utf8'))).toEqual({ id: 'synth', version: 2, hash: second.expected.hash });
    expect(second.expected.hash).not.toBe(first.expected.hash);
    expect(readFileSync(head, 'utf8')).toBe(text(second.header));
    expect(readFileSync(join(dirs.data, 'log.json'), 'utf8')).toBe(text(second.log));
    await rejects(v(1), plain, /^가공: 지형 판 규칙: 커밋된 판 2에서 1로 갈 수 없다$/);

    // A 기대값 without its 지형 파일.
    rmSync(bin);
    await rejects(v(3), plain, /^가공: 지형 기대값은 있는데 지형 파일이 없다$/);
  });

  test('가공: 가공 기록의 모양', async () => {
    const osm = [way({ highway: 'secondary' }, [[0, 600], [2300, 600]]), way({ building: 'yes' }, tiny(3, 3)), way({ natural: 'water' }, ring(150, 1050, 450, 1350))];
    const cfg = { ...SYNTH, clearings: [{ x: 150, y: 150, r: 30, kind: 'planned' as const }] };
    const { log, header } = await buildTerrain('synth', cfg, snapshot(osm, 10, [[0, 0, 40], [1, 0, 50], [2, 0, 30]]));
    const keys = (o: object) => Object.keys(o);
    const COVERS = ['open', 'field', 'forest', 'water', 'road', 'village', 'building'];

    expect(keys(log)).toEqual(['input', 'cover', 'ground', 'buildings', 'size']);
    expect(keys(log.input)).toEqual(['snapshot', 'osmBase', 'rules']);
    expect(keys(log.input.snapshot)).toEqual(['ground.bin', 'cover.bin', 'osm.json']);
    expect(keys(log.cover)).toEqual(['worldcover', 'overwritten', 'final']);
    expect(log.cover.worldcover.map((w) => keys(w))).toEqual(Array(11).fill(['value', 'cells']));
    expect(log.cover.worldcover.map((w) => w.value)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]);
    expect(keys(log.cover.overwritten)).toEqual(['water', 'road', 'building', 'clearing']);
    expect(keys(log.cover.final)).toEqual(COVERS);
    for (const name of COVERS) expect(keys(log.cover.final[name as Cover])).toEqual(['cells', 'share']);
    expect(keys(log.ground)).toEqual(['min', 'max', 'mean']);
    expect(keys(log.buildings)).toEqual(['count', 'height', 'discarded']);
    expect(keys(log.buildings.height)).toEqual(['tag', 'levels', 'default']);
    expect(keys(log.size)).toEqual(['body', 'header']);
    expect(keys(header)).toEqual(['id', 'version', 'hash', 'rules', 'ground', 'cover', 'vectors', 'forest', 'coverCounts', 'frame', 'clearings', 'credits', 'snapshot']);
    expect(keys(header.ground)).toEqual(['name', 'version', 'kind', 'vertical', 'subtracted', 'scale']);
    expect(keys(header.coverCounts)).toEqual(COVERS);

    // Worked by hand: water nodes 2..4 × 11..13; road row 6; one building; the 30 m circle on node (15, 15) holds 29 nodes.
    // Ground: 100.0 m at (0, 0), 120.7 m at (23, 23), mean of the rounded values 110.3549 m.
    expect(log.cover.worldcover.filter((w) => w.cells)).toEqual([{ value: 10, cells: N * N - 3 }, { value: 30, cells: 1 }, { value: 40, cells: 1 }, { value: 50, cells: 1 }]);
    expect(log.cover.overwritten).toEqual({ water: 9, road: 24, building: 1, clearing: 29 });
    expect(log.ground).toEqual({ min: 100, max: 120.7, mean: 110.35 });
    expect(log.buildings).toEqual({ count: 1, height: { tag: 0, levels: 0, default: 1 }, discarded: [] });

    const shares = COVERS.reduce((sum, name) => sum + log.cover.final[name as Cover].share, 0);
    expect(Math.abs(shares - 100)).toBeLessThanOrEqual(0.05);
    const written = text({ ...log, input: { ...log.input, osmBase: '' } });
    expect(written).not.toMatch(/\d{4}-\d\d-\d\dT/);
    expect(written).not.toMatch(/gzip|mtime|time/i);
  });
});
