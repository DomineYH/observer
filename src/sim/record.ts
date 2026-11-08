// 판 기록 (PRD 10.2, demo computeRecord lines 1475–1494): what a game comes to, read from its state. Pure.
import { nearFriend } from './losses';
import type { GameRecord, Platoon, Scenario, SimInit, SimState } from './types';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]) => (xs.length ? Math.round(sum(xs) / xs.length) : null);
const down = (p: Platoon) => p.state === 'broken' || p.state === 'destroyed';

export function recordOf(s: SimState, init: Pick<SimInit, 'seed' | 'seedKind'> & { scenario: Pick<Scenario, 'friends'> }): GameRecord {
  const cleared = s.clearTick >= 0 && !s.observerLost;
  const rounds = (m: SimState['missions'][number]) => m.impacts.length + m.flights.length;
  const fired = s.missions.filter((m) => rounds(m) > 0);
  const roundsTotal = sum(s.missions.map(rounds));
  const judged = s.missions.filter((m) => m.report !== null && m.truth !== null);
  const combat = s.platoons.filter((p) => p.type !== 'recon');
  const neutralized = combat.filter(down).length;
  const friends = init.scenario.friends;
  return {
    ticks: s.tick,
    seed: init.seed,
    seedKind: init.seedKind,
    cleared,
    clearTick: cleared ? s.clearTick : null,
    roundsTotal,
    missions: fired.length,
    adjustRounds: sum(fired.map((m) => m.corrections)),
    firstErrorAvg: mean(fired.flatMap((m) => (m.firstError === null ? [] : [m.firstError]))),
    directionErrorAvg: mean(fired.flatMap((m) => (m.directionError === null ? [] : [m.directionError]))),
    reportAccuracyPct: judged.length ? Math.round((100 * judged.filter((m) => m.report === m.truth).length) / judged.length) : null,
    roundsPerUnit: neutralized ? Math.round((10 * roundsTotal) / neutralized) / 10 : null,
    neutralized,
    combatUnits: combat.length,
    earlyDefeats: combat.filter((p) => p.type === 'inf' && down(p) && p.assaultTick < 0).length, // judge's +50: a fallen platoon never assaults
    friendlyHits: sum(s.missions.flatMap((m) => m.impacts.map((i) => friends.filter((f) => nearFriend(f, i.x, i.y)).length))),
    friendlyLosses: s.friendlies.filter((m) => !m.alive).length,
    dangerCloseMissed: s.missions.filter((m) => m.dangerMissed).length,
    observerLost: s.observerLost,
    postMoves: s.post.moves,
    compromised: s.compromised >= 0,
    score: s.score,
    mode: s.trainingUsed || s.mode === 'training' ? 'training' : 'standard',
  };
}
