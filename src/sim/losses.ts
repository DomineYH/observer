// 아군 손실 (demo lines 491–499, 603–605, 661; PRD 6장): our positions lose men to the enemy mortar's rounds, to enemy
// infantry within 400 m and to our own rounds within 70 m. Each man lost costs 10 points. B6: the enemy's rounds and
// fire draw only from the 적/아군 행동 stream; our rounds' damage draws from the ballistics stream.
import { exp } from './math';
import type { Ctx } from './procedure';
import { schedule } from './queue';
import { gauss, next, type Stream } from './rng';
import { heightAt } from './terrain';
import type { FriendlyMan, Platoon, SimState } from './types';

const DT = 0.05;
const LOSS = { mortar: { R: 15, stand: 0.3, prone: 0.1 }, ours: { R: 30, stand: 0.6, prone: 0.3 } };
const SPREAD = { x: 45, y: 35 }; // m around the position the enemy rounds fall
const FLIGHT_S = { min: 22, spread: 4 };
const NOTE_S = 26;
const SHELLED_TICKS = 40 * 20;
const BURST_TICKS = 240;
const LOSS_POINTS = -10;
const SHELL_POINTS = -5; // 박격포 피탄, a round
const ENEMY_M = 400; // 적 보병 사격: within this of a position
const OURS = { m: 70, points: -200 }; // 아군 포탄: a round this close to a position

/** 적 보병 사격 (PRD 6장): the chance per tick that one of our men falls to an enemy platoon `d` m from his position with
 * `ea` of its men left: 0.12 % per second × ea × (400 − d)/400, halved lying down. */
export function enemyFireChance(ea: number, d: number, prone: boolean): number {
  if (d >= ENEMY_M) return 0;
  return 0.0012 * DT * ea * ((ENEMY_M - d) / ENEMY_M) * (prone ? 0.5 : 1);
}

/** Enemy platoon `p`, `d` m from position `pos`, fires on its men: infantry not pinned, within 400 m, one draw per live
 * man of the position. */
export function enemyFire(s: SimState, ai: Stream, p: Platoon, pos: number, d: number): void {
  if (p.type !== 'inf' || d >= ENEMY_M || s.tick < p.pinnedUntil) return;
  const ea = p.members.filter((q) => q.alive).length / p.members.length;
  let k = 0;
  for (const q of s.friendlies)
    if (q.pos === pos && q.alive && next(ai) < enemyFireChance(ea, d, q.prone)) {
      fall(q);
      k++;
    }
  s.score += LOSS_POINTS * k;
}

function fall(q: FriendlyMan): void {
  q.alive = false;
  q.prone = true;
  q.moving = false;
}

const ticks = (sec: number) => Math.ceil(sec * 20);

/** The chance one friendly man `r` m from a burst falls: stand/prone × exp(−1.5·(r/R)²) within R (적 박격포 15 m 30 %/10 %,
 * 아군 포탄 30 m 60 %/30 %). */
export function friendlyLossChance(cause: 'mortar' | 'ours', r: number, prone: boolean): number {
  const c = LOSS[cause];
  if (r > c.R) return 0;
  return (prone ? c.prone : c.stand) * exp(-((r / c.R) * (r / c.R)) * 1.5);
}

/** One burst at (x, y) on our men, every position, in order: one draw from `stream` per live man within reach. */
function hitFriendlies(s: SimState, x: number, y: number, cause: 'mortar' | 'ours', stream: Stream): number {
  let k = 0;
  for (const q of s.friendlies) {
    if (!q.alive) continue;
    const r = Math.sqrt((q.x - x) * (q.x - x) + (q.y - y) * (q.y - y));
    if (r > LOSS[cause].R) continue;
    if (next(stream) < friendlyLossChance(cause, r, q.prone)) {
      fall(q);
      k++;
    }
  }
  s.score += LOSS_POINTS * k;
  return k;
}

/** A volley's rounds (one per live tube) on a position each, landing 22–26 s later; the first volley's warning 26 s
 * later. Two draws per round: the position, then the flight time. Nothing without friendly positions. */
export function fireShells(s: SimState, ctx: Ctx, tubes: number, first: boolean): void {
  if (!ctx.friends.length) return;
  if (first) schedule(s, s.tick + ticks(NOTE_S), 'shelling_note');
  for (let k = 0; k < tubes; k++) {
    const pos = Math.floor(next(ctx.ai) * ctx.friends.length);
    const at = s.tick + ticks(FLIGHT_S.min + next(ctx.ai) * FLIGHT_S.spread);
    s.shells.push({ pos, at });
    schedule(s, at, 'shell');
  }
}

/** Runs a due act of this module: an enemy round lands (two gaussians, then the loss draws), or the first warning. */
export function runLossAct(s: SimState, ctx: Ctx, act: 'shell' | 'shelling_note'): void {
  if (act === 'shelling_note') {
    ctx.note({ what: 'shelling' });
    return;
  }
  const { pos } = s.shells.splice(s.shells.findIndex((q) => q.at <= s.tick), 1)[0]!;
  const f = ctx.friends[pos]!;
  const x = f.x + gauss(ctx.ai) * SPREAD.x;
  const y = f.y + gauss(ctx.ai) * SPREAD.y;
  s.effects.push({ kind: 'burst', x, y, gz: heightAt(ctx.terrain, x, y), tick: s.tick, life: BURST_TICKS, pid: -1, small: true, vt: false, tiny: false, vis: false });
  s.shelledUntil[pos] = s.tick + SHELLED_TICKS;
  s.score += SHELL_POINTS;
  hitFriendlies(s, x, y, 'mortar', ctx.ai);
}

/** Our round at (x, y): for each position within 70 m, −200 and the men within 30 m of it may fall (탄도 draws). */
export function friendlyRound(s: SimState, ctx: Ctx, x: number, y: number): void {
  ctx.friends.forEach((f, pos) => {
    if ((f.x - x) * (f.x - x) + (f.y - y) * (f.y - y) >= OURS.m * OURS.m) return;
    s.score += OURS.points;
    ctx.note({ what: 'friendly_hit', pos, k: hitFriendlies(s, x, y, 'ours', ctx.bal) });
  });
}
