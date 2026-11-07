import { deploy } from './deploy';
import { updatePlatoon } from './enemy';
import { activityOf, applyId, updateIntel } from './intel';
import { exposureTick, runExposureAct } from './exposure';
import { applyLase } from './laser';
import { isValid } from './inputs';
import { applyMove, applyReport, runPostAct, updatePost } from './post';
import { applyPrep } from './prep';
import { applyRadio, openProcedure, runAct, type Ctx } from './procedure';
import { takeDue } from './queue';
import { createStreams } from './rng';
import { hashState } from './stateHash';
import { updateVisibility } from './visibility';
import type { RadioEvent } from './radio';
import type { GameRecord, ImpactEvent, PostNote, Sim, SimInit, SimState, StepResult } from './types';

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
    post: { state: 'ready', move: null, departed: 0, until: 0, moves: 0 },
    posReport: null,
    compromised: -1,
    fire: null,
    observerLost: false,
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
  let out: (Omit<RadioEvent, 'tick'> | Omit<ImpactEvent, 'tick'> | ({ type: 'post' } & PostNote))[] = [];
  const ctx: Ctx = {
    fdc: rng.fdc,
    bal: rng.bal,
    exp: rng.exp,
    frontY: init.scenario.frontY,
    terrain: init.terrain,
    battery: init.scenario.battery,
    say: (utterance) => out.push({ type: 'radio', utterance }),
    landed: (x, y, fuze) => out.push({ type: 'impact', x, y, fuze }),
    note: (n) => out.push({ type: 'post', ...n }),
    friends: init.scenario.friends,
  };

  return {
    state,
    step(inputs): StepResult {
      const before = { bino: state.bino, phase: state.phase };
      out = [];
      const accepted = inputs.map((input) => {
        if (!isValid(input) || state.phase === 'ended') return false; // unknown kind or malformed value, or over: ignored
        const a = input.a;
        if (a === 'call' || a === 'loc' || a === 'desc' || a === 'fire' || a === 'corr' || a === 'repeat' || a === 'eom' || a === 'shift') return applyRadio(state, ctx, a, input.v);
        const v = input.v as readonly number[]; // every other kind carries integers only
        if (a === 'move') return applyMove(state, ctx, v);
        if (a === 'pos' || a === 'pos_skip') return applyReport(state, ctx, a, input.v as readonly number[] | undefined);
        if (a === 'cam') state.aim = { az: v[0]!, el: v[1]! };
        else if (a === 'bino') {
          if (v[0] === 1 && state.post.state === 'moving') return false; // 이동 중에는 육안만 (demo: setup allows it)
          state.bino = v[0] === 1;
        }
        else if (a === 'id') return applyId(state, init.terrain, init.weather, v); // sees last step's 보임
        else if (a === 'lase') return state.post.state === 'ready' && applyLase(state, init.terrain, rng.las, v); // so does the laser
        else if (a === 'pick' || a === 'start') {
          if (!applyPrep(state, init.terrain, init.scenario.plannedOp, a, v)) return false;
          if (a === 'start') openProcedure(state);
        }
        return true;
      });
      if (state.phase === 'live') {
        state.tick++; // 작전 준비: the clock stands still
        updatePost(state, ctx); // the post walks first: this tick's sight is from where it now stands
        for (let i = 0; i < state.platoons.length; i++) updatePlatoon(state, init.terrain, rng.ai, i);
        state.effects = state.effects.filter((e) => state.tick - e.tick <= e.life);
        // Due acts run before 보임 so a round landing now is seen now; no act reads this tick's 보임 or 적정.
        for (let act = takeDue(state); act; act = takeDue(state)) {
          if (act === 'move_readback' || act === 'pos_readback') runPostAct(state, ctx, act);
          else if (act === 'retaliation' || act === 'retaliation_muzzle' || act === 'end') runExposureAct(state, ctx, act);
          else runAct(state, ctx, act);
        }
        // Every 0.3 s, and at once when the binoculars change or the operation starts; new effects always.
        const all = state.tick % VIS_TICKS === 0 || state.bino !== before.bino || before.phase === 'prep';
        updateVisibility(state, init.terrain, init.weather, all);
        updateIntel(state, init.weather);
        exposureTick(state, ctx); // every 5 s: does the enemy see the post?
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
