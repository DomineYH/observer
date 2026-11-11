import { COVER, type GridRef, type Point, type Road, type TerrainData } from '@sim';

/** A small flat 지형 자료 for tests that don't care about the mock generator. Arrays are mutable on purpose. */
export function flatTerrain({ n = 64, h = 100, grid = { letters: 'CH', e0: 40000, n0: 30000 } as GridRef } = {}) {
  return {
    id: 'mock', // header-less replays expect mock@1
    version: 1,
    credits: [],
    n,
    cell: 10,
    ground: new Float32Array(n * n).fill(h),
    surface: new Float32Array(n * n).fill(h),
    cover: new Uint8Array(n * n).fill(COVER.indexOf('open')),
    buildings: new Float32Array(n * n),
    roads: [],
    villages: [],
    names: [],
    edge: 'mirror',
    grid,
  } satisfies TerrainData;
}

/** A 도로 of the mock's one grade. */
export const mainRoad = (line: readonly Point[]): Road => ({ class: 'main', line });
