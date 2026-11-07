import { deploy } from './deploy';
import { updatePlatoon } from './enemy';
import { activityOf, applyId, updateIntel } from './intel';
import { applyLase } from './laser';
import { isValid } from './inputs';
import { applyPrep } from './prep';
import { applyRadio, openProcedure, runAct, type Ctx } from './procedure';
import { takeDue } from './queue';
import { createStreams } from './rng';
import { hashState } from './stateHash';
import { updateVisibility } from './visibility';
import type { RadioEvent } from './radio';
import type { GameRecord, ImpactEvent, Sim, SimInit, SimState, StepResult } from './types';

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
    knownOp: { ...init.scenario.plannedOp },
    picked: false,
    reportDue: false,
    platoons: deploy(init.scenario, init.terrain, rng.scn),
    effects: [],
    targets: 0,
    mode: init.mode,
    score: 0,
    aim: { ...INITIAL_AIM },
    bino: false,
    lases: [],
    radio: { stage: 'off', lastTn: 1000 },
    missions: [],
    queue: [],
    rng,
  };

  // This step's events, stamped with the tick the step ends at.
  let out: (Omit<RadioEvent, 'tick'> | Omit<ImpactEvent, 'tick'>)[] = [];
  const ctx: Ctx = {
    fdc: rng.fdc,
    bal: rng.bal,
    terrain: init.terrain,
    battery: init.scenario.battery,
    say: (utterance) => out.push({ type: 'radio', utterance }),
    landed: (x, y, fuze) => out.push({ type: 'impact', x, y, fuze }),
    friends: init.scenario.friends,
  };

  return {
    state,
    step(inputs): StepResult {
      const before = { bino: state.bino, phase: state.phase };
      out = [];
      const accepted = inputs.map((input) => {
        if (!isValid(input)) return false; // unknown kind or malformed value: ignored, nothing changes
        const a = input.a;
        if (a === 'call' || a === 'loc' || a === 'desc' || a === 'fire' || a === 'corr' || a === 'repeat' || a === 'eom') return applyRadio(state, ctx, a, input.v);
        const v = input.v as readonly number[]; // every other kind carries integers only
        if (a === 'cam') state.aim = { az: v[0]!, el: v[1]! };
        else if (a === 'bino') state.bino = v[0] === 1;
        else if (a === 'id') return applyId(state, init.terrain, init.weather, v); // sees last step's 보임
        else if (a === 'lase') return applyLase(state, init.terrain, rng.las, v); // so does the laser
        else if (a === 'pick' || a === 'start') {
          if (!applyPrep(state, init.terrain, init.scenario.plannedOp, a, v)) return false;
          if (a === 'start') openProcedure(state);
        }
        return true;
      });
      if (state.phase === 'live') {
        state.tick++; // 작전 준비: the clock stands still
        for (let i = 0; i < state.platoons.length; i++) updatePlatoon(state, init.terrain, rng.ai, i);
        state.effects = state.effects.filter((e) => state.tick - e.tick <= e.life);
        // Due acts run before 보임 so a round landing now is seen now; no act reads this tick's 보임 or 적정.
        for (let act = takeDue(state); act; act = takeDue(state)) runAct(state, ctx, act);
        // Every 0.3 s, and at once when the binoculars change or the operation starts; new effects always.
        const all = state.tick % VIS_TICKS === 0 || state.bino !== before.bino || before.phase === 'prep';
        updateVisibility(state, init.terrain, init.weather, all);
        updateIntel(state, init.weather);
        for (const p of state.platoons) p.activity = activityOf(p, state.tick);
      }
      return { events: out.map((e) => ({ ...e, tick: state.tick })), accepted };
    },
    record(): GameRecord {
      return { ticks: state.tick, score: state.score };
    },
    hash: () => hashState(state),
  };
}
