// 관측소 이동과 위치 보고 (demo lines 849–904, PRD 5.1, F-21): the walk to a new post, the 30 s equipment setup, and the
// 위치 보고 that tells 기러기 where the post now is (or its skipping). 기러기's delays draw from the fdc stream when the
// observer sends: one draw for the move notice's readback, one for the position report's.
import { fromGrid } from './grid';
import { exp } from './math';
import { onMap } from './prep';
import type { Ctx } from './procedure';
import { schedule, type Act } from './queue';
import { next } from './rng';
import { heightAt, underCanopy, type Point, type TerrainData } from './terrain';
import type { MovePlan, ReadonlySimState, SimState } from './types';

const TICKS_PER_S = 20;
const STEP_M = 20; // the walk is planned in equal steps of at most this
const SETUP_TICKS = 30 * TICKS_PER_S; // 장비 설치
const after = (s: SimState, sec: number, act: Act) => schedule(s, s.tick + Math.ceil(sec * TICKS_PER_S), act);

/** Why a move to `to` is refused, or null: not live, 지도 가장자리 (200 m on all four sides, B2), already moving or setting
 * up, or a 사격 임무 under way (the radio is neither before 감명 양호 nor idle). The ui shows the same reasons. */
export type MoveBlock = 'not_live' | 'edge' | 'moving' | 'setup' | 'mission';
export function moveCheck(s: ReadonlySimState, t: TerrainData, to: Point): MoveBlock | null {
  if (s.phase !== 'live') return 'not_live';
  if (!onMap(t, to.x, to.y)) return 'edge';
  if (s.post.state !== 'ready') return s.post.state;
  if (s.radio.stage !== 'off' && s.radio.stage !== 'idle') return 'mission';
  return null;
}

/** 도보 이동 (demo planMove): 토블러 6·exp(−3.5·|경사 + 0.05|) km/h × 장비 휴대 0.85 × 숲 0.7, step by step. */
export function planMove(t: TerrainData, from: Point, to: Point): MovePlan {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const n = Math.max(1, Math.ceil(dist / STEP_M));
  const seg = dist / n;
  const pts = [{ x: from.x, y: from.y, t: 0 }];
  let total = 0;
  let forest = 0;
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1]!;
    const x = from.x + (dx * i) / n;
    const y = from.y + (dy * i) / n;
    const grade = (heightAt(t, x, y) - heightAt(t, a.x, a.y)) / Math.max(1, seg);
    const inForest = underCanopy(t, x, y);
    if (inForest) forest += seg;
    const v = ((6 * exp(-3.5 * Math.abs(grade + 0.05))) / 3.6) * 0.85 * (inForest ? 0.7 : 1); // m/s
    total += seg / v;
    pts.push({ x, y, t: total });
  }
  return { to: { ...to }, pts, total, dist, forest };
}

/** `move` [동, 북] m: sets off from where the post stands; 기러기 is told, and must be told the new place on arrival. */
export function applyMove(s: SimState, ctx: Ctx, v: readonly number[]): boolean {
  const to = { x: v[0]!, y: v[1]! };
  if (moveCheck(s, ctx.terrain, to)) return false;
  s.post = { state: 'moving', move: planMove(ctx.terrain, s.op, to), departed: s.tick, until: 0, moves: s.post.moves + 1 };
  s.reportDue = true;
  s.bino = false; // 이동 중에는 육안만
  ctx.say({ speaker: 'observer', ending: 'over', kind: 'move_notice' });
  after(s, 2.5 + next(ctx.fdc), 'move_readback');
  return true;
}

/** One tick of the post: walks it along the plan, arrives, and ends the setup. */
export function updatePost(s: SimState, ctx: Ctx): void {
  const p = s.post;
  if (p.state === 'moving') {
    const m = p.move!;
    const done = (s.tick - p.departed) / TICKS_PER_S;
    if (done >= m.total) {
      s.op = { ...m.to };
      s.post = { ...p, state: 'setup', move: null, until: s.tick + SETUP_TICKS };
      ctx.note({ what: 'arrived' });
      return;
    }
    let i = 1;
    while (i < m.pts.length - 1 && m.pts[i]!.t < done) i++;
    const a = m.pts[i - 1]!;
    const b = m.pts[i]!;
    const f = Math.min(1, Math.max(0, (done - a.t) / Math.max(1e-6, b.t - a.t)));
    s.op = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  } else if (p.state === 'setup' && s.tick >= p.until) {
    s.post = { ...p, state: 'ready' };
    ctx.note({ what: 'set_up' });
  }
}

/** `pos` [동, 북] 4자리 or `pos_skip`, while a report is due, after arrival and setup. The report goes at an idle radio
 * (before 감명 양호 it would cross the radio check); the skip says nothing, so it also goes before 감명 양호. */
export function applyReport(s: SimState, ctx: Ctx, a: 'pos' | 'pos_skip', v: readonly number[] | undefined): boolean {
  const stage = s.radio.stage;
  if (s.phase !== 'live' || !s.reportDue || s.post.state !== 'ready') return false;
  if (a === 'pos_skip') {
    if (stage !== 'idle' && stage !== 'off') return false;
    s.reportDue = false; // 기러기 keeps converting 극좌표 from the post it knows
    return true;
  }
  if (stage !== 'idle') return false;
  const slots = { easting: v![0]!, northing: v![1]! };
  s.posReport = slots;
  ctx.say({ speaker: 'observer', ending: 'over', kind: 'position_report', slots });
  s.radio.stage = 'wait';
  after(s, 3 + next(ctx.fdc), 'pos_readback');
  return true;
}

/** Runs a due act of this module. */
export function runPostAct(s: SimState, ctx: Ctx, act: 'move_readback' | 'pos_readback'): void {
  if (act === 'move_readback') {
    ctx.say({ speaker: 'fdc', ending: 'over', kind: 'move_notice' });
    return;
  }
  const sent = s.posReport!;
  ctx.say({ speaker: 'fdc', ending: 'over', kind: 'position_report', slots: { ...sent } });
  s.knownOp = fromGrid(sent.easting, sent.northing, ctx.terrain.grid);
  s.reportDue = false;
  s.radio.stage = 'idle';
}
