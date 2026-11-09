// Fixtures for the enemy tests: one-unit scenarios on the flat test terrain, whose observer stands at (320, 320).
import { createSim, EYE_HEIGHT, type Mode, type Point, type Scenario, type Sim, type SimInit, type UnitDef, type Weather } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { init, START } from './init';
import { flatTerrain } from './terrain';

/** A combat unit that never sets off: with it a game goes on after the unit under test falls (all combat units down
 * ends it, #36). Last in the scenario on a fixed route, so the deploy draws of the unit before it are unchanged. */
export const RESERVE: UnitDef = { type: 'inf', route: 'A', t0: 1e6 };

/** The base scenario with only `unit` (and the RESERVE); every route is `route` when given. No friendly positions: the
 * base ones lie kilometres off the flat test terrain, and their troops would only draw from the 행동 stream and cost
 * sight lines. */
export const oneUnit = (unit: UnitDef, route?: readonly Point[]): Scenario => ({
  ...BASE_SCENARIO,
  routes: route ? { A: route, B: route, C: route } : BASE_SCENARIO.routes,
  units: [unit, RESERVE],
  friends: [],
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
export function started(scenario: Scenario, opts: { seed?: number; terrain?: SimInit['terrain']; weather?: Weather; mode?: Mode } = {}): Sim {
  const sim = createSim({ ...init(opts.seed ?? 7, opts.terrain), scenario, weather: opts.weather ?? CLEAR_WEATHER, mode: opts.mode ?? 'standard' });
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

/** Angle (0.1 mils, unrounded) from the flat-terrain observer to where a click picks `m` (ground + pick height). */
export function angleTo(sim: Sim, m: { kind: string; prone: boolean; x: number; y: number }, ground = 100): { az: number; el: number } {
  const { op } = sim.state;
  const z = ground + (m.kind === 'veh' ? 1.2 : m.prone ? 0.25 : 0.9);
  const d = Math.hypot(m.x - op.x, m.y - op.y);
  const k = 32000 / Math.PI;
  return { az: (Math.atan2(m.x - op.x, m.y - op.y) * k + 64000) % 64000, el: Math.atan2(z - 100 - EYE_HEIGHT, d) * k }; // the observer stands on 100 m
}

/** An `id` input `dAz, dEl` (0.1 mils) off an angle. */
export const idAt = (a: { az: number; el: number }, dAz = 0, dEl = 0) => ({ a: 'id', v: [Math.round(a.az + dAz + 64000) % 64000, Math.round(a.el + dEl)] });
