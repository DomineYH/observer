import { COVER, type GridRef, type TerrainData } from '@sim';

/** A small flat 지형 자료 for tests that don't care about the mock generator. Arrays are mutable on purpose. */
export function flatTerrain({ n = 64, h = 100, grid = { letters: 'CH', e0: 40000, n0: 30000 } as GridRef } = {}) {
  return {
    n,
    cell: 10,
    ground: new Float32Array(n * n).fill(h),
    surface: new Float32Array(n * n).fill(h),
    cover: new Uint8Array(n * n).fill(COVER.indexOf('open')),
    buildings: new Float32Array(n * n),
    roads: [],
    villages: [],
    grid,
  } satisfies TerrainData;
}
