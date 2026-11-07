// 아군 (demo lines 570–607): the friendly platoons at their positions and how they react to the enemy. Placed from the
// scenario stream when the simulation is created; every later draw comes from the 적/아군 행동 stream.
import { atan2, sin } from './math';
import { judge } from './lethality';
import { gauss, next, type Stream } from './rng';
import { heightAt, type Point, type TerrainData } from './terrain';
import type { FriendlyMan, SimState, Truck } from './types';

const DT = 0.05;
const MEN = 24; // per position
const FIGHT_M = 1000; // an enemy this close: everyone back in place
const FIRE_M = 750; // … and this close, those in place open fire
const REACH_M = 600; // 아군 직사화기: enemy men within this of the position take losses
const FLASH_TICKS = 10;
const TRUCK = { speed: 7, start: 20, turn: 60, back: 1500, step: 20, wiggle: 18, dustTicks: 24, dustLife: 7 }; // m/s, s, m
const TAU = Math.PI * 2;

const ticks = (s: number) => Math.round(s * 20);

// The demo's integer hash (line 213): which men lie down in their place.
function hash(ix: number, iy: number, s: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 24 men per position, in a ragged line 7 m apart; every fifth one walks about behind it. */
export function makeFriendlies(friends: readonly Point[], scn: Stream): FriendlyMan[] {
  const out: FriendlyMan[] = [];
  friends.forEach((f, pos) => {
    for (let n = 0; n < MEN; n++) {
      const hx = f.x + (n - 11.5) * 7 + gauss(scn) * 2;
      const hy = f.y + 8 * sin(n * 0.8) + gauss(scn) * 3;
      const ph = next(scn) * TAU;
      const wait = ticks(next(scn) * 40);
      out.push({ pos, hx, hy, x: hx, y: hy, tx: hx, ty: hy, ph, walker: n % 5 === 2, wait, moving: false, dir: 0, prone: false, alive: true, vis: false, nextFire: 0 });
    }
  });
  return out;
}

/** The supply truck at the start of `road`: its path steps 20 m along each leg (starting each leg afresh, so leg
 * ends repeat) and wiggles 18·sin(u/260) m east of the centreline. No draws. */
export function makeTruck(road: readonly Point[] | undefined): Truck | null {
  if (!road || road.length < 2) return null;
  const path: Point[] = [];
  for (let k = 1; k < road.length; k++) {
    const a = road[k - 1]!;
    const b = road[k]!;
    const L = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    for (let u = 0; u <= L; u += TRUCK.step) path.push({ x: a.x + ((b.x - a.x) * u) / L + TRUCK.wiggle * sin(u / 260), y: a.y + ((b.y - a.y) * u) / L });
  }
  const p0 = path[0]!;
  return { path, i: 0, dirn: 1, x: p0.x, y: p0.y, wait: ticks(TRUCK.start), moving: false, dir: 0, dustTick: 0, vis: false };
}

/** 아군 직사화기 (PRD 6장): the chance per tick that one enemy man `d` m from a position with `alive` of its 24 men
 * falls. Proportional to the men left; lying down cuts it to 0.4. */
export function directFireChance(alive: number, d: number, prone: boolean): number {
  if (d > REACH_M) return 0;
  return 0.003 * DT * (alive / MEN) * ((REACH_M - d) / REACH_M) * (prone ? 0.4 : 1);
}

/** Steps `q` towards (tx, ty) at `v` m/s; true once there (that tick it does not move). */
function stepTo(q: { x: number; y: number; dir: number; moving: boolean }, tx: number, ty: number, v: number): boolean {
  const dx = tx - q.x;
  const dy = ty - q.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.5) {
    q.moving = false;
    return true;
  }
  const st = Math.min(d, v * DT);
  q.x += (dx / d) * st;
  q.y += (dy / d) * st;
  q.dir = atan2(dx, dy);
  q.moving = true;
  return false;
}

/** Distance from each position to the nearest enemy that threatens it: infantry and APCs on the move or halted, not
 * broken or destroyed. */
function threats(s: SimState, friends: readonly Point[]): number[] {
  return friends.map((f) => {
    let best = 1e9;
    for (const p of s.platoons) {
      if (p.state === 'wait' || p.type === 'mortar' || p.type === 'recon' || p.state === 'destroyed' || p.state === 'broken') continue;
      if (!p.members.some((q) => q.alive)) continue;
      best = Math.min(best, Math.sqrt((p.x - f.x) * (p.x - f.x) + (p.y - f.y) * (p.y - f.y)));
    }
    return best;
  });
}

/** One tick of the friendly troops. */
export function updateFriendlies(s: SimState, t: TerrainData, ai: Stream, friends: readonly Point[]): void {
  const threat = threats(s, friends);
  if (s.truck) drive(s, t, s.truck, threat);
  for (const q of s.friendlies) {
    if (!q.alive) {
      q.moving = false;
      continue;
    }
    if (threat[q.pos]! < FIGHT_M) {
      const there = stepTo(q, q.hx, q.hy, 2.6);
      q.prone = there && hash(q.hx | 0, q.hy | 0, 5) < 0.5;
      if (there && threat[q.pos]! < FIRE_M && s.tick > q.nextFire) {
        q.nextFire = s.tick + ticks(1 + next(ai) * 3.5);
        const gz = heightAt(t, q.x, q.y) + (q.prone ? 0.4 : 1.3);
        s.effects.push({ kind: 'muzzle', x: q.x, y: q.y + 3, gz, tick: s.tick, life: FLASH_TICKS, pid: -1, small: true, vt: false, tiny: true, vis: false });
      }
      continue;
    }
    q.prone = false;
    if (!q.walker) {
      q.moving = false;
      continue;
    }
    if (!stepTo(q, q.tx, q.ty, 1.1) || --q.wait > 0) continue;
    q.wait = ticks(10 + next(ai) * 40);
    if (next(ai) < 0.5) {
      q.tx = q.hx;
      q.ty = q.hy;
    } else {
      q.tx = q.hx + gauss(ai) * 25;
      q.ty = q.hy - 25 - next(ai) * 60;
    }
  }
  directFire(s, ai, friends);
}

/** Each position's direct fire on the enemy men within 600 m of it, position by position, unit by unit, man by man. */
function directFire(s: SimState, ai: Stream, friends: readonly Point[]): void {
  friends.forEach((f, pos) => {
    const alive = s.friendlies.filter((q) => q.pos === pos && q.alive).length;
    for (const p of s.platoons) {
      if (p.state === 'wait' || p.state === 'destroyed' || p.type === 'mortar') continue;
      const d = Math.sqrt((p.x - f.x) * (p.x - f.x) + (p.y - f.y) * (p.y - f.y));
      if (d > REACH_M) continue;
      let k = 0;
      for (const q of p.members)
        if (q.alive && q.kind === 'man' && next(ai) < directFireChance(alive, d, q.prone)) {
          q.alive = false;
          k++;
        }
      if (k) judge(s, p);
    }
  });
}

/** One tick of the truck: it stands out its wait, turns back past half way when an enemy is within 1.5 km of any
 * position, waits 60 s at either end, and raises dust every 1.2 s while it drives. */
function drive(s: SimState, t: TerrainData, q: Truck, threat: readonly number[]): void {
  if (q.wait > 0) {
    q.wait--;
    q.moving = false;
    return;
  }
  if (threat.some((d) => d < TRUCK.back) && q.dirn === 1 && q.i > q.path.length * 0.5) q.dirn = -1;
  const to = q.path[q.i + q.dirn];
  if (!to) {
    q.dirn = q.dirn === 1 ? -1 : 1;
    q.wait = ticks(TRUCK.turn);
    return;
  }
  if (stepTo(q, to.x, to.y, TRUCK.speed)) q.i += q.dirn;
  if (q.moving && s.tick - q.dustTick > TRUCK.dustTicks) {
    q.dustTick = s.tick;
    s.effects.push({ kind: 'dust', x: q.x, y: q.y, gz: heightAt(t, q.x, q.y), tick: s.tick, life: ticks(TRUCK.dustLife), pid: -1, small: false, vt: false, tiny: false, vis: false });
  }
}
