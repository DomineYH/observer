import { expect, test } from 'vitest';
import type { TerrainData } from '@sim';
import { TerrainLoadError, TERRAIN_FAILURES, type TerrainFailure, type TerrainSource } from '@adapters/index';
import { mockTerrain } from '@adapters/mock/terrain';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { BASE_SCENARIO, BRIEFING } from '@content/scenario';
import { MOCK_PLACEMENT } from '@content/placement';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { loadTerrain, placementOf, selectBackend, terrainSourceOf, type BootScreen } from './backend';

test('조립 지점: real을 받는다', () => {
  expect(selectBackend(undefined)).toBe('mock');
  expect(selectBackend('mock')).toBe('mock');
  expect(selectBackend('real')).toBe('real');
  for (const value of ['MOCK', 'REAL', '', 'x']) expect(() => selectBackend(value), value).toThrow(/VITE_OBSERVER_BACKEND/);
});

test('조립 지점: real은 문경 지형 원천', () => {
  expect(terrainSourceOf('mock')).toBe(mockTerrain);
  const real = terrainSourceOf('real');
  expect(real).not.toBe(mockTerrain);
  expect(typeof real.load).toBe('function');
  expect(terrainSourceOf('real')).toBe(real); // one source per page, so its one fetch is shared
});

test('배치: 조립 지점이 지형 원천과 짝지어 고른다', async () => {
  const placement = placementOf('mock');
  expect(placement).toBe(MOCK_PLACEMENT);
  expect(placement.scenario).toBe(BASE_SCENARIO);
  expect(placement.briefing).toEqual({ ...BRIEFING, plannedOp: '1번 고지' });
  expect(placement.scenario.reserveOps).toBeUndefined();
  for (const seed of [1, 20261106]) {
    const terrain = await terrainSourceOf('mock').load(seed);
    expect({ id: terrain.id, version: terrain.version }, String(seed)).toEqual(placement.terrain);
  }
  // real pairs the 문경 배치 with the 문경 지형
  expect(placementOf('real')).toBe(MUNGYEONG_PLACEMENT);
  expect(placementOf('real').terrain).toEqual({ id: 'mungyeong', version: 2 });
}, 30_000); // two mock terrain generations: several seconds, more under load

/** A boot screen that records its calls, and a source the test resolves or rejects by hand. */
function fixture() {
  const calls: string[] = [];
  const screen: BootScreen = { loading: () => void calls.push('loading'), error: (r: TerrainFailure) => void calls.push(`error ${r}`) };
  let settle!: { resolve: (t: TerrainData) => void; reject: (e: unknown) => void };
  const source: TerrainSource = { load: () => new Promise((resolve, reject) => (settle = { resolve, reject })) };
  return { calls, screen, source, settle: () => settle };
}

test('실제 지형 원천: 받는 중 글자', async () => {
  const real = fixture();
  const loading = loadTerrain('real', 1, real.screen, real.source);
  expect(real.calls).toEqual(['loading']); // shown while the source is still loading
  const t = flatTerrain();
  real.settle().resolve(t);
  expect(await loading).toBe(t);
  expect(real.calls).toEqual(['loading']);
  // mock shows nothing before its screen: the mock page is as before.
  const mock = fixture();
  const done = loadTerrain('mock', 1, mock.screen, mock.source);
  mock.settle().resolve(t);
  expect(await done).toBe(t);
  expect(mock.calls).toEqual([]);
});

test('실제 지형 원천: 오류 화면 — 판은 시작되지 않는다', async () => {
  expect(TERRAIN_FAILURES).toEqual(['fetch', 'mismatch', 'unsupported']);
  for (const reason of TERRAIN_FAILURES) {
    const f = fixture();
    const loading = loadTerrain('real', 1, f.screen, f.source);
    f.settle().reject(new TerrainLoadError(reason));
    // Startup stops: no terrain, so no game and no mock land.
    await expect(loading, reason).rejects.toBeInstanceOf(TerrainLoadError);
    expect(f.calls, reason).toEqual(['loading', `error ${reason}`]);
  }
});
