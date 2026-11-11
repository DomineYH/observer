// 가공: 원자료 스냅샷 + 가공 설정 → 지형 파일 bytes, 지형 기대값, 가공 자료 머리 and 가공 기록, in memory. The self-check
// unpacks the bytes with the app's own unpackTerrain and hashes what the app will see. Writing is build/build.ts.
import { gunzipSync } from 'node:zlib';
import { COVER, terrainHash, type Cover, type TerrainData } from '@sim';
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

const stop = (why: string): never => {
  throw new Error(`가공: ${why}`);
};

/** 불변 조건 of the unpacked 지형 자료 against the 가공 자료 머리. */
export function checkInvariants(t: TerrainData, header: Header): void {
  const cells = t.n * t.n;
  const fail = (why: string): never => stop(`불변 조건: ${why}`);
  for (const a of [t.ground, t.surface, t.buildings, t.cover]) if (a.length !== cells) fail('층 길이가 격자 크기와 다르다');
  const counts = new Float64Array(COVER.length);
  for (let k = 0; k < cells; k++) {
    if (!Number.isFinite(t.ground[k]!) || !Number.isFinite(t.surface[k]!) || !Number.isFinite(t.buildings[k]!)) fail(`유한하지 않은 값 (칸 ${k})`);
    if (t.surface[k]! < t.ground[k]!) fail(`표면이 지면보다 낮다 (칸 ${k})`);
    if (t.buildings[k]! < 0) fail(`건물 높이가 음수다 (칸 ${k})`);
    if (t.cover[k]! >= COVER.length) fail(`피복 번호 ${t.cover[k]} (칸 ${k})`);
    counts[t.cover[k]!]!++;
  }
  if (COVER.some((name, c) => header.coverCounts[name] !== counts[c])) fail('머리의 피복 칸 수가 실제와 다르다');
  if (header.ground.kind !== 'DTM') fail(`지면의 종류가 DTM이 아니다 (${header.ground.kind})`);
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

  checkInvariants(t, header);
  // 방안 기준: 찰리호텔, origin in km square 40/30, and its 1 km remainders equal to the real position's.
  const { letters, e0, n0 } = config.grid;
  if (letters !== 'CH' || Math.floor(e0 / 1000) !== 40 || Math.floor(n0 / 1000) !== 30 || e0 % 1000 !== frame.x0 % 1000 || n0 % 1000 !== frame.y0 % 1000)
    stop(`방안 기준이 정한 값이 아니거나 1 km 나머지가 실제 위치와 다르다 (${letters} ${e0} ${n0})`);
  const ranges = config.coverShare;
  if (ranges === null) {
    const measured = {} as Record<Cover, number>;
    for (const name of COVER) measured[name] = final[name].share;
    return stop(`피복 비율 범위가 비어 있다. 잰 비율: ${JSON.stringify(measured)}`);
  }
  for (const name of COVER) {
    const [lo, hi] = ranges[name];
    const share = final[name].share;
    if (!(share >= lo && share <= hi)) stop(`피복 ${name} 비율 ${share}%가 범위 [${lo}, ${hi}] 밖이다`);
  }

  return { file, expected: { id, version: config.version, hash }, header, log };
}
