// 받기: one 전장's 가공 설정 → 원자료 스냅샷 and 스냅샷 목록. Everything is read and checked in memory first; the four
// stops throw before any file is written. The network sits behind `Sources` (sources.ts), so tests pass fakes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import proj4 from 'proj4';
import type { Config } from '../config';
import { encodeCover, encodeGround, sha256, type Manifest, type RasterEntry } from '../snapshot';
import { bilinear, nearest, nodeLonLat, type Box, type Raster } from './sample';

export interface RasterRead {
  raster: Raster; // the window covering the box
  pixel: 'area' | 'point';
  bytes: number | null;
  etag: string | null;
}

export interface Sources {
  tools: Manifest['tools'];
  raster(url: string, box: Box): Promise<RasterRead>;
  overpass(url: string, query: string): Promise<unknown>;
}

type Tags = Record<string, string>;
interface LonLat {
  lon: number;
  lat: number;
}
interface Element extends Partial<LonLat> {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Tags;
  geometry?: LonLat[];
  members?: { type: string; role: string; geometry?: LonLat[] }[];
}

/** Tries `fn`, waiting `waits[i]` ms after the i-th failure; the last attempt's error is the one thrown. */
export async function retry<T>(fn: () => Promise<T>, waits: readonly number[]): Promise<T> {
  for (const wait of waits) {
    try {
      return await fn();
    } catch {
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return fn();
}

const stop = (why: string): never => {
  throw new Error(`받기: ${why}`);
};

export const isMilitary = (t: Tags): boolean =>
  Object.hasOwn(t, 'military') || t.landuse === 'military' || ['military', 'bunker', 'barracks'].includes(t.building ?? '');

/** The only OpenStreetMap tags the snapshot keeps, in this order. */
const KEEP = ['highway', 'tunnel', 'building', 'height', 'building:levels', 'place', 'name', 'natural', 'waterway', 'mountain_pass', 'water'];
const TYPE_ORDER = ['node', 'way', 'relation'];

export async function fetchTerrain(dir: string, config: Config, sources: Sources): Promise<Manifest> {
  const { frame, sources: src } = config;
  const { n, x0, y0 } = frame;
  const { lon, lat, box } = nodeLonLat(frame);

  const g = await sources.raster(src.ground.url, box);
  const ground = new Int32Array(n * n);
  for (let k = 0; k < n * n; k++) {
    const v = bilinear(g.raster, lon[k]!, lat[k]!) * src.ground.scale;
    if (!Number.isFinite(v) || v < -100 || v > 2500) stop(`지면 마디 ${k}: 자료 없음이거나 −100–2,500 m 밖 (${v})`);
    ground[k] = Math.round(v * 100);
  }

  const c = await sources.raster(src.cover.url, box);
  const cover = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) cover[k] = nearest(c.raster, lon[k]!, lat[k]!) ?? stop(`피복 창이 정사각을 다 덮지 못한다 (마디 ${k})`);

  const query = src.osm.query.replaceAll('{{bbox}}', [box[1], box[0], box[3], box[2]].join(','));
  const res = (await sources.overpass(src.osm.url, query)) as { osm3s?: { timestamp_osm_base?: unknown }; elements?: Element[] } | null;
  const osmBase = res?.osm3s?.timestamp_osm_base;
  if (typeof osmBase !== 'string') return stop('응답에 OpenStreetMap 기준 시각이 없다');
  if (!Array.isArray(res?.elements)) return stop('응답에 요소 목록이 없다');
  // Count only: the Error must carry no element, id, name, tag or position.
  const military = res.elements.filter((e) => isMilitary(e.tags ?? {})).length;
  if (military) stop(`군사 지물 ${military}개. 멈춘다. 사람이 본다`);

  // Lines are built from scratch (never by deleting keys from the response), so no lon/lat or unlisted tag remains.
  const toLocal = proj4('WGS84', frame.proj);
  const pt = (p: LonLat): [number, number] => {
    const [x, y] = toLocal.forward([p.lon, p.lat]) as [number, number];
    return [Math.round((x - x0) * 10), Math.round((y - y0) * 10)];
  };
  const keep = (t: Tags = {}): Tags => Object.fromEntries(KEEP.filter((k) => Object.hasOwn(t, k)).map((k) => [k, t[k]!]));
  const sorted = [...res.elements].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.id - b.id);
  const counts = { node: 0, way: 0, relation: 0 };
  const lines = sorted.map((e) => {
    counts[e.type]++;
    const head = { type: e.type, id: e.id, tags: keep(e.tags) };
    if (e.type === 'node') return { ...head, pts: [pt(e as LonLat)] };
    if (e.type === 'way') return { ...head, pts: (e.geometry ?? []).map(pt) };
    return { ...head, members: (e.members ?? []).filter((m) => m.type === 'way').map((m) => ({ role: m.role, pts: (m.geometry ?? []).map(pt) })) };
  });
  const osm = Buffer.from('[\n' + lines.map((l) => JSON.stringify(l)).join(',\n') + '\n]\n');

  const files = { 'ground.bin': encodeGround(ground, n), 'cover.bin': encodeCover(cover), 'osm.json': osm };
  const entry = (s: { version: string; url: string }, r: RasterRead, file: keyof typeof files): RasterEntry => ({
    version: s.version, url: s.url, pixel: r.pixel, bytes: r.bytes, etag: r.etag, file, sha256: sha256(files[file]),
  });
  const manifest: Manifest = {
    format: 1,
    n,
    cell: frame.cell,
    tools: sources.tools,
    sources: {
      ground: entry(src.ground, g, 'ground.bin'),
      cover: entry(src.cover, c, 'cover.bin'),
      osm: { url: src.osm.url, query, osmBase, file: 'osm.json', sha256: sha256(osm), counts, military: 0 },
    },
  };

  const out = join(dir, 'snapshot');
  mkdirSync(out, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(out, name), bytes);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
