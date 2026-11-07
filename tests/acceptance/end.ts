// Fixtures for the end-of-game tests (#36): games played through to their end.
import type { Scenario, Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CALL_FFE, desc } from './mission';
import { aimedAt, isImpact } from './strike';

/** An infantry platoon (first, so its draws are kills.test's INF) and a recon team that walks in and holds. */
export const INF_RECON: Scenario = {
  ...BASE_SCENARIO,
  units: [
    { type: 'inf', route: 'B', t0: 0 },
    { type: 'recon', route: 'A', t0: 0 },
  ],
  friends: [],
};
/** On seed 2 an aimed 포대 오발 destroys INF_RECON's platoon on its approach (as kills.test's 파괴). */
export const FFE5 = desc(5, 'quick', 'ready', 0, 'unknown');

/** Steps with no input until the game ends (at most `limit` ticks): the tick the unit `pid` fell (broken or destroyed),
 * the tick the last round landed, −1 when none. */
export function playOut(sim: Sim, pid = 0, limit = 20000): { fell: number; last: number } {
  let fell = -1;
  let last = -1;
  for (let k = 0; k < limit && sim.state.phase === 'live'; k++) {
    if (sim.step([]).events.some(isImpact)) last = sim.state.tick;
    const s = sim.state.platoons[pid]!.state;
    if (fell < 0 && (s === 'broken' || s === 'destroyed')) fell = sim.state.tick;
  }
  return { fell, last };
}

/** INF_RECON's platoon destroyed by a 바로 효력사, played to the end of the game. */
export function cleared(): { sim: Sim; fell: number; last: number } {
  const sim = aimedAt(INF_RECON, 2, 0, CALL_FFE, FFE5);
  return { sim, ...playOut(sim) };
}
