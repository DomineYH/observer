// 사격요구 교신 (demo lines 692–818, 1440; PRD 4.3, 4.4): 통신 점검, the observer's three transmissions, 기러기's
// replies, the adjusting round, the corrections and 효력사. 기러기's delays are drawn from the fdc stream when the
// observer sends, in the order the replies are queued, and each 효력사 round's firing jitter at the shot; the bal stream
// gives each mission its bias at the call (2 draws) and each round its 공산오차 at the shot (2 gaussians), the 효력사
// rounds gun by gun and round by round within a gun. Both draw orders are part of the golden records.
import { drawBias, fall, SHEAF, shifted, snap, tofSec } from './ballistics';
import { fromGrid } from './grid';
import { strike } from './lethality';
import { schedule, type Act } from './queue';
import type { CorrectionSlots, DescriptionSlots, Fuze, LateralDir, MtoSlots, Next, RadioUtterance, RangeDir, Warning } from './radio';
import { next, type Stream } from './rng';
import { heightAt, type Point, type TerrainData } from './terrain';
import type { Flight, Mission, SimState } from './types';

export type Say = (u: RadioUtterance) => void;

/** What the procedure works with besides the state: its two streams, the ground, the battery and the event outlets. */
export interface Ctx {
  fdc: Stream;
  bal: Stream;
  terrain: TerrainData;
  battery: Point;
  say: Say;
  landed: (x: number, y: number, fuze: Fuze) => void;
}

const TICKS_PER_S = 20;
/** A delay in seconds as whole ticks, rounded up: the demo runs an event in the first step at or past its time. */
export const secTicks = (sec: number) => Math.ceil(sec * TICKS_PER_S);
const BURST_TICKS = 320; // 탄착 섬광 and its smoke last 16 s
const GUN_INTERVAL_S = 9; // 효력사: each gun fires a round every 9 s …
const GUN_JITTER_S = 2.2; // … each round up to 2.2 s late
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

/** 수정 (demo sendCorr, lines 799–818): snaps to 10 m across and 50 m in range, keeps the first 방향 as the 기준선 and
 * moves the aim along it. An axis that snaps to 0 is left out; both out reads 동제원. */
function correct(m: Mission, v: readonly (number | string)[]): CorrectionSlots {
  const first = m.direction === null;
  const [lateralDir, rawLat, rangeDir, rawRng, nextStep] = (first ? v.slice(1) : v) as [LateralDir, number, RangeDir, number, Next];
  if (first) m.direction = v[0] as number;
  const lateral = snap(rawLat, 10);
  const range = snap(rawRng, 50);
  m.aim = shifted(m.aim!, m.direction!, lateralDir === 'right' ? lateral : -lateral, rangeDir === 'add' ? range : -range);
  return {
    ...(first ? { direction: m.direction! } : {}),
    ...(lateral > 0 ? { lateralDir, lateral } : {}),
    ...(range > 0 ? { rangeDir, range } : {}),
    next: nextStep,
  } as CorrectionSlots;
}

/** Applies `call`, `loc`, `desc`, `fire` or `corr` if the stage takes it; false means ignored and nothing changed. `v` is valid for
 * its kind. */
export function applyRadio(s: SimState, ctx: Ctx, a: string, v: readonly (number | string)[] | undefined): boolean {
  const { fdc, say } = ctx;
  const stage = s.radio.stage;
  const m = s.missions[s.missions.length - 1];
  if (a === 'call' && stage === 'idle') {
    const warning = v![0] as Warning;
    const bias = drawBias(ctx.bal);
    s.missions.push({ warning, phase: warning, location: null, description: null, mto: null, bias, aim: null, direction: null, correction: null, flights: [], impacts: [], kills: s.platoons.map(() => null) });
    say({ speaker: 'observer', ending: 'over', kind: 'call', slots: { warning } });
    after(s, 2.5 + next(fdc) * 1.5, 'call_ack');
  } else if (a === 'loc' && stage === 'loc') {
    m!.location = { method: 'grid', easting: v![1] as number, northing: v![2] as number };
    m!.aim = fromGrid(m!.location.easting, m!.location.northing, ctx.terrain.grid);
    say({ speaker: 'observer', ending: 'over', kind: 'location', slots: { ...m!.location } });
    after(s, 2.5 + next(fdc) * 1.5, 'loc_readback');
  } else if (a === 'desc' && stage === 'desc') {
    m!.description = descSlots(v!);
    say({ speaker: 'observer', ending: 'over', kind: 'description', slots: { ...m!.description } });
    // Three draws, in this order: readback, 사격지휘통보, 사격준비 끝.
    after(s, 3 + next(fdc) * 1.5, 'desc_readback');
    after(s, 9 + next(fdc) * 3, 'mto');
    after(s, 24 + next(fdc) * 14, 'ready');
  } else if (a === 'corr' && stage === 'adjust' && (typeof v![0] === 'number') === (m!.direction === null)) {
    // The guard: 방향 only with the first correction. A later corr carrying one is rejected, not trimmed, so the accepted
    // record stays canonical (ADR 0003); the composer never sends it.
    m!.correction = correct(m!, v!);
    say({ speaker: 'observer', ending: 'over', kind: 'correction', slots: { ...m!.correction } });
    // Two draws, in this order: readback, 사격준비 끝 (효력사 takes longer: the fuzes are set for the whole battery).
    after(s, 2.5 + next(fdc) * 1.5, 'corr_readback');
    if (m!.correction.next === 'ffe') {
      m!.phase = 'ffe';
      after(s, 14 + next(fdc) * 8, 'ready');
    } else after(s, 11 + next(fdc) * 6, 'ready');
  } else if (a === 'fire' && stage === 'ready' && m!.mto!.control === 'amc') {
    say({ speaker: 'observer', ending: 'none', kind: 'fire' });
    after(s, 1 + next(fdc), 'shot');
  } else return false;
  s.radio.stage = 'wait';
  return true;
}

/** Runs one due act. */
export function runAct(s: SimState, ctx: Ctx, act: Act): void {
  const { fdc, say } = ctx;
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
    case 'ready': // 사격준비 끝: the fuze is named only for 효력사
      say({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: m.phase === 'ffe' ? { fuze: m.mto!.fuze } : {} });
      s.radio.stage = 'ready';
      if (m.mto!.control === 'ready') after(s, 1.5, 'shot'); // 준비되는 대로
      break;
    case 'shot': {
      const aim = m.aim!;
      const dx = aim.x - ctx.battery.x;
      const dy = aim.y - ctx.battery.y;
      const tof = tofSec(Math.sqrt(dx * dx + dy * dy));
      say({ speaker: 'fdc', ending: 'over', kind: 'shot' });
      s.radio.stage = 'flight';
      after(s, 1.2, 'shot_readback');
      if (m.phase === 'adjust') { // 수정탄: the centre gun, one round, quick fuze
        const at = s.tick + secTicks(tof);
        m.flights = [{ ...fall(aim, ctx.battery, m.bias, ctx.bal), at, fuze: 'quick' }];
        schedule(s, at, 'impact');
        break;
      }
      // 효력사: six guns, `rounds` each, 9 s apart with a jitter; every round laid now (fdc jitter, then bal 공산오차).
      let last = 0;
      for (const sheaf of SHEAF)
        for (let k = 0; k < m.mto!.rounds; k++) {
          const dt = k * GUN_INTERVAL_S + next(fdc) * GUN_JITTER_S;
          last = Math.max(last, dt);
          const f: Flight = { ...fall(aim, ctx.battery, m.bias, ctx.bal, sheaf), at: s.tick + secTicks(dt + tof), fuze: m.mto!.fuze };
          let i = m.flights.length;
          while (i > 0 && m.flights[i - 1]!.at > f.at) i--;
          m.flights.splice(i, 0, f);
          schedule(s, f.at, 'impact');
        }
      const done = s.tick + secTicks(last + 2.3); // 마감탄 떳다, 2.3 s after the last gun fired
      schedule(s, done, 'rounds_complete');
      // 효과 관측 2.5 s after the last round lands, and not before 2 s after 마감탄 떳다
      schedule(s, Math.max(done + secTicks(2), m.flights.at(-1)!.at + secTicks(2.5)), 'effect_open');
      break;
    }
    case 'shot_readback': // 하나발 떳다, 잠깐대기: the observer's readback goes out by itself
      say({ speaker: 'observer', ending: 'wait', kind: 'shot' });
      break;
    case 'impact': {
      const { x, y, fuze } = m.flights.shift()!;
      s.effects.push({ kind: 'burst', x, y, gz: heightAt(ctx.terrain, x, y), tick: s.tick, life: BURST_TICKS, pid: -1, small: false, vt: fuze === 'vt', vis: false });
      m.impacts.push({ x, y, tick: s.tick });
      strike(s, x, y, fuze, ctx.bal, m.kills);
      ctx.landed(x, y, fuze);
      if (m.phase === 'adjust') after(s, 1.5, 'adjust_open');
      break;
    }
    case 'rounds_complete':
      say({ speaker: 'fdc', ending: 'over', kind: 'rounds_complete' });
      after(s, 1.2, 'rounds_complete_readback');
      break;
    case 'rounds_complete_readback': // 마감탄 떳다, 잠깐대기: the observer's readback goes out by itself
      say({ speaker: 'observer', ending: 'wait', kind: 'rounds_complete' });
      break;
    case 'effect_open':
      s.radio.stage = 'effect';
      break;
    case 'corr_readback':
      say({ speaker: 'fdc', ending: 'wait', kind: 'correction', slots: { ...m.correction! } });
      break;
    case 'adjust_open':
      s.radio.stage = 'adjust';
      break;
  }
}
