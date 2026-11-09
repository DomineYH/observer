// 전과 보고와 임무 요약 (demo recordBDA, bestPlatoon, shortOf, truthOf, setDir, devAgainst: lines 535, 701–786, 797,
// 820–822): which unit a mission is about, the name the observer calls it by, the real effect a report is scored
// against, and the 초탄 오차 and 방향 오차 kept for the 사후강평. No draws.
import { MIL } from './ballistics';
import { DESTROYED, NEUTRALIZED } from './lethality';
import { atan2 } from './math';
import type { Point } from './terrain';
import type { Effect, TargetNameSlots } from './radio';
import type { Mission, Platoon, SimState } from './types';

const POINTS = { right: 30, wrong: -20 }; // 보고 일치 · 불일치
const TARGET_M = 600; // the mission's target: the unit nearest the sent grid within this …
const NEAR_M = 800; // … or for the 초탄 오차 without one, the unit nearest the round within this

/** The unit that has set off nearest `at`, closer than `max` m (ties: the first); −1 when none. */
function nearest(s: SimState, at: Point, max: number): number {
  let best = -1;
  let bd = max * max;
  s.platoons.forEach((p, i) => {
    const d = (p.x - at.x) * (p.x - at.x) + (p.y - at.y) * (p.y - at.y);
    if (p.state !== 'wait' && d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** 표적위치 accepted: the unit the observer means. */
export const noteTarget = (s: SimState, m: Mission) => (m.target = nearest(s, m.aim!, TARGET_M));

/** An adjusting round landed at `at`: 초탄 오차 from the target's centre (or the nearest unit's), m. Demo rule: the first
 * adjusting round with a unit to measure from sets it (`firstErr == null`, demo 778–786); a round with none leaves it open. */
export function noteImpact(s: SimState, m: Mission, at: Point): void {
  if (m.firstError !== null) return;
  const p = s.platoons[m.target >= 0 ? m.target : nearest(s, at, NEAR_M)];
  if (p) m.firstError = Math.round(Math.sqrt((at.x - p.x) * (at.x - p.x) + (at.y - p.y) * (at.y - p.y)));
}

/** 방향 sent: 방향 오차 from the true azimuth of the target from the observation post, mils the short way round. */
export function noteDirection(s: SimState, m: Mission): void {
  const p = s.platoons[m.target];
  if (!p) return;
  const e = Math.abs(m.direction! - ((atan2(p.x - s.op.x, p.y - s.op.y) * MIL + 6400) % 6400));
  m.directionError = Math.round(e > 3200 ? 6400 - e : e);
}

/** The unit the mission's rounds hit hardest (most kills among those struck, ties: the first), else its target. */
function reportedUnit(m: Mission): number {
  let best = -1;
  m.kills.forEach((k, i) => {
    if (k !== null && (best < 0 || k > m.kills[best]!)) best = i;
  });
  return best >= 0 ? best : m.target;
}

/** 효과 보고의 표적 이름: by what the observer knows (stage 2 병종, stage 3 규모); 표적 before that. */
function nameOf(p: Platoon | undefined): TargetNameSlots {
  const stage = p ? p.intel.stage : 0;
  if (!p || stage < 2) return { targetName: 'unknown' };
  if (p.type === 'apc') return { targetName: 'apc' };
  if (p.type === 'mortar') return { targetName: 'mortar', named: stage === 3 ? 1 : 0 };
  if (p.type === 'recon' && stage === 3) return { targetName: 'recon' };
  return { targetName: 'infantry', named: stage === 3 && p.type === 'inf' ? 1 : 0 };
}

/** 실제 효과: 파괴 at 60% casualties, 무력화 at 30%, else 효과 미흡. */
const truthOf = (cas: number): Effect => (cas >= DESTROYED ? 'destroyed' : cas >= NEUTRALIZED ? 'neutralized' : 'ineffective');

/** One accepted 전과 보고: noted in the mission and scored against the truth, when there is a unit to judge. Returns the
 * name it goes by. */
export function report(s: SimState, m: Mission, effect: Effect): TargetNameSlots {
  const p = s.platoons[reportedUnit(m)];
  m.report = effect;
  if (p) {
    const cas = p.members.filter((q) => !q.alive).length / p.members.length;
    m.truth = truthOf(cas);
    m.truthPct = Math.round(cas * 100);
    const points = m.truth === effect ? POINTS.right : POINTS.wrong;
    m.score += points;
    s.score += points;
  }
  return nameOf(p);
}
