// 종료 (demo lines 1346–1353, PRD 6장): the game ends when every combat unit is down, at the 40분 한도, or (exposure.ts)
// 4 s after the 관측반 is lost. The 정찰조 is not a combat unit.
import type { Platoon, SimState } from './types';

const LIMIT_TICKS = 40 * 60 * 20; // 작전 시간 한도 40분 (모의 시간)
const SETTLE_TICKS = 8 * 20; // all down: the game ends once nothing has been owed or in the air this long

const down = (p: Platoon) => p.state === 'broken' || p.state === 'destroyed' || p.state === 'overran';

/** Runs last in each live tick. */
export function checkEnd(s: SimState): void {
  if (s.phase !== 'live') return;
  const combat = s.platoons.filter((p) => p.type !== 'recon');
  const done = combat.length > 0 && combat.every(down); // a scenario without combat units ends only by time
  // 기러기 owes an answer, or rounds are about to fly or flying (demo WAIT · AMC · FLIGHT)
  const busy = s.radio.stage === 'wait' || s.radio.stage === 'ready' || s.radio.stage === 'flight';
  if (done && s.clearTick < 0 && !combat.some((p) => p.state === 'overran')) s.clearTick = s.tick;
  if (s.tick >= LIMIT_TICKS) s.phase = 'ended';
  else if (done && !busy) {
    if (s.endAt < 0) s.endAt = s.tick + SETTLE_TICKS;
    if (s.tick >= s.endAt) s.phase = 'ended';
  } else s.endAt = -1;
}
