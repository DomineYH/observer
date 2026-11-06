import { Hasher } from './hash';
import { isValid } from './inputs';
import { deploy } from './deploy';
import { applyPrep } from './prep';
import { createStreams, STREAMS } from './rng';
import type { GameRecord, Member, Mode, Phase, RouteKey, Sim, SimInit, SimState, StepResult, UnitType } from './types';

export const STEP_MS = 50;
const MODES: readonly Mode[] = ['training', 'standard'];
const PHASES: readonly Phase[] = ['prep', 'live'];
const UNIT_TYPES: readonly UnitType[] = ['recon', 'inf', 'apc', 'mortar'];
const ROUTE_KEYS: readonly RouteKey[] = ['A', 'B', 'C'];
const MEMBER_KINDS: readonly Member['kind'][] = ['man', 'veh', 'tube'];
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
    mode: init.mode,
    score: 0,
    aim: { ...INITIAL_AIM },
    bino: false,
    rng,
  };

  return {
    state,
    step(inputs): StepResult {
      const accepted = inputs.map((input) => {
        if (!isValid(input)) return false; // unknown kind or malformed value: ignored, nothing changes
        const v = input.v!;
        if (input.a === 'cam') state.aim = { az: v[0]!, el: v[1]! };
        else if (input.a === 'bino') state.bino = v[0] === 1;
        else if (input.a === 'pick' || input.a === 'start') return applyPrep(state, init.terrain, init.scenario.plannedOp, input.a, v);
        return true;
      });
      if (state.phase === 'live') state.tick++; // 작전 준비: the clock stands still
      return { events: [], accepted };
    },
    record(): GameRecord {
      return { ticks: state.tick, score: state.score };
    },
    hash(): string {
      // Fixed field order; never iterate object keys here.
      const h = new Hasher();
      h.u32(state.tick);
      h.u32(PHASES.indexOf(state.phase));
      h.i32(state.op.x);
      h.i32(state.op.y);
      h.u32(state.picked ? 1 : 0);
      h.u32(state.reportDue ? 1 : 0);
      for (const p of state.platoons) {
        h.u32(UNIT_TYPES.indexOf(p.type));
        h.u32(p.route === null ? 0 : ROUTE_KEYS.indexOf(p.route) + 1);
        h.f64(p.x);
        h.f64(p.y);
        h.u32(p.path.length);
        for (const q of p.path) {
          h.f64(q.x);
          h.f64(q.y);
        }
        h.u32(p.members.length);
        for (const m of p.members) {
          h.u32(MEMBER_KINDS.indexOf(m.kind));
          h.f64(m.u);
          h.f64(m.v);
          h.f64(m.uc);
          h.f64(m.vc);
          h.f64(m.ph);
        }
      }
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
