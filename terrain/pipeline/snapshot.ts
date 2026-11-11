// 원자료 스냅샷 layout (terrain/<id>/snapshot/): written by 받기, read by 가공 without the network.
// ground.bin: gzip of n·n Int32 LE residuals against unpack's predict (ground in 0.01 m). cover.bin: gzip of n·n
// WorldCover class values. osm.json: one kept element per line in local 0.1 m. manifest.json: the 스냅샷 목록.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { predict } from '@adapters/terrainFile/unpack';

export interface RasterEntry {
  version: string;
  url: string;
  pixel: 'area' | 'point'; // what the file declared (GTRasterTypeGeoKey)
  bytes: number | null; // remote file size from HEAD
  etag: string | null;
  file: string;
  sha256: string;
}

/** The 스냅샷 목록. No wall-clock time: the OpenStreetMap base time is the only date. */
export interface Manifest {
  format: 1;
  n: number;
  cell: number;
  tools: { node: string; geotiff: string; proj4: string };
  sources: {
    ground: RasterEntry;
    cover: RasterEntry;
    osm: {
      url: string;
      query: string; // the text sent
      osmBase: string;
      file: string;
      sha256: string;
      counts: { node: number; way: number; relation: number };
      military: 0;
    };
  };
}

/** One line of osm.json: points in 0.1 m from node (0, 0). Relations carry their way members instead of points. */
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags: Record<string, string>;
  pts?: [number, number][];
  members?: { role: string; pts: [number, number][] }[];
}

/** The 원자료 스냅샷 as 가공 reads it. sha256 is of the bytes read, not copied from the manifest. */
export interface Snapshot {
  ground: Int32Array; // 0.01 m
  cover: Uint8Array; // WorldCover class values
  osm: OsmElement[];
  sha256: { 'ground.bin': string; 'cover.bin': string; 'osm.json': string };
  osmBase: string;
}

export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export function encodeGround(v: Int32Array, n: number): Buffer {
  const out = Buffer.alloc(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.writeInt32LE((v[j * n + i]! - predict(v, n, i, j)) | 0, (j * n + i) * 4);
  return gzipSync(out, { level: 9 });
}

export function decodeGround(bytes: Uint8Array, n: number): Int32Array {
  const raw = gunzipSync(bytes);
  if (raw.length !== n * n * 4) throw new Error(`원자료 스냅샷: ground.bin 길이 ${raw.length} ≠ ${n * n * 4}`);
  const v = new Int32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) v[j * n + i] = (raw.readInt32LE((j * n + i) * 4) + predict(v, n, i, j)) | 0;
  return v;
}

export const encodeCover = (cover: Uint8Array): Buffer => gzipSync(cover, { level: 9 });
export const decodeCover = (bytes: Uint8Array): Uint8Array => new Uint8Array(gunzipSync(bytes));

export function readSnapshot(dir: string, n: number): Snapshot {
  const read = (file: string) => readFileSync(join(dir, file));
  const [g, c, o] = [read('ground.bin'), read('cover.bin'), read('osm.json')];
  const manifest = JSON.parse(read('manifest.json').toString('utf8')) as Manifest;
  return {
    ground: decodeGround(g, n),
    cover: decodeCover(c),
    osm: JSON.parse(o.toString('utf8')) as OsmElement[],
    sha256: { 'ground.bin': sha256(g), 'cover.bin': sha256(c), 'osm.json': sha256(o) },
    osmBase: manifest.sources.osm.osmBase,
  };
}
