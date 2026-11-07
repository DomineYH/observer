// Fixtures for the fire-for-effect tests on enemy units: a mission sent so its rounds fall where a unit will stand.
import { toGrid, type ImpactEvent, type Input, type Point, type Scenario, type Sim, type SimEvent } from '@sim';
import { answered, openRadio, send, toReady } from './mission';
import { angleTo, idAt, oneUnit, started, until } from './enemy';
import { flatTerrain } from './terrain';

export const isImpact = (e: SimEvent): e is ImpactEvent => e.type === 'impact';

/** A started simulation of `scenario` with its radio open. */
export function opened(scenario: Scenario, seed: number): Sim {
  const sim = started(scenario, { seed });
  openRadio(sim);
  return sim;
}

/** 표적위치 by grid of a point on the flat test terrain. */
export const gridAt = (p: Point): Input => {
  const g = toGrid(p.x, p.y, flatTerrain().grid);
  return { a: 'loc', v: ['grid', g.e, g.n] };
};

/** Steps with no input until a round lands (at most `limit` ticks); returns that step's events. */
export function untilLanded(sim: Sim, limit = 4000): readonly SimEvent[] {
  for (let k = 0; k < limit; k++) {
    const events = sim.step([]).events;
    if (events.some(isImpact)) return events;
  }
  throw new Error(`no impact in ${limit} ticks`);
}

/**
 * Sends `call`, a grid and `d` so the first round falls `offset` m from where unit `pid`'s centre will be when it lands,
 * and runs until 사격준비 끝. A twin with the same seed and inputs (grid: the unit now) tells the tick the first round
 * lands; a run without radio tells where the unit stands then (nothing the radio does reaches the enemy before a round
 * lands). The grid takes off the mission's 비표준 조건 오차, read once the call is accepted. `wait` ticks pass first.
 */
export function aimedAt(scenario: Scenario, seed: number, pid: number, call: Input, d: Input, offset: Point = { x: 0, y: 0 }, wait = 0): Sim {
  const run = (sim: Sim) => {
    for (let k = 0; k < wait; k++) sim.step([]);
    return sim;
  };
  const twin = run(opened(scenario, seed));
  toReady(twin, d, call, gridAt(twin.state.platoons[pid]!));
  untilLanded(twin);
  const tick = twin.state.tick;

  const ghost = started(scenario, { seed });
  while (ghost.state.tick < tick) ghost.step([]);
  const { x, y } = ghost.state.platoons[pid]!;

  const sim = run(opened(scenario, seed));
  if (!send(sim, call).ok) throw new Error('call ignored');
  answered(sim, 'call');
  const b = sim.state.missions[0]!.bias; // setup, not an assertion: the F-12 criteria are stated at 0 m aim error
  if (!send(sim, gridAt({ x: x + offset.x - b.x, y: y + offset.y - b.y })).ok) throw new Error('loc ignored');
  answered(sim, 'loc');
  if (!send(sim, d).ok) throw new Error('desc ignored');
  answered(sim, 'desc');
  return sim;
}

/** Through the volley and well into the 효과 관측 without sending anything: 2,500 ticks, the last round over 5 s ago. */
export function toEffect(sim: Sim): void {
  let last = 0;
  for (let k = 0; k < 2500; k++) if (sim.step([]).events.some(isImpact)) last = sim.state.tick;
  if (last === 0 || sim.state.tick - last <= 100) throw new Error('not at the 효과 관측');
}

/** An infantry platoon walking in from 2 km north of the flat terrain's post: close enough to tell apart. */
export const NEAR = oneUnit({ type: 'inf', route: 'A', t0: 0 }, [{ x: 320, y: 2320 }, { x: 320, y: 1500 }, { x: 320, y: 600 }]);

/** Turns the binoculars on unit `pid`, finds it by a man in sight and watches it until its 적정 reaches `stage`. */
export function watch(sim: Sim, pid: number, stage: number): void {
  const p = sim.state.platoons[pid]!;
  const man = p.members.find((m) => m.alive && m.vis) ?? p.members.find((m) => m.alive)!;
  const at = angleTo(sim, man);
  sim.step([{ a: 'bino', v: [1] }, { a: 'cam', v: [Math.round(at.az + 64000) % 64000, Math.round(at.el)] }]);
  const seen = p.members.find((m) => m.alive && m.vis)!;
  if (!sim.step([idAt(angleTo(sim, seen))]).accepted[0]) throw new Error('id ignored');
  until(sim, () => p.intel.stage >= stage, 3000);
}
