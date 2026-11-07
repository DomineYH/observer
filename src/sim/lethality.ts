// 살상 (demo lines 641–658, PRD 6장): the chance one round kills a member, and what a round does to the units around it.
import { exp } from './math';
import { next, type Stream } from './rng';
import type { Fuze } from './radio';
import type { Member, Platoon, SimState } from './types';

const REACH_M = 110; // members farther from the burst are not hit
const VT_HEIGHT_M = 7; // 접근신관 파열고
const PIN_M = 220; // 피격 반응: a round this close to a unit's centre pins it …
const PIN_S = { min: 35, spread: 30 }; // … for 35–65 s
/** 판정 척도 (one scale, also the truth of the effect report): casualties for 무력화 and 파괴, and their points. */
export const NEUTRALIZED = 0.3;
export const DESTROYED = 0.6;
const POINTS = { broken: 100, destroyed: 150, early: 50 };

/** 0.92 · exp(−(r/R)²) for men, the burst `r` m away (a VT burst `VT_HEIGHT_M` above the ground). Vehicles take only a
 * near direct hit and almost nothing from VT; tubes take the burst height too. */
export function killChance(kind: Member['kind'], prone: boolean, r: number, fuze: Fuze): number {
  if (r > REACH_M) return 0;
  const vt = fuze === 'vt';
  const re = vt ? Math.sqrt(r * r + VT_HEIGHT_M * VT_HEIGHT_M) : r;
  const gauss = (d: number, R: number) => exp(-((d / R) * (d / R)));
  if (kind === 'veh') return (vt ? 0.22 : 0.9) * gauss(r, 7);
  if (kind === 'tube') return 0.9 * gauss(re, vt ? 7 : 10);
  return 0.92 * gauss(re, prone ? (vt ? 24 : 15) : vt ? 28 : 26);
}

type Target = Pick<Member, 'kind' | 'x' | 'y' | 'prone' | 'alive'>;

/** One burst at (x, y) on a unit's members: each live member within reach draws once from the ballistics stream, in
 * member order. Returns how many it killed. */
export function killMembers(members: Target[], x: number, y: number, fuze: Fuze, bal: Stream): number {
  let k = 0;
  for (const q of members) {
    if (!q.alive) continue;
    const r = Math.sqrt((q.x - x) * (q.x - x) + (q.y - y) * (q.y - y));
    if (r > REACH_M) continue;
    if (next(bal) < killChance(q.kind, q.prone, r, fuze)) {
      q.alive = false;
      k++;
    }
  }
  return k;
}

/** What one round landing at (x, y) does (demo impact): every unit that has set off and whose centre is within 220 m
 * loses members to it (counted in `kills`, by unit: struck, even if nobody fell) and, unless it is the APCs, goes to ground for 35–65 s from the
 * next tick. Draws from the ballistics stream unit by unit: the kill draws, then the pinning draw. */
export function strike(s: SimState, x: number, y: number, fuze: Fuze, bal: Stream, kills: (number | null)[]): void {
  s.platoons.forEach((p, pid) => {
    if (p.state === 'wait') return;
    if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) > PIN_M * PIN_M) return;
    kills[pid] = (kills[pid] ?? 0) + killMembers(p.members, x, y, fuze, bal);
    if (p.type !== 'apc') p.pinnedUntil = Math.max(p.pinnedUntil, s.tick + Math.ceil((PIN_S.min + next(bal) * PIN_S.spread) * 20));
    judge(s, p);
  });
}

/** 무력화 at 30% casualties, 파괴 at 60%, each scored when reached (파괴 after 무력화 adds the difference). The first of
 * them before an infantry platoon's assault is 조기 격퇴, +50; a broken platoon never assaults afterwards. */
function judge(s: SimState, p: Platoon): void {
  if (p.state === 'destroyed') return;
  const cas = p.members.filter((q) => !q.alive).length / p.members.length;
  const was = p.state;
  if (cas >= DESTROYED) {
    p.state = 'destroyed';
    s.score += was === 'broken' ? POINTS.destroyed - POINTS.broken : POINTS.destroyed;
  } else if (cas >= NEUTRALIZED && was !== 'broken') {
    p.state = 'broken';
    s.score += POINTS.broken;
  } else return;
  if (was !== 'broken' && p.type === 'inf' && p.assaultTick < 0) s.score += POINTS.early;
}
