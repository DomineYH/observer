// 사격요구 교신 (demo lines 692–818, 1440; PRD 4.3, 4.4): 통신 점검, the observer's three transmissions, 기러기's
// replies, the adjusting round and the corrections. 기러기's delays are drawn from the fdc stream when the observer
// sends, in the order the replies are queued; the bal stream gives each mission its bias at the call (2 draws) and each
// round its 공산오차 at the shot (2 gaussians). Both draw orders are part of the golden records.
import { drawBias, fall, shifted, snap, tofSec } from './ballistics';
import { fromGrid } from './grid';
import { schedule, type Act } from './queue';
import type { CorrectionSlots, DescriptionSlots, Fuze, LateralDir, MtoSlots, Next, RadioUtterance, RangeDir, Warning } from './radio';
import { next, type Stream } from './rng';
import { heightAt, type Point, type TerrainData } from './terrain';
import type { Mission, SimState } from './types';

export type Say = (u: RadioUtterance) => void;

/** What the procedure works with besides the state: its two streams, the ground, the battery and the event outlets. */
export interface Ctx {
  fdc: Stream;
  bal: Stream;
  terrain: TerrainData;
  battery: Point;
  say: Say;
  landed: (x: number, y: number) => void;
}

const TICKS_PER_S = 20;
/** A delay in seconds as whole ticks, rounded up: the demo runs an event in the first step at or past its time. */
export const secTicks = (sec: number) => Math.ceil(sec * TICKS_PER_S);
const BURST_TICKS = 320; // 탄착 섬광 and its smoke last 16 s
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
    s.missions.push({ warning, location: null, description: null, mto: null, bias, aim: null, direction: null, correction: null, flight: null, impacts: [] });
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
    m!.correction = correct(m!, v!);
    say({ speaker: 'observer', ending: 'over', kind: 'correction', slots: { ...m!.correction } });
    // Two draws, in this order: readback, 사격준비 끝.
    after(s, 2.5 + next(fdc) * 1.5, 'corr_readback');
    after(s, 11 + next(fdc) * 6, 'ready');
  } else if (a === 'fire' && stage === 'ready' && m!.warning === 'adjust' && m!.mto!.control === 'amc') {
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
    case 'ready': // 사격준비 끝: the fuze is named only when firing for effect at once (M1-9a fires those)
      say({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: m.warning === 'ffe' ? { fuze: m.mto!.fuze } : {} });
      s.radio.stage = 'ready';
      if (m.warning === 'adjust' && m.mto!.control === 'ready') after(s, 1.5, 'shot'); // 준비되는 대로
      break;
    case 'shot': { // 수정탄: the centre gun, one round, quick fuze
      const aim = m.aim!;
      const dx = aim.x - ctx.battery.x;
      const dy = aim.y - ctx.battery.y;
      const at = s.tick + secTicks(tofSec(Math.sqrt(dx * dx + dy * dy)));
      m.flight = { ...fall(aim, ctx.battery, m.bias, ctx.bal), at };
      say({ speaker: 'fdc', ending: 'over', kind: 'shot' });
      s.radio.stage = 'flight';
      after(s, 1.2, 'shot_readback');
      schedule(s, at, 'impact');
      break;
    }
    case 'shot_readback': // 하나발 떳다, 잠깐대기: the observer's readback goes out by itself
      say({ speaker: 'observer', ending: 'wait', kind: 'shot' });
      break;
    case 'impact': {
      const { x, y } = m.flight!;
      s.effects.push({ kind: 'burst', x, y, gz: heightAt(ctx.terrain, x, y), tick: s.tick, life: BURST_TICKS, pid: -1, small: false, vis: false });
      m.impacts.push({ x, y, tick: s.tick });
      m.flight = null;
      ctx.landed(x, y);
      after(s, 1.5, 'adjust_open');
      break;
    }
    case 'corr_readback':
      say({ speaker: 'fdc', ending: 'wait', kind: 'correction', slots: { ...m.correction! } });
      break;
    case 'adjust_open':
      s.radio.stage = 'adjust';
      break;
  }
}
