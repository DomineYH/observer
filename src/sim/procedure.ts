// 사격요구 교신 (demo lines 692–754, 1440; PRD 4.3, 4.4): 통신 점검, the observer's three transmissions and 기러기's
// replies. 기러기's delays are drawn from the fdc stream when the observer sends, in the order the replies are queued;
// that draw order is part of the golden records.
import { schedule, type Act } from './queue';
import type { DescriptionSlots, Fuze, MtoSlots, RadioUtterance, Warning } from './radio';
import { next, type Stream } from './rng';
import type { Mission, SimState } from './types';

export type Say = (u: RadioUtterance) => void;

const TICKS_PER_S = 20;
/** A delay in seconds as whole ticks, rounded up: the demo runs an event in the first step at or past its time. */
export const secTicks = (sec: number) => Math.ceil(sec * TICKS_PER_S);
const after = (s: SimState, sec: number, act: Act) => schedule(s, s.tick + secTicks(sec), act);

/** 작전 개시: 기러기 asks for a radio check 4 s later. */
export const openProcedure = (s: SimState) => after(s, 4, 'radio_check');

/** The `desc` values (inputs.ts) as slots: only the target's own slots are present. */
function descSlots(v: readonly (number | string)[]): DescriptionSlots {
  const [rounds, fuzeRequest, control, dangerClose, targetType, activity, unit, count] = v;
  const head = { rounds, fuzeRequest, control, dangerClose };
  const target = targetType === 'unknown' ? { targetType } : count === undefined ? { targetType, activity, unit } : { targetType, activity, unit, count };
  return { ...head, ...target } as DescriptionSlots;
}

/** 사격지휘통보 (demo decideMTO): 기러기 may put VT on exposed troops and fire one round fewer. Draws only where the
 * demo's short-circuits do. */
function decideMto(s: SimState, d: DescriptionSlots, fdc: Stream): MtoSlots {
  const exposed = 'activity' in d && (d.activity === 'attacking' || d.activity === 'moving');
  const ask = d.fuzeRequest;
  let fuze: Fuze = ask === 'vt' ? 'vt' : 'quick';
  if (ask === 'none') fuze = exposed && next(fdc) < 0.7 ? 'vt' : 'quick';
  else if (ask === 'quick' && exposed && next(fdc) < 0.35) fuze = 'vt';
  const rounds = d.rounds > 1 && next(fdc) < 0.15 ? d.rounds - 1 : d.rounds;
  return { fuze, rounds, control: d.control, targetNumber: ++s.radio.lastTn };
}

/** Applies `call`, `loc` or `desc` if the stage takes it; false means ignored and nothing changed. `v` is valid for
 * its kind. */
export function applyRadio(s: SimState, a: string, v: readonly (number | string)[], fdc: Stream, say: Say): boolean {
  const stage = s.radio.stage;
  const m = s.missions[s.missions.length - 1];
  if (a === 'call' && stage === 'idle') {
    const warning = v[0] as Warning;
    s.missions.push({ warning, location: null, description: null, mto: null });
    say({ speaker: 'observer', ending: 'over', kind: 'call', slots: { warning } });
    after(s, 2.5 + next(fdc) * 1.5, 'call_ack');
  } else if (a === 'loc' && stage === 'loc') {
    m!.location = { method: 'grid', easting: v[1] as number, northing: v[2] as number };
    say({ speaker: 'observer', ending: 'over', kind: 'location', slots: { ...m!.location } });
    after(s, 2.5 + next(fdc) * 1.5, 'loc_readback');
  } else if (a === 'desc' && stage === 'desc') {
    m!.description = descSlots(v);
    say({ speaker: 'observer', ending: 'over', kind: 'description', slots: { ...m!.description } });
    // Three draws, in this order: readback, 사격지휘통보, 사격준비 끝.
    after(s, 3 + next(fdc) * 1.5, 'desc_readback');
    after(s, 9 + next(fdc) * 3, 'mto');
    after(s, 24 + next(fdc) * 14, 'ready');
  } else return false;
  s.radio.stage = 'wait';
  return true;
}

/** Runs one due act. */
export function runAct(s: SimState, act: Act, fdc: Stream, say: Say): void {
  const m: Mission = s.missions[s.missions.length - 1]!;
  switch (act) {
    case 'radio_check':
      say({ speaker: 'fdc', ending: 'over', kind: 'radio_check' });
      after(s, 1.5, 'check_reply');
      break;
    case 'check_reply': // 감명 양호: the observer's answer goes out by itself (no input kind for it)
      say({ speaker: 'observer', ending: 'over', kind: 'radio_check_reply' });
      s.radio.stage = 'idle';
      break;
    case 'call_ack':
      say({ speaker: 'fdc', ending: 'over', kind: 'call_ack', slots: { warning: m.warning } });
      s.radio.stage = 'loc';
      break;
    case 'loc_readback':
      say({ speaker: 'fdc', ending: 'over', kind: 'location', slots: { ...m.location! } });
      s.radio.stage = 'desc';
      break;
    case 'desc_readback':
      say({ speaker: 'fdc', ending: 'wait', kind: 'description', slots: { ...m.description! } });
      break;
    case 'mto':
      m.mto = decideMto(s, m.description!, fdc);
      say({ speaker: 'fdc', ending: 'wait', kind: 'mto', slots: { ...m.mto } });
      break;
    case 'ready': // 사격준비 끝: the fuze is named only when firing for effect at once (M1-8b fires)
      say({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: m.warning === 'ffe' ? { fuze: m.mto!.fuze } : {} });
      s.radio.stage = 'ready';
      break;
  }
}
