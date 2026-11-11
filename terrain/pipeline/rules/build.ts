// 가공: 원자료 스냅샷 + 가공 설정 → 지형 파일 bytes, 지형 기대값, 가공 자료 머리 and 가공 기록, in memory. The self-check
// unpacks the bytes with the app's own unpackTerrain and hashes what the app will see. Writing is build/build.ts.
import { gunzipSync } from 'node:zlib';
import { COVER, terrainHash, type Cover } from '@sim';
import type { ForestRule } from '@adapters/terrainFile/cellHash';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import type { Clearing, Config, Frame } from '../config';
import type { Snapshot } from '../snapshot';
import { layers, SCALE, type Discarded } from './layers';
import { packTerrain } from './pack';

export const FOREST: ForestRule = { min: 12, max: 17, salt: 0 };

export interface Expected {
  id: string;
  version: number;
  hash: string;
}

/** 가공 자료 머리: stays in the repository; the only file with the real-world position. */
export interface Header extends Expected {
  rules: number;
  ground: { name: string; version: string; kind: 'DTM' | 'DSM'; vertical: string; subtracted: string; scale: number };
  cover: { name: string; version: string };
  vectors: { name: string; osmBase: string };
  forest: ForestRule;
  coverCounts: Record<Cover, number>;
  frame: Frame;
  clearings: Clearing[];
  credits: string[];
  snapshot: Snapshot['sha256'];
}

/** 가공 기록: the readable diff of a binary change. No wall-clock time, no gzip size. */
export interface Log {
  input: { snapshot: Snapshot['sha256']; osmBase: string; rules: number };
  cover: {
    worldcover: { value: number; cells: number }[];
    overwritten: { water: number; road: number; building: number; clearing: number };
    final: Record<Cover, { cells: number; share: number }>;
  };
  ground: { min: number; max: number; mean: number };
  buildings: { count: number; height: { tag: number; levels: number; default: number }; discarded: Discarded[] };
  size: { body: number; header: number };
}

export interface Built {
  file: Uint8Array<ArrayBuffer>;
  expected: Expected;
  header: Header;
  log: Log;
}

/** Percent of cells, two decimals. */
export const shareOf = (count: number, cells: number): number => Math.round((count * 10000) / cells) / 100;

export async function buildTerrain(id: string, config: Config, snap: Snapshot): Promise<Built> {
  const { frame, sources } = config;
  const { n, cell } = frame;
  const cells = n * n;
  const L = layers(config, snap);
  const credits = [sources.ground.credit, sources.cover.credit, sources.osm.credit];
  const file = packTerrain(
    { id, version: config.version, credits, n, cell, ground: L.ground, buildings: L.buildings, cover: L.cover, roads: [], villages: [], names: [], edge: 'veil', grid: config.grid },
    SCALE,
    FOREST,
  );
  const t = await unpackTerrain(file);
  const hash = terrainHash(t);

  const counts = new Float64Array(COVER.length);
  for (let k = 0; k < cells; k++) counts[L.cover[k]!]!++;
  const coverCounts = {} as Record<Cover, number>;
  const final = {} as Record<Cover, { cells: number; share: number }>;
  COVER.forEach((name, c) => {
    coverCounts[name] = counts[c]!;
    final[name] = { cells: counts[c]!, share: shareOf(counts[c]!, cells) };
  });

  const g = sources.ground;
  const header: Header = {
    id,
    version: config.version,
    hash,
    rules: config.rules,
    ground: { name: g.name, version: g.version, kind: g.kind, vertical: g.vertical, subtracted: g.subtracted, scale: g.scale },
    cover: { name: sources.cover.name, version: sources.cover.version },
    vectors: { name: sources.osm.name, osmBase: snap.osmBase },
    forest: { min: FOREST.min, max: FOREST.max, salt: FOREST.salt },
    coverCounts,
    frame,
    clearings: config.clearings,
    credits,
    snapshot: snap.sha256,
  };

  let [min, max, sum] = [Infinity, -Infinity, 0];
  for (const d of L.groundTenths) {
    min = Math.min(min, d);
    max = Math.max(max, d);
    sum += d;
  }
  const body = gunzipSync(file);
  const log: Log = {
    input: { snapshot: snap.sha256, osmBase: snap.osmBase, rules: config.rules },
    cover: { worldcover: L.worldcover, overwritten: L.overwritten, final },
    ground: { min: min / SCALE, max: max / SCALE, mean: Math.round((sum * 100) / SCALE / cells) / 100 },
    buildings: { count: L.buildingCount, height: L.heightFrom, discarded: L.discarded },
    size: { body: body.length, header: body.readUInt32LE(0) },
  };

  return { file, expected: { id, version: config.version, hash }, header, log };
}
