// 위험근접 (demo lines 738–754, 799–818; PRD 4.4): a target within 600 m of our troops or the post brings the rules —
// declared, or 기러기 applies them for −30 — and only the first 표적위치 is judged (game rule). No draws.
import type { Say } from './procedure';
import type { CorrectionSlots } from './radio';
import type { Point } from './terrain';
import type { Mission, SimState } from './types';

const DANGER_M = 600;
const MISSED = -30; // 위험근접 미선언
const CAP_M = 100; // 위험근접: at most this much a correction, across and in range alike

const within = (a: Point, b: Point) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < DANGER_M * DANGER_M;

/** 표적성질 accepted: whether the rules apply (declared, or near the post or a friendly position), and whether 기러기
 * must apply them unasked. */
export function markDanger(s: SimState, m: Mission, friends: readonly Point[]): void {
  const near = within(m.aim!, s.op) || friends.some((f) => within(m.aim!, f));
  const declared = m.description!.dangerClose === 1;
  m.dangerClose = declared || near;
  m.dangerMissed = near && !declared;
}

/** After 기러기's readback of the 표적성질: −30 and 위험근접 적용 when not declared, then 조정 후 효력사 for a 바로
 * 효력사 (the battery fires the adjusting round first). */
export function announceDanger(s: SimState, m: Mission, say: Say): void {
  if (m.dangerMissed) {
    s.score += MISSED;
    say({ speaker: 'fdc', ending: 'over', kind: 'danger_close_applied' });
  }
  if (m.dangerClose && m.phase === 'ffe') {
    m.phase = 'adjust';
    say({ speaker: 'fdc', ending: 'over', kind: 'danger_close_adjust_first' });
  }
}

/** 위험근접 수정 over 100 m on either axis (snapped): 기러기 asks for it again. */
export const overCap = (m: Mission, c: CorrectionSlots) => m.dangerClose && ((c.lateral ?? 0) > CAP_M || (c.range ?? 0) > CAP_M);
