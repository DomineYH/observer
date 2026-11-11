import type { TerrainSource } from '@adapters/index';
import { mockTerrain } from '@adapters/mock/terrain';
import { MOCK_PLACEMENT, type Placement } from '@content/placement';

export type Backend = 'mock' | 'real';

/** Reads VITE_OBSERVER_BACKEND (unset → mock). Any value but mock or real stops startup. */
export function selectBackend(value: string | undefined): Backend {
  if (value === undefined || value === 'mock') return 'mock';
  if (value === 'real') return 'real';
  throw new Error(`VITE_OBSERVER_BACKEND=${JSON.stringify(value)}: mock 또는 real이어야 한다`);
}

// 이음매 표, started with the 지형 원천 (M2-10 finishes it). The real source arrives in M2-9.
const TERRAIN: Record<Backend, TerrainSource | null> = { mock: mockTerrain, real: null };

export function terrainSourceOf(backend: Backend): TerrainSource {
  const source = TERRAIN[backend];
  if (!source) throw new Error('실제 지형 원천이 아직 없다 (VITE_OBSERVER_BACKEND=real)');
  return source;
}

// 배치, paired with the 지형 원천 by the same key. The real 배치 (문경) arrives in M2-8.
const PLACEMENT: Record<Backend, Placement | null> = { mock: MOCK_PLACEMENT, real: null };

export function placementOf(backend: Backend): Placement {
  const placement = PLACEMENT[backend];
  if (!placement) throw new Error('문경 배치가 아직 없다 (VITE_OBSERVER_BACKEND=real)');
  return placement;
}
