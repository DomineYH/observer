// 풀기: 지형 파일 bytes → 지형 자료. Pure and headless (no fetch, no DOM, no Node import), so the browser, the
// Node acceptance tests, the processing self-check and the server all run this one function.
import type { COVER, EDGE, GridRef, PlaceName, Road, TerrainData, Village } from '@sim';
import { forestHeight, type ForestRule } from './cellHash';

// Only types come from sim here; the type check keeps this tuple equal to sim's COVER.
export const COVER_ORDER = ['open', 'field', 'forest', 'water', 'road', 'village', 'building'] as const satisfies typeof COVER;
const FOREST = COVER_ORDER.indexOf('forest');

/** The JSON header, keys in file order. Only these keys are written (no real-world position). */
export interface TerrainFileHeader {
  format: 1;
  id: string;
  version: number;
  n: number;
  cell: number;
  scale: number; // stored integer = round(m · scale)
  grid: GridRef;
  edge: (typeof EDGE)[number];
  credits: readonly string[];
  forest: ForestRule;
  roads: readonly Road[];
  villages: readonly Village[];
  names: readonly PlaceName[];
}

/** Header length (u32) + header padded with spaces to a multiple of 4. */
export const bodyStart = (headerBytes: number): number => 4 + headerBytes + ((4 - (headerBytes % 4)) % 4);

/** Little-endian 2D prediction of cell (i, j): left + up − up-left; first row left, first column up, first cell 0. */
export function predict(v: ArrayLike<number>, n: number, i: number, j: number): number {
  const k = j * n + i;
  if (j === 0) return i === 0 ? 0 : v[k - 1]!;
  if (i === 0) return v[k - n]!;
  return v[k - 1]! + v[k - n]! - v[k - n - 1]!;
}

const reject = (why: string): never => {
  throw new Error(`지형 파일: ${why}`);
};

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  try {
    return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  } catch {
    return reject('gzip이 아니다');
  }
}

export async function unpackTerrain(bytes: Uint8Array<ArrayBuffer>): Promise<TerrainData> {
  const body = await gunzip(bytes);
  const view = new DataView(body);
  if (body.byteLength < 4) reject('길이가 틀렸다');
  const L = view.getUint32(0, true);
  const start = bodyStart(L);
  if (start > body.byteLength) reject('길이가 틀렸다');
  let h: TerrainFileHeader;
  try {
    h = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(body, 4, L)));
  } catch {
    return reject('머리를 읽을 수 없다');
  }
  if (h.format !== 1) reject(`format ${h.format}은 모른다`);
  const { n, scale } = h;
  if (!Number.isInteger(n) || n < 2 || !(scale > 0)) reject('머리 값이 틀렸다');
  // Checked before any n·n allocation, so a corrupt n cannot allocate.
  if (body.byteLength !== start + 5 * n * n) reject('길이가 틀렸다');

  const cells = n * n;
  const ints = new Int16Array(cells);
  const ground = new Float32Array(cells);
  const buildings = new Float32Array(cells);
  const cover = new Uint8Array(body, start + 4 * cells, cells).slice();
  const surface = new Float32Array(cells);
  for (let j = 0, k = 0; j < n; j++)
    for (let i = 0; i < n; i++, k++) {
      ints[k] = view.getInt16(start + 2 * k, true) + predict(ints, n, i, j); // Int16Array store wraps to 16 bits
      ground[k] = ints[k]! / scale;
      buildings[k] = view.getUint16(start + 2 * cells + 2 * k, true) / scale;
      // Same expression and order as the mock generator.
      surface[k] = ground[k]! + (cover[k] === FOREST ? forestHeight(h.forest, i, j) : 0) + buildings[k]!;
    }
  const { id, version, credits, cell, roads, villages, names, edge, grid } = h;
  return { id, version, credits, n, cell, ground, surface, cover, buildings, roads, villages, names, edge, grid };
}
