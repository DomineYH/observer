// 관측소 발각과 보복 (demo lines 609–637, PRD 5.1): every 5 s an enemy unit that can see the post may find it; the
// enemy mortar (or, without it, direct fire from near) then shoots at where the post stood, and a round close enough
// puts the 관측반 out of action, which ends the operation 4 s later. Every draw is from the 발각 stream: one per unit
// in reach and in sight until one finds the post; per retaliation round two gaussians, then one only when it is close.
import { mortarFlash } from './enemy';
import type { Ctx } from './procedure';
import { schedule } from './queue';
import { gauss, next } from './rng';
import { EYE_HEIGHT, heightAt, lineOfSight, underCanopy } from './terrain';
import type { Platoon, SimState, Shooter } from './types';

export const EXPOSURE_TICKS = 100;
const REACH_M = 1100;
const COOLDOWN_TICKS = 150 * 20;
const DIRECT_M = 800; // 직사: infantry or APCs this near the found post
const SPREAD_M = 35;
const BURST_TICKS = 240;
// Rounds, first one after (s), then apart (s), and how near (m) puts the 관측반 out of action (70 %).
const SALVO: Record<Shooter, { n: number; first: number; gap: number; hit: number }> = {
  mortar: { n: 4, first: 60, gap: 4, hit: 25 },
  direct: { n: 6, first: 20, gap: 2, hit: 4 },
};
const MUZZLE_S = 35;
const LOST_SCORE = -400;
const END_S = 4;

const ticks = (sec: number) => Math.ceil(sec * 20);
const far = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
const alive = (p: Platoon) => p.members.some((q) => q.alive);

/** 발각 확률 of one unit per check: 0.12 × (1 − d/1.1 km), × 이동 중 1.8 · 숲 속 0.35 · 전선 전방 1.3 · 정찰조 1.6. */
export function exposureChance(d: number, f: { moving: boolean; canopy: boolean; forward: boolean; recon: boolean }): number {
  if (d >= REACH_M) return 0;
  return 0.12 * (1 - d / REACH_M) * (f.moving ? 1.8 : 1) * (f.canopy ? 0.35 : 1) * (f.forward ? 1.3 : 1) * (f.recon ? 1.6 : 1);
}

/** The 발각 check, every 100 ticks while the 관측반 lives: units in index order, the first that finds the post. */
export function exposureTick(s: SimState, ctx: Ctx): void {
  if (s.observerLost || s.tick % EXPOSURE_TICKS !== 0) return;
  const t = ctx.terrain;
  const eye = { ...s.op, z: heightAt(t, s.op.x, s.op.y) + EYE_HEIGHT };
  const flags = { moving: s.post.state === 'moving', canopy: underCanopy(t, s.op.x, s.op.y), forward: s.op.y > ctx.frontY };
  for (let pid = 0; pid < s.platoons.length; pid++) {
    const p = s.platoons[pid]!;
    if (p.state === 'wait' || p.state === 'destroyed' || p.type === 'mortar' || !alive(p)) continue;
    const d = far(p, s.op);
    if (d > REACH_M || !lineOfSight(t, eye, { x: p.x, y: p.y, z: heightAt(t, p.x, p.y) + 1.7 })) continue;
    if (next(ctx.exp) < exposureChance(d, { ...flags, recon: p.type === 'recon' })) {
      compromise(s, ctx, pid);
      return;
    }
  }
}

/** Unit `pid` found the post: unless one did within 150 s, the enemy fires at where it stands now. */
function compromise(s: SimState, ctx: Ctx, pid: number): void {
  if (s.compromised >= 0 && s.tick - s.compromised < COOLDOWN_TICKS) return;
  s.compromised = s.tick;
  const at = { ...s.op };
  const p = s.platoons[pid]!;
  const mi = s.platoons.findIndex((q) => q.type === 'mortar');
  const mo = s.platoons[mi];
  let shooter: Shooter | null = null;
  if (mo && mo.state !== 'destroyed' && mo.state !== 'broken' && mo.members.some((q) => q.kind === 'tube' && q.alive)) shooter = 'mortar';
  else if ((p.type === 'inf' || p.type === 'apc') && far(p, at) < DIRECT_M) shooter = 'direct';
  ctx.note({ what: 'compromised', pid, fire: shooter });
  if (!shooter) return;
  s.fire = { shooter, at, pid: shooter === 'mortar' ? mi : pid, fired: 0 };
  const salvo = SALVO[shooter];
  if (shooter === 'mortar') schedule(s, s.tick + ticks(MUZZLE_S), 'retaliation_muzzle');
  for (let k = 0; k < salvo.n; k++) schedule(s, s.tick + ticks(salvo.first + k * salvo.gap), 'retaliation');
}

/** 관측반 전투 불능 (once): −400, and the operation ends 4 s later. */
export function lose(s: SimState, ctx: Ctx, cause: Shooter | 'friendly'): void {
  if (s.observerLost) return;
  s.observerLost = true;
  s.score += LOST_SCORE;
  ctx.note({ what: 'lost', cause });
  schedule(s, s.tick + ticks(END_S), 'end');
}

/** Runs a due act of this module. */
export function runExposureAct(s: SimState, ctx: Ctx, act: 'retaliation' | 'retaliation_muzzle' | 'end'): void {
  if (act === 'end') {
    s.phase = 'ended';
    return;
  }
  const f = s.fire!;
  if (act === 'retaliation_muzzle') {
    if (!s.observerLost) mortarFlash(s, ctx.terrain, f.pid);
    return;
  }
  const k = f.fired++;
  const salvo = SALVO[f.shooter];
  if (f.fired === salvo.n) s.fire = null;
  if (s.observerLost) return;
  const x = f.at.x + gauss(ctx.exp) * SPREAD_M;
  const y = f.at.y + gauss(ctx.exp) * SPREAD_M;
  if (f.shooter === 'mortar')
    s.effects.push({ kind: 'burst', x, y, gz: heightAt(ctx.terrain, x, y), tick: s.tick, life: BURST_TICKS, pid: -1, small: true, vt: false, vis: false });
  const d = far({ x, y }, s.op);
  if (d < salvo.hit && next(ctx.exp) < 0.7) lose(s, ctx, f.shooter);
  else if (d < 120 && k === 0) ctx.note({ what: 'near_miss', fire: f.shooter });
}
