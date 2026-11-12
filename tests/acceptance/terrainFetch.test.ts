// The 받기 seam (npm run terrain:fetch): reading arithmetic on synthetic rasters, the four stops on fake sources, and
// the committed 원자료 스냅샷 read in Node. No test here touches the network.
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readConfig, type Config } from '../../terrain/pipeline/config';
import { fetchTerrain, retry, type Sources } from '../../terrain/pipeline/fetch/fetch';
import { bilinear, nearest, nodeLonLat, rasterOf, windowOf, type Box, type Geo } from '../../terrain/pipeline/fetch/sample';
import { decodeCover, decodeGround, encodeCover, encodeGround, sha256, type Manifest } from '../../terrain/pipeline/snapshot';

// 4×3, values not linear in either direction, so a wrong weight shows.
const DATA = [1, 2, 4, 8, 3, 7, 13, 21, 10, 20, 31, 45];
const geo = (point: boolean): Geo => ({ originX: 128, originY: 37, resX: 0.001, resY: -0.001, width: 4, height: 3, point });

// A made-up 3×3 square (no real place), and fake sources that answer like the real ones over its box.
const FRAME = { proj: '+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs', x0: 500000, y0: 4000000, n: 3, cell: 10 };
const SYNTH: Config = {
  ...readConfig('terrain/mungyeong'),
  frame: FRAME,
  clearings: [],
};
const NODES = nodeLonLat(FRAME);
const RES = 0.00005; // about 5 m, so every node has its own pixels

/** A point raster of constant `value` whose centres cover `box` with 4 pixels to spare, `cut` columns short in the east. */
function fakeRaster(box: Box, value: number, cut = 0) {
  const g: Geo = { originX: box[0] - 4 * RES, originY: box[3] + 4 * RES, resX: RES, resY: -RES, point: true, width: 0, height: 0 };
  g.width = Math.ceil((box[2] - box[0]) / RES) + 9 - cut;
  g.height = Math.ceil((box[3] - box[1]) / RES) + 9;
  const win = windowOf(g, box);
  const data = new Array<number>((win[2] - win[0]) * (win[3] - win[1])).fill(value);
  return { geo: g, raster: rasterOf(g, win, data, -9999) };
}

const OSM_BASE = '2026-11-01T12:00:00Z';
const at = (k: number) => ({ lat: NODES.lat[k]!, lon: NODES.lon[k]! });
const GOOD_OSM = {
  osm3s: { timestamp_osm_base: OSM_BASE },
  elements: [
    { type: 'way', id: 7, tags: { highway: 'tertiary', surface: 'asphalt' }, geometry: [at(0), at(8)] },
    { type: 'node', id: 9, ...at(4), tags: { place: 'village', name: '가', population: '10' } },
  ],
};

interface Fakes {
  ground?: number;
  hole?: boolean; // one ground pixel under node (0, 0) is nodata
  coverCut?: number;
  osm?: unknown;
  overpass?: () => Promise<unknown>;
}

function fakeSources(f: Fakes = {}): Sources {
  return {
    tools: { node: 'n', geotiff: 'g', proj4: 'p' },
    raster: async (url, box) => {
      const isGround = url === SYNTH.sources.ground.url;
      const { raster } = fakeRaster(box, isGround ? (f.ground ?? 123.456) : 30, isGround ? 0 : (f.coverCut ?? 0));
      if (isGround && f.hole) (raster.data as number[])[Math.floor(raster.row(NODES.lat[0]!)) * raster.width + Math.floor(raster.col(NODES.lon[0]!))] = -9999;
      return { raster, pixel: 'point', bytes: 1000, etag: isGround ? '"e1"' : null };
    },
    overpass: f.overpass ?? (async () => structuredClone(f.osm ?? GOOD_OSM)),
  };
}

// The committed snapshot, read with bare readFileSync: a missing file fails, never skips.
const SNAP = 'terrain/mungyeong/snapshot';
const readSnap = (file: string) => readFileSync(join(SNAP, file));
const manifest = () => JSON.parse(readSnap('manifest.json').toString('utf8')) as Manifest;
const osmLines = () => readSnap('osm.json').toString('utf8');

const fresh = () => mkdtempSync(join(tmpdir(), 'terrain-fetch-'));

/** Runs fetchTerrain on the fakes, expects it to stop with `message`, and the folder to stay empty. */
async function expectStop(f: Fakes, message: string | RegExp) {
  const dir = fresh();
  await expect(fetchTerrain(dir, SYNTH, fakeSources(f))).rejects.toThrow(message);
  expect(readdirSync(dir)).toEqual([]);
}

describe('받기', () => {
  test('받기: 합성 래스터의 이중선형과 최근접', () => {
    const full = windowOf(geo(true), [127, 36, 129, 38]);
    expect(full).toEqual([0, 0, 4, 3]); // clipped at the image edge
    const pt = rasterOf(geo(true), full, DATA, null);
    expect(pt.col(128.0015)).toBeCloseTo(1.5, 9);
    expect(pt.row(36.9995)).toBeCloseTo(0.5, 9);
    expect(bilinear(pt, 128.0015, 36.9995)).toBeCloseTo((2 + 4 + 7 + 13) / 4, 9);
    expect(bilinear(pt, 128.0012, 36.9997)).toBeCloseTo(2 * 0.8 * 0.7 + 4 * 0.2 * 0.7 + 7 * 0.8 * 0.3 + 13 * 0.2 * 0.3, 9);
    expect(nearest(pt, 128.0012, 36.9998)).toBe(2);

    const area = rasterOf(geo(false), full, DATA, null);
    expect(pt.col(128.0015) - area.col(128.0015)).toBeCloseTo(0.5, 9);
    expect(pt.row(36.9995) - area.row(36.9995)).toBeCloseTo(0.5, 9);
    expect(bilinear(area, 128.0015, 36.9985)).toBeCloseTo(7, 9);

    expect(bilinear(rasterOf(geo(true), full, DATA, 13), 128.0015, 36.9995)).toBeNaN();
    expect(bilinear(rasterOf(geo(true), full, [...DATA.slice(0, 6), NaN, ...DATA.slice(7)], null), 128.0015, 36.9995)).toBeNaN();
    expect(bilinear(pt, 128.0035, 36.9995)).toBeNaN(); // column 4 is outside
    expect(nearest(pt, 128.0042, 36.9998)).toBeUndefined(); // would wrap to the next row in a flat index
    expect(nearest(pt, 128.0012, 37.0006)).toBeUndefined();

    // A window inside the image: indexes are relative to it.
    const big: Geo = { ...geo(true), width: 100, height: 100 };
    const win = windowOf(big, [128.0103, 36.9603, 128.0197, 36.9697]);
    expect(win).toEqual([8, 28, 23, 43]);
    const inner = rasterOf(big, win, new Array(15 * 15).fill(0).map((_, k) => k), null);
    expect(nearest(inner, 128.01, 36.97)).toBe((30 - 28) * 15 + (10 - 8));
  });

  test('받기: 마디의 경위도 범위', () => {
    const { lon, lat, box } = nodeLonLat(readConfig('terrain/mungyeong').frame);
    expect(lon.length).toBe(1024 * 1024);
    expect(lat.length).toBe(1024 * 1024);
    const [w, s, e, n] = box;
    expect(w).toBeCloseTo(128.0721, 4);
    expect(s).toBeCloseTo(36.7135, 4);
    expect(e).toBeCloseTo(128.1878, 4);
    expect(n).toBeCloseTo(36.8065, 4);
  });

  test('받기: 멈춤 넷', async () => {
    // Control: good fakes write the four files.
    const dir = fresh();
    await fetchTerrain(dir, SYNTH, fakeSources());
    const snap = join(dir, 'snapshot');
    expect(readdirSync(snap).sort()).toEqual(['cover.bin', 'ground.bin', 'manifest.json', 'osm.json']);
    expect([...decodeGround(readFileSync(join(snap, 'ground.bin')), 3)]).toEqual(new Array(9).fill(12346));
    expect([...decodeCover(readFileSync(join(snap, 'cover.bin')))]).toEqual(new Array(9).fill(30));
    const osm = readFileSync(join(snap, 'osm.json'), 'utf8');
    expect(osm).toBe(
      '[\n{"type":"node","id":9,"tags":{"place":"village","name":"가"},"pts":[[100,100]]},\n' +
        '{"type":"way","id":7,"tags":{"highway":"tertiary"},"pts":[[0,0],[200,200]]}\n]\n',
    );
    const varied = Int32Array.from([0, -3000, 250000, 7, 7, -1, 2 ** 30, -(2 ** 30), 5]);
    expect(decodeGround(encodeGround(varied, 3), 3)).toEqual(varied);
    expect(decodeCover(encodeCover(Uint8Array.from([10, 20, 255])))).toEqual(Uint8Array.from([10, 20, 255]));

    // ① ground: nodata under a node, above 2,500 m, below −100 m.
    await expectStop({ hole: true }, '받기: 지면');
    await expectStop({ ground: 2600 }, '받기: 지면');
    await expectStop({ ground: -150 }, '받기: 지면');
    // ② the cover window ends before the east column.
    await expectStop({ coverCut: 6 }, '받기: 피복');
    // ③ a military feature: the message carries the count only.
    for (const tag of [{ military: 'synthetic' }, { landuse: 'military' }, { building: 'bunker' }]) {
      const el = { type: 'node', id: 424242, lat: 36.123456, lon: 127.654321, tags: { ...tag, name: 'SYNTHETIC-NAME' } };
      const dir3 = fresh();
      const err: unknown = await fetchTerrain(dir3, SYNTH, fakeSources({ osm: { ...GOOD_OSM, elements: [...GOOD_OSM.elements, el] } })).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('받기: 군사 지물 1개. 멈춘다. 사람이 본다');
      expect(Object.keys(err as Error)).toEqual([]);
      expect((err as Error).cause).toBeUndefined();
      expect(readdirSync(dir3)).toEqual([]);
    }
    // ④ no OpenStreetMap base time.
    await expectStop({ osm: { elements: GOOD_OSM.elements } }, '받기: 응답에 OpenStreetMap 기준 시각이 없다');
  });

  test('받기: 끊기면 재시도하고 끝내 안 되면 쓰지 않는다', async () => {
    let calls = 0;
    const flaky = async () => (++calls < 3 ? Promise.reject(new Error(`fail ${calls}`)) : 'ok');
    expect(await retry(flaky, [0, 0, 0])).toBe('ok');
    expect(calls).toBe(3);
    calls = 0;
    const down = async () => Promise.reject(new Error(`fail ${++calls}`));
    await expect(retry(down, [0, 0, 0])).rejects.toThrow('fail 4');
    expect(calls).toBe(4);
    await expectStop({ overpass: async () => Promise.reject(new Error('받기: Overpass에 닿지 못했다')) }, '받기: Overpass에 닿지 못했다');
  });

  test('받기: 스냅샷의 SHA-256이 목록과 같다', () => {
    expect(readdirSync(SNAP).sort()).toEqual(['cover.bin', 'ground.bin', 'manifest.json', 'osm.json']);
    const m = manifest();
    expect(sha256(readSnap('ground.bin'))).toBe(m.sources.ground.sha256);
    expect(sha256(readSnap('cover.bin'))).toBe(m.sources.cover.sha256);
    expect(sha256(readSnap('osm.json'))).toBe(m.sources.osm.sha256);
    expect([m.sources.ground.file, m.sources.cover.file, m.sources.osm.file]).toEqual(['ground.bin', 'cover.bin', 'osm.json']);
  });

  test('받기: 스냅샷에 군사 지물 태그가 없다', () => {
    const elements = JSON.parse(osmLines()) as { tags: Record<string, string> }[];
    expect(elements.length).toBeGreaterThan(0);
    for (const { tags } of elements) {
      expect(Object.hasOwn(tags, 'military')).toBe(false);
      expect(tags.landuse).not.toBe('military');
      expect(['military', 'bunker', 'barracks']).not.toContain(tags.building);
    }
    const m = manifest();
    expect(m.sources.osm.military).toBe(0);
    // The zero means something only because the query asked for them.
    const { query } = readConfig('terrain/mungyeong').sources.osm;
    for (const q of [query, m.sources.osm.query]) {
      expect(q).toContain('nwr["military"]');
      expect(q).toContain('nwr["landuse"="military"]');
      expect(q).toContain('nwr["building"~"^(military|bunker|barracks)$"]');
    }
  });

  test('받기: 스냅샷 목록과 요소의 모양', () => {
    const m = manifest();
    expect(Object.keys(m)).toEqual(['format', 'n', 'cell', 'tools', 'sources']);
    expect([m.format, m.n, m.cell]).toEqual([1, 1024, 10]);
    expect(Object.keys(m.tools)).toEqual(['node', 'geotiff', 'proj4']);
    for (const v of Object.values(m.tools)) expect(v).toMatch(/^\d+\.\d+\.\d+/);
    expect(Object.keys(m.sources)).toEqual(['ground', 'cover', 'osm']);
    for (const r of [m.sources.ground, m.sources.cover]) {
      expect(Object.keys(r)).toEqual(['version', 'url', 'pixel', 'bytes', 'etag', 'file', 'sha256']);
      expect(['area', 'point']).toContain(r.pixel);
    }
    expect(Object.keys(m.sources.osm)).toEqual(['url', 'query', 'osmBase', 'file', 'sha256', 'counts', 'military']);
    expect(Object.keys(m.sources.osm.counts)).toEqual(['node', 'way', 'relation']);
    // The OpenStreetMap base time is the only date: no wall-clock time anywhere else.
    expect(m.sources.osm.osmBase).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(JSON.stringify({ ...m, sources: { ...m.sources, osm: { ...m.sources.osm, osmBase: '' } } })).not.toMatch(/\d{4}-\d\d-\d\dT/);

    const text = osmLines();
    expect(text).not.toContain('\r');
    const elements = JSON.parse(text) as { type: string; id: number; pts?: number[][]; members?: { pts: number[][] }[] }[];
    expect(text.split('\n').length - 1).toBe(elements.length + 2);
    const { counts } = m.sources.osm;
    expect(counts.node + counts.way + counts.relation).toBe(elements.length);
    for (const key of ['"lat"', '"lon"', '"bounds"', '"center"', '"geometry"']) expect(text).not.toContain(key);
    const order = ['node', 'way', 'relation'];
    elements.forEach((e, k) => {
      for (const key of Object.keys(e)) expect(['type', 'id', 'tags', 'pts', 'members']).toContain(key);
      const pts = [...(e.pts ?? []), ...(e.members ?? []).flatMap((mb) => mb.pts)];
      for (const p of pts) expect(p.every(Number.isInteger) && p.length === 2).toBe(true);
      const prev = elements[k - 1];
      if (prev) expect(order.indexOf(prev.type) * 2 ** 40 + prev.id).toBeLessThan(order.indexOf(e.type) * 2 ** 40 + e.id);
    });

    const ground = decodeGround(readSnap('ground.bin'), 1024);
    expect(ground.length).toBe(1024 * 1024);
    expect(ground.every((v) => v >= -10_000 && v <= 250_000)).toBe(true);
    expect(decodeCover(readSnap('cover.bin')).length).toBe(1024 * 1024);
  });
});
