import { Hasher } from './hash';
import { createStreams, STREAMS } from './rng';
import type { GameRecord, Mode, Sim, SimInit, SimState, StepResult } from './types';

export const STEP_MS = 50;
const MODES: readonly Mode[] = ['training', 'standard'];

export function createSim(init: SimInit): Sim {
  const state: SimState = { tick: 0, mode: init.mode, score: 0, rng: createStreams(init.seed) };

  return {
    state,
    step(inputs): StepResult {
      const accepted = inputs.map(() => false); // no input kinds yet: every input is ignored by the state guard
      state.tick++;
      return { events: [], accepted };
    },
    record(): GameRecord {
      return { ticks: state.tick, score: state.score };
    },
    hash(): string {
      // Fixed field order; never iterate object keys here.
      const h = new Hasher();
      h.u32(state.tick);
      h.u32(MODES.indexOf(state.mode));
      for (const name of STREAMS) {
        h.i32(state.rng[name].a);
        h.u32(state.rng[name].count);
      }
      h.i32(state.score);
      return h.hex();
    },
  };
}
