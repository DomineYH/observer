// Fixtures for the enemy tests: one-unit scenarios on the flat test terrain, whose observer stands at (320, 320).
import { createSim, type Point, type Scenario, type Sim, type SimInit, type UnitDef, type Weather } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@app/clearWeather';
import { init, START } from './init';
import { flatTerrain } from './terrain';

/** The base scenario with only `unit`; every route is `route` when given. */
export const oneUnit = (unit: UnitDef, route?: readonly Point[]): Scenario => ({
  ...BASE_SCENARIO,
  routes: route ? { A: route, B: route, C: route } : BASE_SCENARIO.routes,
  units: [unit],
});

/** The mortar section dug in exactly at `at` (a zero spread puts it on the NAI's centre). */
export const mortarAt = (at: Point): Scenario => ({
  ...oneUnit({ type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0 }),
  nais: [{ ...at, r: 100, conf: 'low' }],
});

/** Flat terrain with a wall `h` m high across the row at north `y` (the map mirrors it beyond its edge). */
export function wallTerrain(y: number, h: number) {
  const t = flatTerrain();
  const j = Math.round(y / t.cell);
  for (let i = 0; i < t.n; i++) t.surface[j * t.n + i]! += h;
  return t;
}

/** A started simulation of `scenario`. */
export function started(scenario: Scenario, opts: { seed?: number; terrain?: SimInit['terrain']; weather?: Weather } = {}): Sim {
  const sim = createSim({ ...init(opts.seed ?? 7, opts.terrain), scenario, weather: opts.weather ?? CLEAR_WEATHER });
  sim.step([START]);
  return sim;
}

export const run = (sim: Sim, ticks: number) => {
  for (let k = 0; k < ticks; k++) sim.step([]);
};

/** Steps until `done` holds, at most `limit` ticks; fails the test if it never does. */
export function until(sim: Sim, done: () => boolean, limit = 20000): void {
  for (let k = 0; k < limit; k++) {
    if (done()) return;
    sim.step([]);
  }
  throw new Error(`condition not met in ${limit} ticks`);
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
