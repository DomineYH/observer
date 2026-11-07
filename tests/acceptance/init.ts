import { SIM_VERSION, type Input, type ReplayData, type SimInit, type TerrainData } from '@sim';
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

/** 작전 개시 at the middle of the flat test terrain. */
export const START: Input = { a: 'start', v: [320, 320] };

/** 재생 자료 for `init(seed)`: the header carries the scenario's identity only, and no terrain. */
export const replayData = (inputs: ReplayData['inputs'], totalTicks = 10, seed = 20261106): ReplayData => {
  const { seedKind, scenario, guns, weather, mode } = init(seed);
  return {
    format: 1,
    simVersion: SIM_VERSION,
    seed,
    seedKind,
    scenario: { id: scenario.id, version: scenario.version },
    guns,
    weather,
    mode,
    stepMs: 50,
    inputs,
    totalTicks,
  };
};
