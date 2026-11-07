// A game played through the assembly point's session, so its 입력 기록 is the app's own.
import { createSim, type Input, type SimEvent, type SimInit } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { createSession } from '@app/session';
import { init, START } from './init';
import { CALL_FFE, DESC_UNKNOWN, EOM, LOC_CLEAR, POS_SKIP } from './mission';

/** No enemy: our positions only, so a game runs to the 40분 한도 fast. */
export const NO_ENEMY = { ...BASE_SCENARIO, units: [] };

/** Each `take` sends its input every tick until the simulation takes it, so the ignored copies pile up as a player's
 * early presses do. */
export function play(at: SimInit) {
  const sim = createSim(at);
  const session = createSession(sim);
  const events: SimEvent[] = [];
  const sent: Input[] = [];
  const step = () => events.push(...session.step());
  const take = (input: Input) => {
    for (let k = 0; k < 6000; k++) {
      const n = session.log.length;
      session.send(input);
      sent.push(input);
      step();
      if (session.log.length > n) return;
    }
    throw new Error(`${input.a} not taken`);
  };
  return { sim, session, events, sent, step, take };
}

/** 작전 개시 and one 바로 효력사 (포대 3발 on open ground) through its 임무끝. */
export const MISSION: Input[] = [POS_SKIP, CALL_FFE, LOC_CLEAR, DESC_UNKNOWN, EOM('ineffective')];
export function oneMission(at: SimInit = { ...init(20261106), scenario: NO_ENEMY }) {
  const g = play(at);
  g.take(START);
  for (const input of MISSION) g.take(input);
  return g;
}
