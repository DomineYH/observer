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
    try {
      new DecompressionStream('gzip'); // absent, or present without gzip: both are 지원하지 않음
    } catch {
      throw new TerrainLoadError('unsupported');
    }
    let bytes: Uint8Array<ArrayBuffer>;
    const deadline = new AbortController(); // one limit over the request and its body
    const timer = setTimeout(() => deadline.abort(), TIMEOUT_MS);
    try {
      const res = await get(at.url, { signal: deadline.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (cause) {
      throw new TerrainLoadError('fetch', { cause });
    } finally {
      clearTimeout(timer);
    }
    try {
      const t = await unpackTerrain(bytes);
      if (t.id !== at.expected.id || t.version !== at.expected.version || hash(t) !== at.expected.hash) throw new Error('다른 지형');
      return t;
    } catch (cause) {
      throw new TerrainLoadError('mismatch', { cause }); // a header the unpacker passes can still break the hash
    }
  }
}
