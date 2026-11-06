import { deploy } from './deploy';
import { updatePlatoon } from './enemy';
import { isValid } from './inputs';
import { applyPrep } from './prep';
import { createStreams } from './rng';
import { hashState } from './stateHash';
import { updateVisibility } from './visibility';
import type { GameRecord, Sim, SimInit, SimState, StepResult } from './types';

export const STEP_MS = 50;
const VIS_TICKS = 6;
// The demo's opening line of sight: 0.02 rad (20.4 mils) east of north, 22 mils down.
const INITIAL_AIM = { az: 204, el: -220 };

export function createSim(init: SimInit): Sim {
  const rng = createStreams(init.seed);
  const state: SimState = {
    tick: 0,
    phase: 'prep',
    op: { ...init.scenario.plannedOp },
    picked: false,
    reportDue: false,
    platoons: deploy(init.scenario, init.terrain, rng.scn),
    effects: [],
    mode: init.mode,
    score: 0,
    aim: { ...INITIAL_AIM },
    bino: false,
    rng,
  };

  return {
    state,
    step(inputs): StepResult {
      const before = { bino: state.bino, phase: state.phase };
      const accepted = inputs.map((input) => {
        if (!isValid(input)) return false; // unknown kind or malformed value: ignored, nothing changes
        const v = input.v!;
        if (input.a === 'cam') state.aim = { az: v[0]!, el: v[1]! };
        else if (input.a === 'bino') state.bino = v[0] === 1;
        else if (input.a === 'pick' || input.a === 'start') return applyPrep(state, init.terrain, init.scenario.plannedOp, input.a, v);
        return true;
      });
      if (state.phase === 'live') {
        state.tick++; // 작전 준비: the clock stands still
        for (let i = 0; i < state.platoons.length; i++) updatePlatoon(state, init.terrain, rng.ai, i);
        state.effects = state.effects.filter((e) => state.tick - e.tick <= e.life);
        // Every 0.3 s, and at once when the binoculars change or the operation starts; new effects always.
        const all = state.tick % VIS_TICKS === 0 || state.bino !== before.bino || before.phase === 'prep';
        updateVisibility(state, init.terrain, init.weather, all);
      }
      return { events: [], accepted };
    },
    record(): GameRecord {
      return { ticks: state.tick, score: state.score };
    },
    hash: () => hashState(state),
  };
}
