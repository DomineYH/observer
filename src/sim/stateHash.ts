// 상태 해시: every field of the state in a fixed order, floats as their bits. Never iterate object keys here.
import { Hasher } from './hash';
import { STREAMS } from './rng';
import { ACTIVITIES, UNITS } from './radio';
import type { Cue, FieldEffect, Member, Mode, Phase, PlatoonState, RouteKey, SimState, UnitType } from './types';

const MODES: readonly Mode[] = ['training', 'standard'];
const PHASES: readonly Phase[] = ['prep', 'live'];
const UNIT_TYPES: readonly UnitType[] = ['recon', 'inf', 'apc', 'mortar'];
const ROUTE_KEYS: readonly RouteKey[] = ['A', 'B', 'C'];
const MEMBER_KINDS: readonly Member['kind'][] = ['man', 'veh', 'tube'];
const PLATOON_STATES: readonly PlatoonState[] = ['wait', 'approach', 'assault', 'hold', 'support', 'emplaced'];
const EFFECT_KINDS: readonly FieldEffect['kind'][] = ['dust', 'muzzle'];
const CUES: readonly (Cue | null)[] = [null, 'man', 'veh', 'dust', 'muzzle'];
const bit = (b: boolean) => (b ? 1 : 0);

export function hashState(state: SimState): string {
  const h = new Hasher();
  h.u32(state.tick);
  h.u32(PHASES.indexOf(state.phase));
  h.i32(state.op.x);
  h.i32(state.op.y);
  h.u32(bit(state.picked));
  h.u32(bit(state.reportDue));
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
      h.f64(m.x);
      h.f64(m.y);
      h.u32(bit(m.prone));
      h.u32(bit(m.vis));
    }
    h.u32(PLATOON_STATES.indexOf(p.state));
    h.i32(p.t0);
    h.u32(p.wp);
    h.f64(p.dir);
    h.f64(p.form);
    h.u32(bit(p.moving));
    h.i32(p.assaultTick);
    h.i32(p.nextFire);
    h.i32(p.lastFire);
    h.i32(p.dustTick);
    h.u32(ACTIVITIES.indexOf(p.activity));
    const I = p.intel;
    h.u32(I.stage);
    h.u32(I.tnum);
    h.u32(CUES.indexOf(I.cue));
    h.u32(I.prog);
    h.u32(I.seenMax);
    h.u32(I.tubes);
    h.i32(I.firstTick);
    h.i32(I.seenTick);
    h.f64(I.seenAz);
    h.u32(I.size ? UNITS.indexOf(I.size.unit) + 1 : 0);
    h.u32(I.size ? I.size.n : 0);
  }
  h.u32(state.effects.length);
  for (const e of state.effects) {
    h.u32(EFFECT_KINDS.indexOf(e.kind));
    h.f64(e.x);
    h.f64(e.y);
    h.f64(e.gz);
    h.i32(e.tick);
    h.i32(e.life);
    h.u32(e.pid);
    h.u32(bit(e.small));
    h.u32(bit(e.vis));
  }
  h.u32(state.targets);
  h.u32(MODES.indexOf(state.mode));
  h.i32(state.aim.az);
  h.i32(state.aim.el);
  h.u32(bit(state.bino));
  for (const name of STREAMS) {
    h.i32(state.rng[name].a);
    h.u32(state.rng[name].count);
  }
  h.i32(state.score);
  return h.hex();
}
