// The 지형 파일 seam: 싸기 (pack, processing side) and 풀기 (unpack, app side), run headless in Node.
import { describe, expect, test } from 'vitest';
import { gunzipSync, gzipSync } from 'node:zlib';
import { COVER, terrainHash, type TerrainData } from '@sim';
import { forestHeight, type ForestRule } from '@adapters/terrainFile/cellHash';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { generateTerrain } from '@adapters/mock/terrain';
import { packTerrain } from '../../terrain/pipeline/rules/pack';
import { flatTerrain } from './terrain';

const N = 5;
const FOREST: ForestRule = { min: 12, max: 17, salt: 5 };
const FOREST_I = COVER.indexOf('forest');

/** 5×5 synthetic terrain: ground differences overflow 16 bits, all seven cover kinds, multi-byte names. */
function synthetic(): TerrainData {
  const t = flatTerrain({ n: N, grid: { letters: 'CH', e0: 40230, n0: 30490 } });
  for (let k = 0; k < N * N; k++) {
    t.ground[k] = k % 2 ? 3000 : -3000;
    t.buildings[k] = [0, 6, 25.5][k % 3]!;
    t.cover[k] = k % COVER.length;
  }
  t.ground[12] = 123.4; // on the 0.1 m grid, not exact in Float32
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      t.surface[k] = t.ground[k]! + (t.cover[k] === FOREST_I ? forestHeight(FOREST, i, j) : 0) + t.buildings[k]!;
    }
  return {
    ...t,
    id: 'synthetic',
    version: 3,
    edge: 'veil',
    credits: ['국토지리정보원 수치지형도', 'OpenStreetMap 기여자'],
    roads: [
      { class: 'trunk', line: [{ x: 0, y: 0 }, { x: 40, y: 10 }] },
      { class: 'main', line: [{ x: 5, y: 40 }, { x: 20, y: 20 }, { x: 40, y: 3 }] },
      { class: 'local', line: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
    ],
    villages: [{ name: '새터마을', x: 20, y: 30, r: 15 }],
    names: [
      { name: '갈미봉', x: 10, y: 10, kind: 'peak' },
      { name: '솔티재', x: 30, y: 0, kind: 'pass' },
      { name: '영강', x: 0, y: 40, kind: 'water' },
    ],
  };
}

const pack = (t: TerrainData) => packTerrain(t, 10, FOREST);
const padded = (L: number) => 4 + L + ((4 - (L % 4)) % 4);

/** An unzipped body's JSON header and the layer bytes after it. */
function split(body: Uint8Array) {
  const L = new DataView(body.buffer, body.byteOffset).getUint32(0, true);
  return { L, header: JSON.parse(new TextDecoder().decode(body.subarray(4, 4 + L))), layers: body.subarray(padded(L)) };
}

/** A body with `header` written and padded the way the file layout says. */
function join(header: object, layers: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(padded(json.length) + layers.length).fill(0x20, 4 + json.length);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  out.set(layers, padded(json.length));
  return out;
}

describe('지형 파일', () => {
  test('지형 파일: 싸고 풀면 값과 해시가 같다', async () => {
    const t = synthetic();
    const bytes = pack(t);
    const back = await unpackTerrain(bytes);
    expect(back).toEqual(t);
    for (const k of ['ground', 'surface', 'buildings'] as const) expect(back[k]).toBeInstanceOf(Float32Array);
    expect(back.cover).toBeInstanceOf(Uint8Array);
    expect(terrainHash(back)).toBe(terrainHash(t));
    // Fixed level and header bytes: the same terrain packs to the same bytes.
    expect(pack(t)).toEqual(bytes);
    expect([...bytes.subarray(0, 10)]).toEqual([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff]);
  });

  test('지형 파일: 표면 다시 만들기', async () => {
    const t = await unpackTerrain(pack(synthetic()));
    let forests = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const g = t.ground[k]!;
        const b = t.buildings[k]!;
        if (t.cover[k] === FOREST_I) {
          forests++;
          expect(t.surface[k]).toBe(Math.fround(g + forestHeight(FOREST, i, j) + b));
          expect(t.surface[k]! - g - b).toBeGreaterThanOrEqual(12 - 1e-3);
          expect(t.surface[k]! - g - b).toBeLessThan(17);
        } else expect(t.surface[k]).toBe(Math.fround(g + b));
      }
    expect(forests).toBeGreaterThan(0);
    // The mock generator builds 숲 높이 from the same rule: at seed 0 its salt S(5) is 5.
    const mock = generateTerrain(0);
    let mockForests = 0;
    for (let k = 0; k < mock.n * mock.n; k++)
      if (mock.cover[k] === FOREST_I) {
        mockForests++;
        const h = forestHeight(FOREST, k % mock.n, (k / mock.n) | 0);
        if (mock.surface[k] !== Math.fround(mock.ground[k]! + h)) expect(mock.surface[k], `cell ${k}`).toBe(Math.fround(mock.ground[k]! + h));
      }
    expect(mockForests).toBeGreaterThan(0);
  }, 30_000);

  test('지형 파일: 풀기 거부 셋', async () => {
    const body = gunzipSync(pack(synthetic()));
    const gz = (b: Uint8Array) => new Uint8Array(gzipSync(b));
    const { header, layers } = split(body);
    const format2 = join({ ...header, format: 2 }, layers);
    await expect(unpackTerrain(gz(join(header, layers)))).resolves.toEqual(synthetic()); // re-padding is sound
    const bad: [string, Uint8Array<ArrayBuffer>, string][] = [
      ['one byte short', gz(body.subarray(0, body.length - 1)), '길이'],
      ['one byte long', gz(new Uint8Array([...body, 0])), '길이'],
      ['format 2', gz(format2), 'format'],
      ['not gzip', new Uint8Array(body), 'gzip'],
      ['arbitrary bytes', new Uint8Array(16).fill(7), 'gzip'],
    ];
    for (const [what, bytes, why] of bad) await expect(unpackTerrain(bytes), what).rejects.toThrow(why);
  });

  test('지형 파일: 머리 키 허용 목록', () => {
    const body = gunzipSync(pack(synthetic()));
    const { L, header } = split(body);
    expect(Object.keys(header)).toEqual(['format', 'id', 'version', 'n', 'cell', 'scale', 'grid', 'edge', 'credits', 'forest', 'roads', 'villages', 'names']);
    expect(Object.keys(header.forest)).toEqual(['min', 'max', 'salt']);
    expect(header.format).toBe(1);
    expect(header.scale).toBe(10);
    const start = padded(L);
    expect(start % 4).toBe(0);
    expect([...body.subarray(4 + L, start)].every((c) => c === 0x20)).toBe(true);
    expect(body.length).toBe(start + 5 * N * N);
  });
});
