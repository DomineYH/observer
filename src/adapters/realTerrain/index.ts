// 실제 지형 원천: the 지형 파일 beside the bundle, fetched once per page, unpacked and checked against the expected identity.
import type { TerrainData } from '@sim';
import { TerrainLoadError, type TerrainSource } from '../index';
import { unpackTerrain } from '../terrainFile/unpack';
import url from './mungyeong/terrain.bin?url'; // a missing file fails the build
import expected from './mungyeong/expected.json';

export interface Expected {
  id: string;
  version: number;
  hash: string;
}

const TIMEOUT_MS = 60_000;

export const MUNGYEONG = { url, expected };

/** `hash` is the sim's 지형 해시, injected (adapters may import sim types only). The seed is ignored: one land. */
export function realTerrain(at: { url: string; expected: Expected }, hash: (t: TerrainData) => string, get: typeof fetch = fetch): TerrainSource {
  let once: Promise<TerrainData> | undefined; // one fetch per page: a new game reuses it, a failure stays (다시 시도 reloads)
  return { load: () => (once ??= load()) };

  async function load(): Promise<TerrainData> {
    if (typeof DecompressionStream === 'undefined') throw new TerrainLoadError('unsupported');
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const res = await get(at.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (cause) {
      throw new TerrainLoadError('fetch', { cause });
    }
    let t: TerrainData;
    try {
      t = await unpackTerrain(bytes);
    } catch (cause) {
      throw new TerrainLoadError('mismatch', { cause });
    }
    if (t.id !== at.expected.id || t.version !== at.expected.version || hash(t) !== at.expected.hash) throw new TerrainLoadError('mismatch');
    return t;
  }
}
