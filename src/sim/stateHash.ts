// 상태 해시: every field of the state in a fixed order, floats as their bits. Never iterate object keys here.
import { Hasher } from './hash';
import { STREAMS } from './rng';
import { ACTS } from './queue';
import { ACTIVITIES, CONTROLS, FUZE_REQUESTS, FUZES, LATERAL_DIRS, NEXTS, RANGE_DIRS, TARGET_TYPES, UNITS, WARNINGS } from './radio';
import type { Cue, FieldEffect, Member, Mode, Phase, PlatoonState, RadioStage, RouteKey, SimState, UnitType } from './types';

const MODES: readonly Mode[] = ['training', 'standard'];
const PHASES: readonly Phase[] = ['prep', 'live'];
const UNIT_TYPES: readonly UnitType[] = ['recon', 'inf', 'apc', 'mortar'];
const ROUTE_KEYS: readonly RouteKey[] = ['A', 'B', 'C'];
const MEMBER_KINDS: readonly Member['kind'][] = ['man', 'veh', 'tube'];
const PLATOON_STATES: readonly PlatoonState[] = ['wait', 'approach', 'assault', 'hold', 'support', 'emplaced', 'broken', 'destroyed'];
const EFFECT_KINDS: readonly FieldEffect['kind'][] = ['dust', 'muzzle', 'burst'];
const CUES: readonly (Cue | null)[] = [null, 'man', 'veh', 'dust', 'muzzle'];
const RADIO_STAGES: readonly RadioStage[] = ['off', 'idle', 'wait', 'loc', 'desc', 'ready', 'flight', 'adjust', 'effect'];
const bit = (b: boolean) => (b ? 1 : 0);
/** Index + 1 of an optional enum value, 0 when absent. */
const opt = <T>(list: readonly T[], x: T | undefined) => (x === undefined ? 0 : list.indexOf(x) + 1);

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
      h.u32(bit(m.alive));
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
    h.i32(p.pinnedUntil);
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
    h.u32(bit(e.vt));
    h.u32(bit(e.vis));
  }
  h.u32(state.targets);
  h.u32(RADIO_STAGES.indexOf(state.radio.stage));
  h.u32(state.radio.lastTn);
  h.u32(state.missions.length);
  for (const m of state.missions) {
    h.u32(WARNINGS.indexOf(m.warning));
    const l = m.location; // grid only until the polar method comes
    h.u32(l && l.method === 'grid' ? 1 : 0);
    if (l && l.method === 'grid') {
      h.u32(l.easting);
      h.u32(l.northing);
    }
    const d = m.description;
    h.u32(d ? 1 : 0);
    if (d) {
      h.u32(d.rounds);
      h.u32(FUZE_REQUESTS.indexOf(d.fuzeRequest));
      h.u32(CONTROLS.indexOf(d.control));
      h.u32(d.dangerClose);
      h.u32(TARGET_TYPES.indexOf(d.targetType));
      h.u32(opt(ACTIVITIES, 'activity' in d ? d.activity : undefined));
      h.u32(opt(UNITS, 'unit' in d ? d.unit : undefined));
      h.u32('count' in d ? d.count : 0);
    }
    const t = m.mto;
    h.u32(t ? 1 : 0);
    if (t) {
      h.u32(FUZES.indexOf(t.fuze));
      h.u32(t.rounds);
      h.u32(CONTROLS.indexOf(t.control));
      h.u32(t.targetNumber);
    }
    h.u32(NEXTS.indexOf(m.phase));
    h.f64(m.bias.x);
    h.f64(m.bias.y);
    h.u32(m.aim ? 1 : 0);
    if (m.aim) {
      h.f64(m.aim.x);
      h.f64(m.aim.y);
    }
    h.u32(m.direction === null ? 0 : 1 + m.direction);
    const c = m.correction;
    h.u32(c ? 1 : 0);
    if (c) {
      h.u32(c.direction === undefined ? 0 : 1 + c.direction);
      h.u32(opt(LATERAL_DIRS, c.lateralDir));
      h.u32(c.lateral ?? 0);
      h.u32(opt(RANGE_DIRS, c.rangeDir));
      h.u32(c.range ?? 0);
      h.u32(NEXTS.indexOf(c.next));
    }
    h.u32(m.flights.length);
    for (const f of m.flights) {
      h.f64(f.x);
      h.f64(f.y);
      h.i32(f.at);
      h.u32(FUZES.indexOf(f.fuze));
    }
    h.u32(m.impacts.length);
    for (const im of m.impacts) {
      h.f64(im.x);
      h.f64(im.y);
      h.i32(im.tick);
    }
    h.u32(m.kills.length);
    for (const k of m.kills) h.u32(k === null ? 0 : 1 + k);
  }
  h.u32(state.queue.length);
  for (const q of state.queue) {
    h.i32(q.at);
    h.u32(ACTS.indexOf(q.act));
  }
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
