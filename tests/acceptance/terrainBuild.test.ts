// The 가공 seam (npm run terrain:build) on synthetic input: the cover table and overwrite order, clearings, the stop
// list and the 지형 판 규칙. Results are read back through the app's unpackTerrain, never from 가공's own arrays.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { COVER, terrainHash, type Cover } from '@sim';
import { bodyStart, unpackTerrain } from '@adapters/terrainFile/unpack';
import { readConfig, type Config } from '../../terrain/pipeline/config';
import { buildAndWrite, checkFile, text } from '../../terrain/pipeline/build/build';
import { buildTerrain, checkInvariants } from '../../terrain/pipeline/rules/build';
import { readSnapshot, sha256, type OsmElement, type Snapshot } from '../../terrain/pipeline/snapshot';

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
    // The tertiary way is the one road line (the tunnel and the track give none); no places, no names.
    expect(t.roads).toEqual([{ class: 'main', line: [{ x: 0, y: 60 }, { x: 230, y: 60 }] }]);
    expect([t.villages, t.names]).toEqual([[], []]);
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

    expect(keys(log)).toEqual(['input', 'cover', 'ground', 'buildings', 'roads', 'names', 'size']);
    expect(keys(log.names)).toEqual(['villages', 'water', 'peak', 'pass']);
    expect(keys(log.roads)).toEqual(['elements', 'tunnels', 'pieces', 'lines']);
    expect(keys(log.roads.elements)).toEqual(['trunk', 'main', 'local']);
    expect(keys(log.roads.lines)).toEqual(['trunk', 'main', 'local']);
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
    expect(log.roads).toEqual({ elements: { trunk: 0, main: 1, local: 0 }, tunnels: 0, pieces: 1, lines: { trunk: 0, main: 1, local: 0 } });
    expect(log.names).toEqual({ villages: 0, water: 0, peak: 0, pass: 0 });

    const shares = COVERS.reduce((sum, name) => sum + log.cover.final[name as Cover].share, 0);
    expect(Math.abs(shares - 100)).toBeLessThanOrEqual(0.05);
    const written = text({ ...log, input: { ...log.input, osmBase: '' } });
    expect(written).not.toMatch(/\d{4}-\d\d-\d\dT/);
    expect(written).not.toMatch(/gzip|mtime|time/i);
  });

  test('가공: 방안 기준과 정사각', async () => {
    const plain = snapshot([]);
    const at = (e0: number, n0: number) => ({ ...SYNTH, grid: { letters: 'CH', e0, n0 } });
    // A wrong origin: another 1 km square, or the right square with another 1 km remainder than the real position's.
    for (const [e0, n0] of [[41230, 30490], [40230, 31490], [40330, 30490], [40230, 30590], [40230.5, 30490]])
      await expectStop(at(e0!, n0!), plain, /^가공: 방안 기준/);
    // The square stays inside one 100 km square: east 40230 + 24 · 2490 m = 99990 builds, 24 · 2491 m = 100014 stops.
    const cell = (c: number) => ({ ...SYNTH, frame: { ...SYNTH.frame, cell: c } });
    await expect(buildTerrain('synth', cell(2490), plain)).resolves.toBeDefined();
    await expectStop(cell(2491), plain, /^가공: 정사각이 100 km 방안 하나를 넘는다 \(동 40230–100014, 북 30490–90274\)$/);
  });

  test('가공: 피복 스냅샷의 길이', async () => {
    // A short cover.bin must not leave its missing cells as open land; a long one must not be cut.
    for (const len of [N * N - 1, N * N + 1])
      await expectStop(SYNTH, { ...snapshot([]), cover: new Uint8Array(len).fill(10) }, new RegExp(`^가공: cover\\.bin 길이 ${len} ≠ ${N * N}$`));
  });

  test('가공: 도로 등급과 그 밖의 선', async () => {
    const graded = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'].flatMap((g) => [g, `${g}_link`]);
    const left: Record<string, string>[] = [{ highway: 'primary', tunnel: 'yes' }, { highway: 'track' }, { highway: 'path' }, { highway: 'service' }, { waterway: 'stream' }];
    const row = (j: number): [number, number][] => [[0, j * U], [(N - 1) * U, j * U]];
    const osm = [...graded.map((h, j) => way({ highway: h }, row(j))), ...left.map((tags, j) => way(tags, row(graded.length + j)))];
    const t = await unpackTerrain((await buildTerrain('synth', SYNTH, snapshot(osm))).file);
    const coverOf = (j: number) => [...Array(N).keys()].map((i) => name(t.cover[k(i, j)]!));
    graded.forEach((h, j) => expect(coverOf(j), h).toEqual(Array(N).fill('road')));
    left.forEach((tags, j) => expect(coverOf(graded.length + j), JSON.stringify(tags)).toEqual(Array(N).fill('forest')));
  });

  test('가공: 도로선 자르기·잇기·순서', async () => {
    // Way points in 0.1 m; road lines come back in whole metres. The square is 0 … 230 m on both axes.
    const linesOf = async (osm: OsmElement[]) => {
      const built = await buildTerrain('synth', SYNTH, snapshot(osm));
      return { built, t: await unpackTerrain(built.file) };
    };
    const line = (...pts: [number, number][]) => pts.map(([x, y]) => ({ x, y }));
    const m = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [x * 10, y * 10]);

    // Grades: each value alone on its own row, 50 m long, so one grade's lines are ordered by their y.
    const graded = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'].flatMap((g) => [g, `${g}_link`]);
    const left: Record<string, string>[] = [{ highway: 'primary', tunnel: 'yes' }, { highway: 'track' }, { highway: 'path' }, { highway: 'service' }];
    const row = (j: number) => m([[0, j * 10], [50, j * 10]]);
    const grades = await linesOf([...graded.map((h, j) => way({ highway: h }, row(j))), ...left.map((tags, j) => way(tags, row(graded.length + j)))]);
    const GRADE = ['trunk', 'trunk', 'trunk', 'trunk', 'trunk', 'trunk', 'main', 'main', 'main', 'main', 'local', 'local', 'local', 'local'];
    expect(grades.t.roads).toEqual(GRADE.map((c, j) => ({ class: c, line: line([0, j * 10], [50, j * 10]) })));
    expect(grades.built.log.roads).toEqual({ elements: { trunk: 6, main: 4, local: 4 }, tunnels: 1, pieces: 14, lines: { trunk: 6, main: 4, local: 4 } });

    // Cut on the square's edge: across it; out through the north edge and back; wholly outside.
    const cut = await linesOf([
      way({ highway: 'secondary' }, m([[-100, 100], [100, 200], [300, 200]])), // enters the west edge at y 150, leaves the east
      way({ highway: 'secondary' }, m([[100, 50], [100, 260], [140, 260], [140, 50]])),
      way({ highway: 'secondary' }, m([[-50, -50], [-10, -10]])),
    ]);
    expect(cut.t.roads).toEqual([
      { class: 'main', line: line([0, 150], [100, 200], [230, 200]) }, // 241.8 m
      { class: 'main', line: line([100, 50], [100, 230]) }, // 180 m, x 100 before x 140
      { class: 'main', line: line([140, 50], [140, 230]) }, // started at its south end
    ]);
    expect(cut.built.log.roads).toEqual({ elements: { trunk: 0, main: 3, local: 0 }, tunnels: 0, pieces: 3, lines: { trunk: 0, main: 3, local: 0 } });

    // Join only where exactly two ends of one grade meet; rings, merged points and short pieces.
    const joined = await linesOf([
      way({ highway: 'residential' }, m([[10, 10], [50, 10]])),
      way({ highway: 'residential' }, m([[50, 60], [50, 10]])), // → one line with the one before
      way({ highway: 'residential' }, m([[80, 100], [100, 100]])), // three ends at (100, 100): three lines
      way({ highway: 'residential' }, m([[120, 100], [100, 100]])),
      way({ highway: 'residential' }, m([[100, 130], [100, 100]])),
      way({ highway: 'tertiary' }, m([[150, 10], [170, 10]])), // a main end and a local end: two lines
      way({ highway: 'unclassified' }, m([[170, 10], [190, 10]])),
      way({ highway: 'secondary' }, m([[150, 50], [170, 50]])), // two main ends and a local end: the mains join
      way({ highway: 'secondary_link' }, m([[170, 50], [170, 80]])),
      way({ highway: 'residential_link' }, m([[170, 50], [190, 50]])),
      way({ highway: 'residential' }, m([[200, 200], [220, 200], [220, 220], [200, 220], [200, 200]])), // closed ring
      way({ highway: 'residential' }, [[1500, 300], [1503, 300], [1800, 300]]), // points 0.3 m apart merge
      way({ highway: 'residential' }, [[2000, 1500], [2020, 1500]]), // a 2 m piece is kept
    ]);
    expect(joined.t.roads).toEqual([
      { class: 'main', line: line([150, 50], [170, 50], [170, 80]) },
      { class: 'main', line: line([150, 10], [170, 10]) },
      { class: 'local', line: line([10, 10], [50, 10], [50, 60]) }, // 90 m
      { class: 'local', line: line([200, 200], [220, 200], [220, 220], [200, 220], [200, 200]) }, // 80 m
      { class: 'local', line: line([150, 30], [180, 30]) }, // 30 m, y 30
      { class: 'local', line: line([100, 100], [100, 130]) }, // 30 m, y 100
      { class: 'local', line: line([170, 10], [190, 10]) }, // 20 m, y 10
      { class: 'local', line: line([170, 50], [190, 50]) }, // 20 m, y 50
      { class: 'local', line: line([80, 100], [100, 100]) }, // 20 m, y 100, x 80: the west end first
      { class: 'local', line: line([100, 100], [120, 100]) }, // 20 m, y 100, x 100
      { class: 'local', line: line([200, 150], [202, 150]) }, // 2 m
    ]);
    expect(joined.built.log.roads).toEqual({ elements: { trunk: 0, main: 3, local: 10 }, tunnels: 0, pieces: 13, lines: { trunk: 0, main: 2, local: 9 } });

    // Not reachable through inputs: the exported checks on doctored lines.
    const { t, built } = joined;
    const fails = (roads: typeof t.roads, what: string) =>
      expect(() => checkInvariants({ ...t, roads }, built.header), what).toThrow(/^가공: 불변 조건: 도로선/);
    expect(() => checkInvariants(t, built.header)).not.toThrow();
    const [a, b, ...rest] = t.roads;
    fails([{ ...a!, line: [a!.line[0]!] }, b!, ...rest], 'one point');
    fails([a!, b!, ...rest, { class: 'local', line: line([1, 0], [1, 231]) }], 'outside');
    fails([b!, a!, ...rest], 'swapped');
    fails([{ ...a!, line: [...a!.line].reverse() }, b!, ...rest], 'reversed');
  });

  test('가공: 마을과 지명 고르기', async () => {
    // 100 m cells: the square is 0 … 2300 m, wide enough for the 1 km gap between peaks. Points in metres, ×10 for the snapshot.
    const cfg = { ...SYNTH, frame: { ...SYNTH.frame, cell: 100 } };
    const node = (tags: Record<string, string>, x: number, y: number): OsmElement => ({ type: 'node', id: nextId++, tags, pts: [[x * 10, y * 10]] });
    const m = (pts: [number, number][]): [number, number][] => pts.map(([x, y]) => [x * 10, y * 10]);
    const peak = (name: string, x: number, y: number) => node({ natural: 'peak', name }, x, y);
    const pass = (name: string, x: number, y: number) => node({ mountain_pass: 'yes', name }, x, y);
    const osm = [
      node({ place: 'town', name: '읍' }, 500, 2000),
      node({ place: 'village', name: '리' }, 1500, 2000),
      { type: 'node', id: nextId++, tags: { place: 'hamlet', name: '말' }, pts: [[18004, 21006]] } as OsmElement, // → (1800, 2101)
      node({ place: 'village' }, 600, 600), // no name
      node({ place: 'village', name: '밖' }, -50, 100), // outside
      node({ place: 'city', name: '시' }, 700, 700),
      // Peaks in snapshot order against height order. 나봉 is 500 m from 가봉 and lower; 사봉 is exactly 1 km from 가봉.
      peak('차봉', 1000, 2000), peak('자봉', 2000, 1000), peak('아봉', 0, 1000), peak('사봉', 1000, 0), peak('바봉', 2000, 2000),
      peak('마봉', 0, 2000), peak('라봉', 2000, 0), peak('다봉', 0, 0), peak('나봉', 1000, 1500),
      { type: 'node', id: nextId++, tags: { natural: 'peak', name: '가봉' }, pts: [[10004, 9996]] } as OsmElement, // → (1000, 1000)
      node({ natural: 'peak' }, 1500, 500), // no name
      peak('밖봉', 2400, 0), // outside
      pass('바재', 800, 300), pass('가재', 300, 300), pass('마재', 700, 300), pass('나재', 400, 300), pass('라재', 600, 300), pass('다재', 500, 300),
      // Water: 가천 in two ways (1700 m) before the longer single way 나강 (1200 m); 다강 counts only its 100 m inside.
      way({ waterway: 'river', name: '가천' }, m([[0, 500], [1000, 500]])),
      way({ waterway: 'river', name: '가천' }, m([[1000, 500], [1000, 1200]])),
      way({ waterway: 'river', name: '나강' }, m([[100, 1500], [1300, 1500]])),
      way({ waterway: 'river', name: '다강' }, m([[2000, 2200], [2000, 3000]])),
      way({ waterway: 'river' }, m([[100, 100], [2000, 100]])), // no name
      way({ natural: 'water', water: 'reservoir', name: '라저수지' }, m(ring(300, 600, 500, 800))), // 0.04 km²
      way({ natural: 'water', water: 'reservoir', name: '마저수지' }, m(ring(1500, 300, 1900, 600))), // 0.12 km²
      way({ natural: 'water', water: 'reservoir', name: '바저수지' }, m(ring(1600, 1700, 1700, 1800))),
      way({ natural: 'water', name: '가천' }, m(ring(100, 1000, 900, 1400))), // a name already taken
    ];
    const snap = snapshot(osm);
    const HEIGHT: [number, number, number][] = [
      [10, 10, 950], [10, 15, 940], [0, 0, 930], [20, 0, 920], [0, 20, 910], [20, 20, 900], [10, 0, 890], [0, 10, 880], [20, 10, 870], [10, 20, 860],
      [15, 5, 999], [3, 3, 700], [4, 3, 690], [5, 3, 680], [6, 3, 670], [7, 3, 660], [8, 3, 650],
    ];
    for (const [i, j, h] of HEIGHT) snap.ground[k(i, j)] = h * 100;
    const built = await buildTerrain('synth', cfg, snap);
    const t = await unpackTerrain(built.file);

    expect(t.villages).toEqual([
      { name: '읍', x: 500, y: 2000, r: 330 },
      { name: '리', x: 1500, y: 2000, r: 170 },
      { name: '말', x: 1800, y: 2101, r: 110 },
    ]);
    const named = (kind: string, list: [string, number, number][]) => list.map(([name, x, y]) => ({ name, x, y, kind }));
    expect(t.names).toEqual([
      // Rivers at half their longest piece, then the largest reservoir at its box centre; 6 names → 4.
      ...named('water', [['가천', 500, 500], ['나강', 700, 1500], ['다강', 2000, 2250], ['마저수지', 1700, 450]]),
      // By ground height at the nearest node; 나봉 skipped (500 m from 가봉), 차봉 is the ninth.
      ...named('peak', [['가봉', 1000, 1000], ['다봉', 0, 0], ['라봉', 2000, 0], ['마봉', 0, 2000], ['바봉', 2000, 2000], ['사봉', 1000, 0], ['아봉', 0, 1000], ['자봉', 2000, 1000]]),
      ...named('pass', [['가재', 300, 300], ['나재', 400, 300], ['다재', 500, 300], ['라재', 600, 300]]),
    ]);
    expect(built.log.names).toEqual({ villages: 3, water: 4, peak: 8, pass: 4 });
  });

  test('가공: 지명 규칙 위반에서 멈춘다', async () => {
    // Picking keeps the caps and the gap, so no snapshot reaches these stops: the exported checks on doctored lists, as in
    // 가공: 멈춤 목록 (whose DSM case shows that a checkInvariants stop writes nothing).
    const cfg = { ...SYNTH, frame: { ...SYNTH.frame, cell: 100 } }; // square 0 … 2300 m
    const built = await buildTerrain('synth', cfg, snapshot([]));
    const t = await unpackTerrain(built.file);
    const at = (kind: 'water' | 'peak' | 'pass', x: number, y: number, name = `${kind}${x},${y}`) => ({ name, x, y, kind });
    const ok = (names: ReturnType<typeof at>[]) => expect(() => checkInvariants({ ...t, names }, built.header)).not.toThrow();
    const fails = (names: ReturnType<typeof at>[], message: RegExp) => expect(() => checkInvariants({ ...t, names }, built.header)).toThrow(message);
    const grid = [0, 1000, 2000].flatMap((x) => [0, 1000, 2000].map((y) => at('peak', x, y)));
    const row = (kind: 'water' | 'pass', count: number) => [...Array(count).keys()].map((i) => at(kind, i * 10, 50));

    ok([...row('water', 4), ...grid.slice(0, 8), ...row('pass', 4)]);
    fails(grid, /^가공: 불변 조건: 지명 peak이 8개를 넘는다 \(9\)$/);
    fails(row('pass', 5), /^가공: 불변 조건: 지명 pass이 4개를 넘는다 \(5\)$/);
    fails(row('water', 5), /^가공: 불변 조건: 지명 water이 4개를 넘는다 \(5\)$/);
    ok([at('peak', 0, 0), at('peak', 0, 1000)]);
    fails([at('peak', 0, 0), at('peak', 0, 999)], /^가공: 불변 조건: 지명 0과 1의 산이 1 km보다 가깝다$/);
    fails([at('peak', 0, 0), at('water', 500, 500)], /^가공: 불변 조건: 지명 1의 종류가 물 → 산 → 고개 순서가 아니다$/);
    fails([at('pass', 0, 0), at('peak', 500, 500)], /^가공: 불변 조건: 지명 1의 종류가 물 → 산 → 고개 순서가 아니다$/);
    ok([at('water', 2300, 2300)]);
    fails([at('water', 2301, 0)], /^가공: 불변 조건: 지명 0이 정사각 밖이다$/);
    fails([at('pass', 0, -1)], /^가공: 불변 조건: 지명 0이 정사각 밖이다$/);
    expect(() => checkInvariants({ ...t, villages: [{ name: '리', x: -1, y: 0, r: 170 }] }, built.header)).toThrow(/^가공: 불변 조건: 마을 0이 정사각 밖이다$/);
  });

  test('가공: 불변 조건 하나하나', async () => {
    const built = await buildTerrain('synth', SYNTH, snapshot([way({ building: 'yes' }, tiny(3, 3))]));
    const t = await unpackTerrain(built.file);
    const fails = (doctored: typeof t, message: RegExp, what: string) => expect(() => checkInvariants(doctored, built.header), what).toThrow(message);
    for (const layer of ['ground', 'surface', 'buildings', 'cover'] as const)
      fails({ ...t, [layer]: t[layer].slice(1) }, /^가공: 불변 조건: 층 길이가 격자 크기와 다르다$/, layer);
    for (const layer of ['surface', 'buildings'] as const) {
      const inf = { ...t, [layer]: t[layer].slice() };
      inf[layer][7] = Infinity;
      fails(inf, /^가공: 불변 조건: 유한하지 않은 값 \(칸 7\)$/, layer);
    }
    const negative = { ...t, buildings: t.buildings.slice() };
    negative.buildings[8] = -0.1;
    fails(negative, /^가공: 불변 조건: 건물 높이가 음수다 \(칸 8\)$/, 'building height');
    for (const v of [7, 255]) {
      const cover = { ...t, cover: t.cover.slice() };
      cover.cover[9] = v;
      fails(cover, new RegExp(`^가공: 불변 조건: 피복 번호 ${v} \\(칸 9\\)$`), `cover ${v}`);
    }
  });

  test('가공: 높이 태그가 없는 값이면 층수, 지면은 마디마다 0.1 m', async () => {
    const osm = [
      way({ building: 'yes', height: 'abc', 'building:levels': '2' }, tiny(4, 4)), // levels: 2 · 3 + 1.5
      way({ building: 'yes', height: '-3', 'building:levels': '1' }, tiny(6, 4)), // levels: 1 · 3 + 1.5
      way({ building: 'yes', height: '0', 'building:levels': 'x' }, tiny(8, 4)), // both fail: 6 m
    ];
    const snap = snapshot(osm);
    // Ground in 0.01 m → whole 0.1 m, node by node (no tie on .5).
    const ground: [number, number][] = [[10004, 1000], [10006, 1001], [9996, 1000], [9994, 999], [12351, 1235], [-1236, -124]];
    ground.forEach(([v], i) => (snap.ground[k(i, 1)] = v));
    const built = await buildTerrain('synth', SYNTH, snap);
    const t = await unpackTerrain(built.file);

    for (const [i, h] of [[4, 7.5], [6, 4.5], [8, 6]] as const) expect(t.buildings[k(i, 4)], `building (${i}, 4)`).toBeCloseTo(h, 5);
    expect(built.log.buildings.height).toEqual({ tag: 0, levels: 2, default: 1 });
    expect(built.log.buildings.discarded).toEqual([
      { id: osm[0]!.id, tag: 'height', value: 'abc' },
      { id: osm[1]!.id, tag: 'height', value: '-3' },
      { id: osm[2]!.id, tag: 'height', value: '0' },
      { id: osm[2]!.id, tag: 'building:levels', value: 'x' },
    ]);
    ground.forEach(([v, tenths], i) => expect(Math.round(t.ground[k(i, 1)]! * 10), `ground ${v}`).toBe(tenths));
  });

  // The committed 문경 지형 1판, read with bare readFileSync: a missing file fails, never skips.
  const DATA = 'terrain/mungyeong';
  const SOURCE = 'src/adapters/realTerrain/mungyeong';
  const committedFile = () => new Uint8Array(readFileSync(join(SOURCE, 'terrain.bin')));
  const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

  test('가공: 다시 만들어 견주기', async () => {
    const config = readConfig(DATA);
    const built = await buildTerrain('mungyeong', config, readSnapshot(join(DATA, 'snapshot'), config.frame.n));
    const file = committedFile();
    expect(gunzipSync(built.file).equals(gunzipSync(file))).toBe(true); // content, never the gzip bytes
    expect(text(built.expected)).toBe(readFileSync(join(SOURCE, 'expected.json'), 'utf8'));
    expect(text(built.header)).toBe(readFileSync(join(DATA, 'header.json'), 'utf8'));
    expect(text(built.log)).toBe(readFileSync(join(DATA, 'log.json'), 'utf8'));
    expect(built.expected.hash).toBe(terrainHash(await unpackTerrain(file)));
  }, 30_000);

  test('가공: 2판의 칸 층은 1판과 같다', async () => {
    // 1판 had no road lines, villages or names, so with those emptied the hash is 1판's: every cell layer, n, cell, grid
    // and edge are bit-identical. A later 판 that changes a cell layer on purpose replaces this literal.
    const t = await unpackTerrain(committedFile());
    expect(terrainHash({ ...t, roads: [], villages: [], names: [] })).toBe('eb93e51936a69346');
  });

  test('가공: 안내 문서의 자료 출처 문구', async () => {
    const readme = readFileSync('terrain/README.md', 'utf8');
    const lines = readme.split('\n');
    const t = await unpackTerrain(committedFile());
    for (const credit of t.credits) expect(lines, credit).toContain(credit); // a line of its own, letter for letter
    for (const command of ['npm run terrain:fetch', 'npm run terrain:build']) expect(readme).toContain(command);
    const { sources } = json(join(DATA, 'config.json'));
    for (const key of ['ground', 'cover', 'osm'])
      for (const field of ['name', 'url', 'license']) expect(readme, `${key}.${field}`).toContain(sources[key][field]);
  });

  test('가공: 지형 파일의 머리 키와 크기', () => {
    const file = committedFile();
    const body = gunzipSync(file);
    const head = JSON.parse(body.subarray(4, 4 + body.readUInt32LE(0)).toString('utf8'));
    expect(Object.keys(head)).toEqual(['format', 'id', 'version', 'n', 'cell', 'scale', 'grid', 'edge', 'credits', 'forest', 'roads', 'villages', 'names']);
    expect(head).not.toHaveProperty('frame');
    expect(file.length).toBeLessThanOrEqual(1_500_000);
  });

  test('가공: 세 파일의 정체가 같다', async () => {
    const t = await unpackTerrain(committedFile());
    const header = json(join(DATA, 'header.json'));
    const expected = json(join(SOURCE, 'expected.json'));
    const identity = { id: t.id, version: t.version, hash: terrainHash(t) };
    expect(expected).toEqual(identity); // exactly these three keys
    expect({ id: header.id, version: header.version, hash: header.hash }).toEqual(identity);
    expect(identity.id).toBe('mungyeong');
    expect(identity.version).toBe(json(join(DATA, 'config.json')).version);
  });

  test('가공: 머리의 스냅샷 SHA-256과 벌채 원 목록', () => {
    const header = json(join(DATA, 'header.json'));
    for (const f of ['ground.bin', 'cover.bin', 'osm.json']) expect(header.snapshot[f], f).toBe(sha256(readFileSync(join(DATA, 'snapshot', f))));
    const { clearings } = json(join(DATA, 'config.json'));
    expect(header.clearings).toEqual(clearings);
    expect(header.clearings).toHaveLength(3);
  });
});
