// 싸기: 지형 자료 → 지형 파일 bytes. The inverse of the app's unpackTerrain, whose layout helpers it reuses.
import { gzipSync } from 'node:zlib';
import { COVER, type TerrainData } from '@sim';
import type { ForestRule } from '@adapters/terrainFile/cellHash';
import { bodyStart, predict, type TerrainFileHeader } from '@adapters/terrainFile/unpack';

const fail = (why: string): never => {
  throw new Error(`지형 파일 싸기: ${why}`);
};

/** Rounds heights to 1/scale m; fails on values that do not fit or coordinates that are not whole metres. */
export function packTerrain(t: Omit<TerrainData, 'surface'>, scale: number, forest: ForestRule): Uint8Array<ArrayBuffer> {
  const { n } = t;
  const cells = n * n;
  for (const a of [t.ground, t.buildings, t.cover]) if (a.length !== cells) fail('층 길이가 n·n이 아니다');
  for (const p of [...t.roads.flatMap((r) => r.line), ...t.villages, ...t.names])
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) fail(`좌표 (${p.x}, ${p.y})가 1 m 정수가 아니다`);

  const header: TerrainFileHeader = {
    format: 1,
    id: t.id,
    version: t.version,
    n,
    cell: t.cell,
    scale,
    grid: t.grid,
    edge: t.edge,
    credits: t.credits,
    forest: { min: forest.min, max: forest.max, salt: forest.salt },
    roads: t.roads,
    villages: t.villages,
    names: t.names,
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const start = bodyStart(json.length);
  const body = new Uint8Array(start + 5 * cells).fill(0x20, 4 + json.length, start);
  const view = new DataView(body.buffer);
  view.setUint32(0, json.length, true);
  body.set(json, 4);

  const ints = new Int16Array(cells);
  for (let j = 0, k = 0; j < n; j++)
    for (let i = 0; i < n; i++, k++) {
      const g = Math.round(t.ground[k]! * scale);
      const b = Math.round(t.buildings[k]! * scale);
      if (!(g >= -32768 && g <= 32767)) fail(`지면 ${t.ground[k]}이 16비트에 들지 않는다`);
      if (!(b >= 0 && b <= 65535)) fail(`건물 높이 ${t.buildings[k]}이 16비트에 들지 않는다`);
      if (t.cover[k]! >= COVER.length) fail(`피복 번호 ${t.cover[k]}`);
      ints[k] = g;
      view.setInt16(start + 2 * k, g - predict(ints, n, i, j), true); // differences wrap by design
      view.setUint16(start + 2 * cells + 2 * k, b, true);
    }
  body.set(t.cover, start + 4 * cells);

  const gz = new Uint8Array(gzipSync(body, { level: 9 }));
  if (gz[3] !== 0) fail('gzip 머리에 FLG가 있다');
  gz.fill(0, 4, 8); // mtime 0
  gz[8] = 2; // XFL: maximum compression
  gz[9] = 255; // OS unknown
  return gz;
}
