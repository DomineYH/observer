import { terrainHash, type TerrainData } from '@sim';
import { TerrainLoadError, type TerrainFailure, type TerrainSource } from '@adapters/index';
import { mockTerrain } from '@adapters/mock/terrain';
import { MUNGYEONG, realTerrain } from '@adapters/realTerrain';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { MOCK_PLACEMENT, type Placement } from '@content/placement';

export type Backend = 'mock' | 'real';

/** Reads VITE_OBSERVER_BACKEND (unset → mock). Any value but mock or real stops startup. */
export function selectBackend(value: string | undefined): Backend {
  if (value === undefined || value === 'mock') return 'mock';
  if (value === 'real') return 'real';
  throw new Error(`VITE_OBSERVER_BACKEND=${JSON.stringify(value)}: mock 또는 real이어야 한다`);
}

// 이음매 표, started with the 지형 원천 (M2-10 finishes it): real is the 문경 지형 파일, checked by the sim's 지형 해시.
const TERRAIN: Record<Backend, TerrainSource> = { mock: mockTerrain, real: realTerrain(MUNGYEONG, terrainHash) };

export const terrainSourceOf = (backend: Backend): TerrainSource => TERRAIN[backend];

/** What the page shows before the app's screen: the 받는 중 line, or the 오류 화면 for one cause. */
export interface BootScreen {
  loading(): void;
  error(reason: TerrainFailure): void;
}

/** The game's 지형 자료. On real the 받는 중 line shows first; a refusal shows the 오류 화면 and rethrows, so no game starts. */
export async function loadTerrain(backend: Backend, seed: number, screen: BootScreen, source = terrainSourceOf(backend)): Promise<TerrainData> {
  if (backend === 'real') screen.loading();
  performance.mark('terrain-load');
  try {
    return await source.load(seed);
  } catch (e) {
    if (e instanceof TerrainLoadError) screen.error(e.reason);
    throw e;
  } finally {
    performance.measure('terrain-load', 'terrain-load'); // 받기 + 풀기 + 해시, read by the load-time measurement
  }
}

// 배치, paired with the 지형 원천 by the same key.
const PLACEMENT: Record<Backend, Placement> = { mock: MOCK_PLACEMENT, real: MUNGYEONG_PLACEMENT };

export const placementOf = (backend: Backend): Placement => PLACEMENT[backend];
