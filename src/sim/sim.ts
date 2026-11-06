import { Hasher } from './hash';
import { isValid } from './inputs';
import { createStreams, STREAMS } from './rng';
import type { GameRecord, Mode, Sim, SimInit, SimState, StepResult } from './types';

export const STEP_MS = 50;
const MODES: readonly Mode[] = ['training', 'standard'];
// The demo's opening line of sight: 0.02 rad (20.4 mils) east of north, 22 mils down.
const INITIAL_AIM = { az: 204, el: -220 };

export function createSim(init: SimInit): Sim {
  const state: SimState = { tick: 0, mode: init.mode, score: 0, aim: { ...INITIAL_AIM }, bino: false, rng: createStreams(init.seed) };

  return {
    state,
    step(inputs): StepResult {
      const accepted = inputs.map((input) => {
        if (!isValid(input)) return false; // unknown kind or malformed value: ignored, nothing changes
        const v = input.v!;
        if (input.a === 'cam') state.aim = { az: v[0]!, el: v[1]! };
        else if (input.a === 'bino') state.bino = v[0] === 1;
        return true;
      });
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
      h.i32(state.aim.az);
      h.i32(state.aim.el);
      h.u32(state.bino ? 1 : 0);
      for (const name of STREAMS) {
        h.i32(state.rng[name].a);
        h.u32(state.rng[name].count);
      }
      h.i32(state.score);
      return h.hex();
    },
  };
}
