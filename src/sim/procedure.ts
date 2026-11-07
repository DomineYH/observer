// 사격요구 교신 (demo lines 692–833, 1440; PRD 4.3, 4.4): 통신 점검, the observer's three transmissions, 기러기's
// replies, the adjusting round, the corrections, 효력사, and the 전과 보고 after it (재효력사 · 임무끝 · 수정 후 효력사).
// 기러기's delays are drawn from the fdc stream when the observer sends, in the order the replies are queued (재효력사:
// one draw, only for 접근신관), and each 효력사 round's firing jitter at the shot; the bal stream
// gives each mission its bias at the call (2 draws) and each round its 공산오차 at the shot (2 gaussians), the 효력사
// rounds gun by gun and round by round within a gun; a 전이 keeps the last mission's bias (no draw). Both draw orders
// are part of the golden records.
import { drawBias, fall, SHEAF, shifted, snap, tofSec } from './ballistics';
import { announceDanger, markDanger, overCap } from './danger';
import { lose } from './exposure';
import { fromGrid } from './grid';
import { strike } from './lethality';
import { schedule, type Act } from './queue';
import { noteDirection, noteImpact, noteTarget, report } from './report';
import { EFFECTS, type Corrections, type CorrectionSlots, type DescriptionSlots, type Effect, type Flag, type Fuze, type LateralDir, type MtoSlots, type RadioUtterance, type RangeDir, type ShiftSlots, type Warning } from './radio';
import { next, type Stream } from './rng';
import { corrections, corrSlots, descSlots, targetSlots } from './slots';
import { heightAt, type Point, type TerrainData } from './terrain';
import type { Flight, Mission, PostNote, SimState } from './types';

export type Say = (u: RadioUtterance) => void;

/** What the procedure works with besides the state: its two streams, the ground, the battery and the event outlets. */
export interface Ctx {
  fdc: Stream;
  bal: Stream;
  exp: Stream; // 발각 and the retaliation
  frontY: number; // 아군 전선, north m
  terrain: TerrainData;
  battery: Point;
  say: Say;
  landed: (x: number, y: number, fuze: Fuze) => void;
  note: (n: PostNote) => void;
  friends: readonly Point[]; // 아군 진지, for 위험근접
}

const TICKS_PER_S = 20;
/** A delay in seconds as whole ticks, rounded up: the demo runs an event in the first step at or past its time. */
export const secTicks = (sec: number) => Math.ceil(sec * TICKS_PER_S);
const BURST_TICKS = 320; // 탄착 섬광 and its smoke last 16 s
const GUN_INTERVAL_S = 9; // 효력사: each gun fires a round every 9 s …
const GUN_JITTER_S = 2.2; // … each round up to 2.2 s late
const after = (s: SimState, sec: number, act: Act) => schedule(s, s.tick + secTicks(sec), act);
const POST_HIT_M = 45;
const dist = (x: number, y: number, p: Point) => Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y));

/** 작전 개시: 기러기 asks for a radio check 4 s later. */
export const openProcedure = (s: SimState) => after(s, 4, 'radio_check');

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

/** The aim moved by a 수정량 along the 방향 (기준선): right and add positive. */
function moved(aim: Point, direction: number, c: Corrections): Point {
  const lateral = c.lateral ?? 0;
  const range = c.range ?? 0;
  return shifted(aim, direction, c.lateralDir === 'right' ? lateral : -lateral, c.rangeDir === 'add' ? range : -range);
}

/** 수정 taken: keeps the first 방향 as the 기준선 and moves the aim along it. */
function correct(m: Mission, c: CorrectionSlots): CorrectionSlots {
  if (c.direction !== undefined) m.direction = c.direction;
  m.corrections++;
  if (c.range !== undefined) m.rangeCorrections.push(c.range);
  m.aim = moved(m.aim!, m.direction!, c);
  return c;
}

/** A new mission as the call or the 전이 opens it. */
const newMission = (s: SimState, warning: Warning, bias: Point): Mission => ({
  warning, phase: warning, location: null, description: null, mto: null, bias, aim: null, direction: null, correction: null,
  flights: [], impacts: [], kills: s.platoons.map(() => null), target: -1, firstError: null, directionError: null,
  rangeCorrections: [], corrections: 0, report: null, truth: null, truthPct: -1, score: 0, dangerClose: false,
  dangerMissed: false, shift: null,
});

/** Applies `call`, `loc`, `desc`, `fire`, `corr`, `repeat`, `eom` or `shift` if the stage takes it; false means ignored and nothing changed. `v` is valid for
 * its kind. */
export function applyRadio(s: SimState, ctx: Ctx, a: string, v: readonly (number | string)[] | undefined): boolean {
  const { fdc, say } = ctx;
  const stage = s.radio.stage;
  const m = s.missions[s.missions.length - 1];
  // 사격요구 waits for a set-up post that 기러기 knows (or was told to keep): moving, setting up, or before the
  // 위치 보고 or its skipping, neither a call nor a 전이 goes (demo 713; its ui hides the 전이 then).
  if ((a === 'call' || a === 'shift') && (s.post.state !== 'ready' || s.reportDue)) return false;
  if (a === 'call' && stage === 'idle') {
    const warning = v![0] as Warning;
    const bias = drawBias(ctx.bal);
    s.missions.push(newMission(s, warning, bias));
    say({ speaker: 'observer', ending: 'over', kind: 'call', slots: { warning } });
    after(s, 2.5 + next(fdc) * 1.5, 'call_ack');
  } else if (a === 'loc' && stage === 'loc') {
    if (v![0] === 'grid') {
      m!.location = { method: 'grid', easting: v![1] as number, northing: v![2] as number };
      m!.aim = fromGrid(m!.location.easting, m!.location.northing, ctx.terrain.grid);
      noteTarget(s, m!);
    } else {
      // 극좌표법 (demo sendLoc): from the post 기러기 knows; the 방위각 is the mission's 방향 (demo setDir).
      const azimuth = v![1] as number;
      m!.location = { method: 'polar', azimuth, distance: snap(v![2] as number, 10) };
      m!.aim = shifted(s.knownOp, azimuth, 0, m!.location.distance);
      noteTarget(s, m!);
      m!.direction = azimuth;
      noteDirection(s, m!);
    }
    say({ speaker: 'observer', ending: 'over', kind: 'location', slots: { ...m!.location } });
    after(s, 2.5 + next(fdc) * 1.5, 'loc_readback');
  } else if (a === 'desc' && stage === 'desc') {
    m!.description = descSlots(v!);
    markDanger(s, m!, ctx.friends);
    say({ speaker: 'observer', ending: 'over', kind: 'description', slots: { ...m!.description } });
    // Three draws, in this order: readback, 사격지휘통보, 사격준비 끝.
    after(s, 3 + next(fdc) * 1.5, 'desc_readback');
    after(s, 9 + next(fdc) * 3, 'mto');
    after(s, 24 + next(fdc) * 14, 'ready');
  } else if (
    a === 'corr' &&
    (stage === 'adjust' || stage === 'effect') &&
    (stage === 'effect') === (EFFECTS as readonly unknown[]).includes(v!.at(-1)) &&
    (typeof v![0] === 'number') === (m!.direction === null)
  ) {
    // The guards: 효과 exactly when sent after 효력사 (수정 후 효력사), and 방향 only with the mission's first correction,
    // so a 바로 효력사 mission sends it here (B1). A corr breaking one is rejected, not trimmed, so the accepted record
    // stays canonical (ADR 0003); the composer never sends it.
    const sent = corrSlots(m!, v!);
    if (overCap(m!, sent)) {
      // 위험근접, over 100 m: an accepted input 기러기 refuses. Checked before the 전과 보고 so a refused send scores
      // nothing (B1: once per report 기러기 takes; else each oversized send would farm +30).
      say({ speaker: 'observer', ending: 'over', kind: 'correction', slots: sent });
      after(s, 2.5, 'dc_resend');
      s.radio.stage = 'wait';
      return true;
    }
    if (stage === 'effect') report(s, m!, v!.at(-1) as Effect);
    const first = m!.direction === null;
    m!.correction = correct(m!, sent);
    if (first) noteDirection(s, m!);
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
  } else if (a === 'repeat' && stage === 'effect') {
    // 재효력사 (demo sendRepeat): the same aim, `rounds` per gun. 기러기 may put 순발 on instead of 접근 to save 10 s of
    // fuze setting: one draw, only for 접근.
    const [effect, rounds] = v as [Effect, number];
    say({ speaker: 'observer', ending: 'over', kind: 'repeat', slots: { ...report(s, m!, effect), effect, rounds } });
    const mto = m!.mto!;
    mto.rounds = rounds;
    let prep = 20;
    if (mto.fuze === 'vt' && next(fdc) < 0.5) {
      mto.fuze = 'quick';
      prep = 10;
    }
    after(s, 3, 'repeat_ack');
    after(s, 3 + prep, 'ready');
  } else if (a === 'eom' && stage === 'effect') {
    const effect = v![0] as Effect;
    say({ speaker: 'observer', ending: 'none', kind: 'end_of_mission', slots: { ...report(s, m!, effect), effect } });
    s.radio.stage = 'idle'; // 기러기 does not answer 임무끝 (demo); the next call starts a new mission
    return true;
  } else if (a === 'shift' && stage === 'idle' && m) {
    // 전이사격 (demo sendShift, lines 834–848): idle with a mission only after its 임무끝. The new mission fires for
    // effect from the last aim moved along the sent 방향, with the last bias (no draw); 기러기 picks fuze and rounds
    // as for a 표적성질 with no fuze asked, 준비되는 대로 (demo reqFuze '', amc false).
    const [direction, lateralDir, rawLat, rangeDir, rawRng, rounds, dangerClose] = v as [number, LateralDir, number, RangeDir, number, number, Flag];
    const target = targetSlots(v!.slice(7));
    const c = corrections(lateralDir, rawLat, rangeDir, rawRng);
    const n = newMission(s, 'ffe', { ...m.bias });
    n.shift = { targetNumber: m.mto!.targetNumber, direction, ...c, ...target, rounds, dangerClose } as ShiftSlots;
    n.description = { rounds, fuzeRequest: 'none', control: 'ready', dangerClose, ...target } as DescriptionSlots;
    n.aim = moved(m.aim!, direction, c);
    n.direction = direction;
    s.missions.push(n);
    noteTarget(s, n);
    noteDirection(s, n);
    markDanger(s, n, ctx.friends);
    say({ speaker: 'observer', ending: 'over', kind: 'shift', slots: { ...n.shift } });
    // Two draws, in this order: 사격지휘통보, 사격준비 끝 (the readback comes at a fixed 3 s).
    after(s, 3, 'shift_readback');
    after(s, 9 + next(fdc) * 3, 'mto');
    after(s, 20 + next(fdc) * 8, 'ready');
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
      announceDanger(s, m, say);
      break;
    case 'shift_readback': // then the 위험근접 notices, as for a 표적성질 (B4)
      say({ speaker: 'fdc', ending: 'wait', kind: 'shift', slots: { ...m.shift! } });
      announceDanger(s, m, say);
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
      s.effects.push({ kind: 'burst', x, y, gz: heightAt(ctx.terrain, x, y), tick: s.tick, life: BURST_TICKS, pid: -1, small: false, vt: fuze === 'vt', tiny: false, vis: false });
      m.impacts.push({ x, y, tick: s.tick });
      strike(s, x, y, fuze, ctx.bal, m.kills);
      // 아군 포탄 오사 (demo 659): within 45 m of the post, 60 % (a 탄도 draw only then)
      if (dist(x, y, s.op) < POST_HIT_M && next(ctx.bal) < 0.6) lose(s, ctx, 'friendly');
      ctx.landed(x, y, fuze);
      if (m.phase === 'adjust') {
        noteImpact(s, m, { x, y });
        after(s, 1.5, 'adjust_open');
      }
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
    case 'repeat_ack':
      say({ speaker: 'fdc', ending: 'wait', kind: 'repeat_ack', slots: { rounds: m.mto!.rounds } });
      break;
    case 'adjust_open':
      s.radio.stage = 'adjust';
      break;
    case 'dc_resend': // 수정량 100 이하로 재송신: back where the refused correction came from
      say({ speaker: 'fdc', ending: 'over', kind: 'danger_close_resend' });
      s.radio.stage = m.phase === 'ffe' ? 'effect' : 'adjust';
      break;
  }
}
