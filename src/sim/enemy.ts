// 적 AI (demo lines 451–502): how each unit moves, deploys, halts and fires, one tick at a time, and where its members
// stand, and how it reacts to our rounds (pinned, broken, destroyed: lethality.ts decides those). Overrunning, mortar
// impacts and APC fire damage come with the friendly-losses slice.
import { atan2, cos, exp, sin } from './math';
import { next, type Stream } from './rng';
import { heightAt, type TerrainData } from './terrain';
import type { FieldEffect, Platoon, SimState } from './types';

const DT = 0.05; // seconds per tick
const TICKS_PER_S = 20;
const DEPLOY_M = 1500; // infantry deploys from column into line inside this distance of its objective
const DEPLOY_S = 20; // … converging with this time constant
const ASSAULT_M = 900; // 돌격선
const APC_HALT_M = 1300;
const MORTAR_FIRST_TICK = 210 * TICKS_PER_S;
const DUST_TICKS = 30; // a moving vehicle raises dust every 1.5 s
const LIFE = { dust: 9 * TICKS_PER_S, apcMuzzle: 3 * TICKS_PER_S, mortarMuzzle: 11 * TICKS_PER_S };
const WAYPOINT_M = 25;

const ticks = (s: number) => Math.round(s * TICKS_PER_S);
const toGoal = (p: Platoon) => {
  const f = p.path[p.path.length - 1]!;
  return Math.sqrt((f.x - p.x) * (f.x - p.x) + (f.y - p.y) * (f.y - p.y));
};

// Reaching a waypoint spends the tick: the unit turns to the next one without moving (demo moveAlong).
function moveAlong(p: Platoon, speed: number): void {
  const tgt = p.path[p.wp]!;
  const dx = tgt.x - p.x;
  const dy = tgt.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < WAYPOINT_M && p.wp < p.path.length - 1) {
    p.wp++;
    return;
  }
  if (d > 1) {
    p.dir = atan2(dx, dy);
    const st = Math.min(d, speed * DT);
    p.x += (dx / d) * st;
    p.y += (dy / d) * st;
  }
}

/** Places every member from the unit's centre, heading and formation; men sway while it moves. */
export function layout(p: Platoon, tick: number, speed: number): void {
  const c = cos(p.dir);
  const s = sin(p.dir);
  const f = p.form;
  const g = 1 - f;
  const t = tick * DT;
  const pinned = tick < p.pinnedUntil;
  p.members.forEach((q, i) => {
    q.prone = q.kind === 'man' && (!q.alive || pinned || p.state === 'destroyed' || (p.type === 'recon' && p.state === 'hold' && i > 0));
    const sway = speed > 0 && q.kind === 'man' ? sin(t * 1.3 + q.ph) * 2 : 0;
    const uu = q.u * f + q.uc * g + sway;
    const vv = q.v * f + q.vc * g;
    q.x = p.x + uu * c + vv * s;
    q.y = p.y - uu * s + vv * c;
  });
}

function emit(st: SimState, t: TerrainData, p: Platoon, pid: number, kind: FieldEffect['kind'], of: 'veh' | 'tube', lift: number, life: number, small: boolean): void {
  for (const q of p.members)
    if (q.kind === of && q.alive) st.effects.push({ kind, x: q.x, y: q.y, gz: heightAt(t, q.x, q.y) + lift, tick: st.tick, life, pid, small, vt: false, tiny: false, vis: false });
}

/** 사격 섬광 of the mortar section's live tubes. */
export const mortarFlash = (st: SimState, t: TerrainData, pid: number) => emit(st, t, st.platoons[pid]!, pid, 'muzzle', 'tube', 1, LIFE.mortarMuzzle, false);

/** A mortar section fires its live tubes while two of its crew live. */
const canFire = (p: Platoon) => p.members.some((q) => q.kind === 'tube' && q.alive) && p.members.filter((q) => q.kind === 'man' && q.alive).length >= 2;

/** One tick of unit `pid`. Draws only from the enemy-action stream. */
export function updatePlatoon(st: SimState, t: TerrainData, ai: Stream, pid: number): void {
  const p = st.platoons[pid]!;
  const tick = st.tick;
  if (p.state === 'wait') {
    if (tick < p.t0) return;
    p.state = p.type === 'mortar' ? 'emplaced' : 'approach';
  }
  const pinned = tick < p.pinnedUntil;
  let speed = 0;
  if (p.type === 'inf' && (p.state === 'approach' || p.state === 'assault')) {
    const dist = toGoal(p);
    if (p.state === 'approach' && dist < ASSAULT_M) {
      p.state = 'assault';
      p.assaultTick = tick;
    }
    // 접근 2.2 m/s; 돌격 3.1 m/s tiring towards 1.9 m/s
    speed = p.state === 'approach' ? 2.2 : 1.9 + 1.2 * exp(-((tick - p.assaultTick) * DT) / 120);
    const want = dist < DEPLOY_M ? 1 : 0;
    p.form += (want - p.form) * Math.min(1, DT / DEPLOY_S);
  } else if (p.type === 'recon' && p.state === 'approach') {
    speed = 1.4;
    if (p.wp >= 2) p.state = 'hold';
  } else if (p.type === 'apc') {
    if (p.state === 'approach') {
      speed = 5;
      if (toGoal(p) < APC_HALT_M) {
        p.state = 'support';
        p.nextFire = tick + ticks(6);
      }
    } else if (p.state === 'support' && tick >= p.nextFire) {
      p.nextFire = tick + ticks(8 + next(ai) * 8);
      p.lastFire = tick;
      emit(st, t, p, pid, 'muzzle', 'veh', 1.5, LIFE.apcMuzzle, true);
    }
  } else if (p.type === 'mortar' && p.state === 'emplaced' && tick >= MORTAR_FIRST_TICK && tick >= p.nextFire && !pinned && canFire(p)) {
    p.nextFire = tick + ticks(45 + next(ai) * 25);
    // ponytail: the impacts on friendly posts come with friendly losses.
    p.lastFire = tick;
    mortarFlash(st, t, pid);
  }
  // 무력화: once up again, back towards where it set off, straight (the mortar section stays dug in)
  const retreat = p.state === 'broken' && !pinned && p.type !== 'mortar';
  if (retreat) {
    const home = p.path[0]!;
    speed = p.type === 'apc' ? 3 : 0.8;
    p.dir = atan2(home.x - p.x, home.y - p.y);
  }
  if (pinned) speed = 0; // the APCs are never pinned (lethality.ts)
  if (retreat) {
    p.x += sin(p.dir) * speed * DT;
    p.y += cos(p.dir) * speed * DT;
  } else if (speed > 0) moveAlong(p, speed);
  p.moving = speed > 0;
  if (p.type === 'apc' && p.moving && tick - p.dustTick > DUST_TICKS) {
    p.dustTick = tick;
    emit(st, t, p, pid, 'dust', 'veh', 0, LIFE.dust, false);
  }
  layout(p, tick, speed);
}
