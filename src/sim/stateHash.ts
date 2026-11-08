// 상태 해시: every field of the state in a fixed order, floats as their bits. Never iterate object keys here.
import { Hasher } from './hash';
import { STREAMS } from './rng';
import { ACTS } from './queue';
import { ACTIVITIES, CONTROLS, EFFECTS, FUZE_REQUESTS, FUZES, LATERAL_DIRS, LOCATION_METHODS, NEXTS, RANGE_DIRS, TARGET_TYPES, UNITS, WARNINGS, type Target } from './radio';
import { MODES, type Cue, type FieldEffect, type Member, type Phase, type PlatoonState, type PostState, type RadioStage, type RouteKey, type Shooter, type SimState, type UnitType } from './types';

const PHASES: readonly Phase[] = ['prep', 'live', 'ended'];
const POST_STATES: readonly PostState[] = ['ready', 'moving', 'setup'];
const SHOOTERS: readonly Shooter[] = ['mortar', 'direct'];
const UNIT_TYPES: readonly UnitType[] = ['recon', 'inf', 'apc', 'mortar'];
const ROUTE_KEYS: readonly RouteKey[] = ['A', 'B', 'C'];
const MEMBER_KINDS: readonly Member['kind'][] = ['man', 'veh', 'tube'];
const PLATOON_STATES: readonly PlatoonState[] = ['wait', 'approach', 'assault', 'hold', 'support', 'emplaced', 'broken', 'destroyed', 'overran'];
const EFFECT_KINDS: readonly FieldEffect['kind'][] = ['dust', 'muzzle', 'burst'];
const CUES: readonly (Cue | null)[] = [null, 'man', 'veh', 'dust', 'muzzle'];
const RADIO_STAGES: readonly RadioStage[] = ['off', 'idle', 'wait', 'loc', 'desc', 'ready', 'flight', 'adjust', 'effect'];
const bit = (b: boolean) => (b ? 1 : 0);
/** Index + 1 of an optional enum value, 0 when absent. */
const opt = <T>(list: readonly T[], x: T | undefined) => (x === undefined ? 0 : list.indexOf(x) + 1);

/** A 표적성질's target slots, absent ones as 0. */
function target(h: Hasher, t: Target): void {
  h.u32(TARGET_TYPES.indexOf(t.targetType));
  h.u32(opt(ACTIVITIES, 'activity' in t ? t.activity : undefined));
  h.u32(opt(UNITS, 'unit' in t ? t.unit : undefined));
  h.u32('count' in t ? t.count : 0);
}

export function hashState(state: SimState): string {
  const h = new Hasher();
  h.u32(state.tick);
  h.u32(PHASES.indexOf(state.phase));
  h.f64(state.op.x); // a walking post stands between whole metres
  h.f64(state.op.y);
  h.f64(state.knownOp.x);
  h.f64(state.knownOp.y);
  h.u32(bit(state.picked));
  h.u32(bit(state.reportDue));
  const post = state.post;
  h.u32(POST_STATES.indexOf(post.state));
  h.i32(post.departed);
  h.i32(post.until);
  h.u32(post.moves);
  h.u32(post.move ? 1 : 0);
  if (post.move) {
    const m = post.move;
    h.f64(m.to.x);
    h.f64(m.to.y);
    h.u32(m.pts.length);
    for (const q of m.pts) {
      h.f64(q.x);
      h.f64(q.y);
      h.f64(q.t);
    }
    h.f64(m.total);
    h.f64(m.dist);
    h.f64(m.forest);
  }
  h.u32(state.posReport ? 1 : 0);
  if (state.posReport) {
    h.u32(state.posReport.easting);
    h.u32(state.posReport.northing);
  }
  h.i32(state.compromised);
  h.u32(state.fire ? 1 : 0);
  if (state.fire) {
    h.u32(SHOOTERS.indexOf(state.fire.shooter));
    h.f64(state.fire.at.x);
    h.f64(state.fire.at.y);
    h.u32(state.fire.pid);
    h.u32(state.fire.fired);
  }
  h.u32(bit(state.observerLost));
  h.i32(state.clearTick);
  h.i32(state.endAt);
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
  h.u32(state.friendlies.length);
  for (const q of state.friendlies) {
    h.u32(q.pos);
    h.f64(q.hx);
    h.f64(q.hy);
    h.f64(q.x);
    h.f64(q.y);
    h.f64(q.tx);
    h.f64(q.ty);
    h.f64(q.ph);
    h.u32(bit(q.walker));
    h.i32(q.wait);
    h.u32(bit(q.moving));
    h.f64(q.dir);
    h.u32(bit(q.prone));
    h.u32(bit(q.alive));
    h.u32(bit(q.vis));
    h.i32(q.nextFire);
  }
  const k = state.truck;
  h.u32(k ? 1 : 0);
  if (k) {
    h.u32(k.path.length);
    for (const q of k.path) {
      h.f64(q.x);
      h.f64(q.y);
    }
    h.u32(k.i);
    h.i32(k.dirn);
    h.f64(k.x);
    h.f64(k.y);
    h.i32(k.wait);
    h.u32(bit(k.moving));
    h.f64(k.dir);
    h.i32(k.dustTick);
    h.u32(bit(k.vis));
  }
  h.u32(state.shells.length);
  for (const q of state.shells) {
    h.u32(q.pos);
    h.i32(q.at);
  }
  h.u32(state.shelledUntil.length);
  for (const t of state.shelledUntil) h.i32(t);
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
    h.u32(bit(e.tiny));
    h.u32(bit(e.vis));
  }
  h.u32(state.targets);
  h.u32(RADIO_STAGES.indexOf(state.radio.stage));
  h.u32(state.radio.lastTn);
  h.u32(state.missions.length);
  for (const m of state.missions) {
    h.u32(WARNINGS.indexOf(m.warning));
    const l = m.location; // none 0 · grid 1 · polar 2, then its values
    h.u32(l ? LOCATION_METHODS.indexOf(l.method) + 1 : 0);
    if (l && l.method === 'grid') {
      h.u32(l.easting);
      h.u32(l.northing);
    } else if (l) {
      h.u32(l.azimuth);
      h.u32(l.distance);
    }
    const d = m.description;
    h.u32(d ? 1 : 0);
    if (d) {
      h.u32(d.rounds);
      h.u32(FUZE_REQUESTS.indexOf(d.fuzeRequest));
      h.u32(CONTROLS.indexOf(d.control));
      h.u32(d.dangerClose);
      target(h, d);
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
    h.i32(m.target);
    h.u32(m.firstError === null ? 0 : 1 + m.firstError);
    h.u32(m.directionError === null ? 0 : 1 + m.directionError);
    h.u32(m.rangeCorrections.length);
    for (const r of m.rangeCorrections) h.u32(r);
    h.u32(m.corrections);
    h.u32(opt(EFFECTS, m.report ?? undefined));
    h.u32(opt(EFFECTS, m.truth ?? undefined));
    h.i32(m.truthPct);
    h.i32(m.score);
    h.u32(bit(m.dangerClose));
    h.u32(bit(m.dangerMissed));
    const sh = m.shift;
    h.u32(sh ? 1 : 0);
    if (sh) {
      h.u32(sh.targetNumber);
      h.u32(sh.direction);
      h.u32(opt(LATERAL_DIRS, sh.lateralDir));
      h.u32(sh.lateral ?? 0);
      h.u32(opt(RANGE_DIRS, sh.rangeDir));
      h.u32(sh.range ?? 0);
      h.u32(sh.rounds);
      h.u32(sh.dangerClose);
      target(h, sh);
    }
  }
  h.u32(state.queue.length);
  for (const q of state.queue) {
    h.i32(q.at);
    h.u32(ACTS.indexOf(q.act));
  }
  h.u32(MODES.indexOf(state.mode));
  h.u32(bit(state.trainingUsed));
  h.i32(state.aim.az);
  h.i32(state.aim.el);
  h.u32(bit(state.bino));
  h.u32(state.lases.length);
  for (const l of state.lases) {
    h.u32(l.tick);
    h.u32(l.az);
    h.i32(l.el);
    h.u32(l.range ? 1 : 0);
    if (l.range) {
      h.u32(l.range.dist);
      h.i32(l.range.vm);
      h.f64(l.range.x);
      h.f64(l.range.y);
      h.u32(bit(l.range.target));
    }
  }
  for (const name of STREAMS) {
    h.i32(state.rng[name].a);
    h.u32(state.rng[name].count);
  }
  h.i32(state.score);
  return h.hex();
}
