// Fixtures for the radio procedure tests: an empty battlefield on the flat test terrain, started at its middle.
import { createSim, type ImpactEvent, type Input, type RadioEvent, type RadioKind, type Sim, type SimEvent, type Speaker } from '@sim';
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

const radio = (events: readonly SimEvent[]) => events.filter((e): e is RadioEvent => e.type === 'radio');

/** Steps `ticks` times with no input, collecting the radio events. */
export function radioEvents(sim: Sim, ticks: number): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let k = 0; k < ticks; k++) out.push(...radio(sim.step([]).events));
  return out;
}

/** Steps with no input until a round lands (at most `limit` ticks); returns the impact and the radio events before it. */
export function untilImpact(sim: Sim, limit = 2000): { impact: ImpactEvent; said: RadioEvent[] } {
  const said: RadioEvent[] = [];
  for (let k = 0; k < limit; k++) {
    const events = sim.step([]).events;
    said.push(...radio(events));
    const impact = events.find((e): e is ImpactEvent => e.type === 'impact');
    if (impact) return { impact, said };
  }
  throw new Error(`no impact in ${limit} ticks`);
}

/** Steps with no input until `speaker` has said `kind` (at most `limit` ticks); returns the radio events up to it. */
export function untilSaid(sim: Sim, speaker: Speaker, kind: RadioKind, limit = 2000): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let k = 0; k < limit; k++) {
    out.push(...radio(sim.step([]).events));
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
  return { ok: r.accepted[0]!, events: radio(r.events) };
}

export const CALL_ADJUST: Input = { a: 'call', v: ['adjust'] };
export const CALL_FFE: Input = { a: 'call', v: ['ffe'] };
export const LOC: Input = { a: 'loc', v: ['grid', 4720, 3150] }; // 7.2 km NE of the post, off the flat terrain
/** (505, 505) on the flat terrain: 260 m NE of the post at its middle. */
export const LOC_NEAR: Input = { a: 'loc', v: ['grid', 4050, 3050] };
/** 미상 표적, 포대 3발, no fuze asked, 준비되는 대로. */
export const DESC_UNKNOWN: Input = { a: 'desc', v: [3, 'none', 'ready', 0, 'unknown'] };
export const desc = (...v: (number | string)[]): Input => ({ a: 'desc', v });
/** 미상 표적, 포대 3발, 지명사. */
export const DESC_AMC: Input = desc(3, 'none', 'amc', 0, 'unknown');
export const FIRE: Input = { a: 'fire' };
export const corr = (...v: (number | string)[]): Input => ({ a: 'corr', v });

/** From an open radio, sends the three transmissions (waiting for each readback) and runs until 사격준비 끝. */
export function toReady(sim: Sim, d: Input = DESC_UNKNOWN, call: Input = CALL_ADJUST, loc: Input = LOC): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (const input of [call, loc, d]) {
    const r = send(sim, input);
    if (!r.ok) throw new Error(`${input.a} ignored`);
    out.push(...r.events, ...answered(sim, input.a as keyof typeof ANSWER));
  }
  return out;
}

/** Runs until the round lands and 1.5 s more: from the next step 기러기 takes a correction. */
export function toAdjust(sim: Sim): ImpactEvent {
  const { impact } = untilImpact(sim);
  radioEvents(sim, 30);
  return impact;
}
