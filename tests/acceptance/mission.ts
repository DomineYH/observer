// Fixtures for the radio procedure tests: an empty battlefield on the flat test terrain, started at its middle.
import { createSim, type Input, type RadioEvent, type RadioKind, type Sim, type Speaker } from '@sim';
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

/** Steps with no input until `speaker` has said `kind` (at most `limit` ticks); returns the radio events up to it. */
export function untilSaid(sim: Sim, speaker: Speaker, kind: RadioKind, limit = 2000): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let k = 0; k < limit; k++) {
    out.push(...sim.step([]).events);
    if (out.some((e) => e.utterance.speaker === speaker && e.utterance.kind === kind)) return out;
  }
  throw new Error(`${speaker} ${kind} not said in ${limit} ticks`);
}

/** Runs until 감명 양호 has gone out: from the next step 기러기 takes calls. */
export const openRadio = (sim: Sim) => untilSaid(sim, 'observer', 'radio_check_reply');

/** 기러기's answer that lets the next transmission go: call → 호출 복창, loc → 좌표 복창, desc → 사격준비 끝. */
export const ANSWER = { call: 'call_ack', loc: 'location', desc: 'ready' } as const satisfies Record<string, RadioKind>;
export const answered = (sim: Sim, a: keyof typeof ANSWER) => untilSaid(sim, 'fdc', ANSWER[a]);

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
  for (const input of [call, LOC, d]) {
    const r = send(sim, input);
    if (!r.ok) throw new Error(`${input.a} ignored`);
    out.push(...r.events, ...answered(sim, input.a as keyof typeof ANSWER));
  }
  return out;
}
