// Fixtures for the radio procedure tests: an empty battlefield on the flat test terrain, started at its middle.
import { createSim, type Input, type RadioEvent, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { init, START } from './init';

/** A started simulation with no enemy, so only the radio procedure draws from the streams. */
export function started(seed = 7): Sim {
  const sim = createSim({ ...init(seed), scenario: { ...BASE_SCENARIO, units: [] } });
  sim.step([START]);
  return sim;
}

/** A twin that never started, for the prep tests. */
export const unstarted = (seed = 7): Sim => createSim({ ...init(seed), scenario: { ...BASE_SCENARIO, units: [] } });

/** Steps `ticks` times with no input, collecting the radio events. */
export function radioEvents(sim: Sim, ticks: number): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let k = 0; k < ticks; k++) out.push(...sim.step([]).events);
  return out;
}

/** Steps with no input until `done` holds (at most `limit` ticks), collecting the radio events. */
export function until(sim: Sim, done: () => boolean, limit = 2000): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let k = 0; k < limit; k++) {
    if (done()) return out;
    out.push(...sim.step([]).events);
  }
  throw new Error(`condition not met in ${limit} ticks`);
}

/** Runs until the radio check is answered and 기러기 takes calls. */
export const openRadio = (sim: Sim) => until(sim, () => sim.state.radio.stage === 'idle');

/** Sends one input; returns whether it was accepted and the step's events. */
export function send(sim: Sim, input: Input): { ok: boolean; events: RadioEvent[] } {
  const r = sim.step([input]);
  return { ok: r.accepted[0]!, events: [...r.events] };
}

export const CALL_ADJUST: Input = { a: 'call', v: ['adjust'] };
export const CALL_FFE: Input = { a: 'call', v: ['ffe'] };
export const LOC: Input = { a: 'loc', v: ['grid', 4720, 3150] };
/** 미상 표적, 포대 3발, no fuze asked, 준비되는 대로. */
export const DESC_UNKNOWN: Input = { a: 'desc', v: [3, 'none', 'ready', 0, 'unknown'] };
export const desc = (...v: (number | string)[]): Input => ({ a: 'desc', v });

/** From an open radio, sends the three transmissions (waiting for each readback) and runs until 사격준비 끝. */
export function toReady(sim: Sim, d: Input = DESC_UNKNOWN, call: Input = CALL_ADJUST): RadioEvent[] {
  const out: RadioEvent[] = [];
  const stage = (s: string) => () => sim.state.radio.stage === s;
  for (const [input, next] of [
    [call, 'loc'],
    [LOC, 'desc'],
    [d, 'ready'],
  ] as const) {
    const r = send(sim, input);
    if (!r.ok) throw new Error(`${input.a} ignored`);
    out.push(...r.events, ...until(sim, stage(next)));
  }
  return out;
}
