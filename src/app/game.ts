// One game: its 생성 인자, the simulation and the session that records its accepted inputs. A weather change in a
// practice seed's 작전 준비 replaces the whole game (spec: 재생 자료 starts again), keeping the 관측소 후보 and the mode.
import { createSim, type Input, type Mode, type Sim, type SimInit } from '@sim';
import { createSession } from './session';

export interface Game {
  init: SimInit;
  sim: Sim;
  session: ReturnType<typeof createSession>;
}

export function newGame(init: SimInit, carry?: Game): Game {
  const sim = createSim(init);
  const session = createSession(sim);
  // The pick still queued wins over the one applied, as for 작전 개시 (ui/prep.ts startInput).
  const op = carry?.sim.state.op;
  const pick: Input | undefined =
    carry?.session.queued.findLast((i) => i.a === 'pick') ?? (carry?.sim.state.picked ? { a: 'pick', v: [op!.x, op!.y] } : undefined);
  if (pick) session.send(pick);
  // The mode still queued wins over the one applied, likewise; the demo's weather change leaves the mode alone (demo 1013).
  const mode = (carry?.session.queued.findLast((i) => i.a === 'mode')?.v![0] as Mode | undefined) ?? carry?.sim.state.mode;
  if (mode && mode !== init.mode) session.send({ a: 'mode', v: [mode] });
  return { init, sim, session };
}
