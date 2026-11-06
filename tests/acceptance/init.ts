import type { SimInit, TerrainData } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@app/clearWeather';
import { flatTerrain } from './terrain';

// The small flat terrain keeps tests that don't look at the terrain fast.
export const init = (seed: number, terrain: TerrainData = flatTerrain()): SimInit => ({
  seed,
  seedKind: 'daily',
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: CLEAR_WEATHER,
  mode: 'standard',
  terrain,
});
