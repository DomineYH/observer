import { expect, test } from 'vitest';
import type { TerrainData } from '@sim';
import { TerrainLoadError, TERRAIN_FAILURES, VoiceInputError, type TerrainFailure, type TerrainSource } from '@adapters/index';
import { mockTerrain } from '@adapters/mock/terrain';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { BASE, BASE_SCENARIO, BRIEFING } from '@content/scenarios/base';
import { BASE_MUNGYEONG } from '@content/scenarios/base-mungyeong';
import { loadTerrain, placementOf, selectBackend, terrainSourceOf, voiceCreditsOf, voiceInputOf, type BootScreen } from './backend';

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

test('조립 지점: 음성 입력 — mock은 가짜 인식기, real은 빈 구현', async () => {
  // mock: opens, and hears the address's ?heard= in turn; without it, nothing.
  const mock = voiceInputOf('mock', `?seed=1&heard=${encodeURIComponent('준비 쏴|임무끝')}`);
  await mock.open();
  expect([await mock.listen([]).stop(), await mock.listen([]).stop(), await mock.listen([]).stop()]).toEqual([['준비 쏴'], ['임무끝'], []]);
  expect(await voiceInputOf('mock', '').listen([]).stop()).toEqual([]);
  // real: the vosk 어댑터, never the 가짜 인식기 whatever ?heard= says. Here (Node: no microphone) it is the empty one, which
  // refuses as a browser that cannot run the 인식기.
  const real = voiceInputOf('real', '?heard=x');
  await expect(real.open()).rejects.toEqual(new VoiceInputError('unsupported'));
  expect(await real.listen([]).stop()).toEqual([]);
  // 자료 출처: the model and the library, on the build that uses them.
  expect(voiceCreditsOf('mock')).toEqual([]);
  expect(voiceCreditsOf('real')).toEqual(['음성 모델 vosk-model-small-ko-0.22 (Alpha Cephei, Apache-2.0)', 'vosk-browser 0.0.8 (Apache-2.0)']);
});

test('배치: 조립 지점이 지형 원천과 짝지어 고른다', async () => {
  const placement = placementOf('mock');
  expect(placement).toBe(BASE);
  expect(placement.scenario).toBe(BASE_SCENARIO);
  expect(placement.briefing).toEqual({ ...BRIEFING, plannedOp: '1번 고지' });
  expect(placement.scenario.reserveOps).toBeUndefined();
  for (const seed of [1, 20261106]) {
    const terrain = await terrainSourceOf('mock').load(seed);
    expect({ id: terrain.id, version: terrain.version }, String(seed)).toEqual(placement.terrain);
  }
  // real pairs the 문경 배치 with the 문경 지형
  expect(placementOf('real')).toBe(BASE_MUNGYEONG);
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
