// 탐지와 적정 (PRD 5.2, demo lines 517–567, 1048–1086): a press names angles only and the simulation picks what was
// pressed; watching a found unit through the binoculars then reveals its type and activity, and later its size.
import { atan2 } from './math';
import type { Activity, Unit } from './radio';
import { EYE_HEIGHT, heightAt, type TerrainData } from './terrain';
import type { Cue, Platoon, SimState, Weather } from './types';
import { signalAt } from './visibility';

const MIL = 3200 / Math.PI;
/** How far from a press a seen thing may be, mils across and up/down: 쌍안경 3 × 4.5, 육안 12 × 18. */
const REACH = { bino: [3, 4.5], eye: [12, 18] } as const;
/** 쌍안경 안: within 42% of the 7° field either side of the line of sight. */
const WATCH_MIL = ((7 * 6400) / 360) * 0.42;
const PICK_Z = { veh: 1.2, prone: 0.25, other: 0.9 }; // where on a member a press lands, m above the ground
const HALF_TICKS_PER_S = 40;
const SCORE = { found: 10, sized: 20 };

const wrap = (mil: number) => ((((mil + 3200) % 6400) + 6400) % 6400) - 3200;
const eyeOf = (s: SimState, t: TerrainData) => ({ x: s.op.x, y: s.op.y, z: heightAt(t, s.op.x, s.op.y) + EYE_HEIGHT });
const azFrom = (s: SimState, p: Platoon) => (atan2(p.x - s.op.x, p.y - s.op.y) * MIL + 6400) % 6400;

/** 식별 `[az, el]` in 0.1 mils: the seen member, or painted signal disc, nearest the press, in reach, is found. False
 * when none is. */
export function applyId(s: SimState, t: TerrainData, w: Weather, v: readonly number[]): boolean {
  if (s.phase !== 'live') return false;
  const eye = eyeOf(s, t);
  const az = v[0]! / 10;
  const el = v[1]! / 10;
  const [ra, re] = REACH[s.bino ? 'bino' : 'eye'];
  let best = Infinity; // how far the best hit so far lies outside its shape, in reaches
  let bestMid = Infinity; // and from its centre: a tie goes to the nearer centre
  let pid = -1; // the unit of the best hit so far
  let cue: Cue = 'man';
  /** A seen thing centred at x, y, z; a signal is a disc of `rm` metres, a member a point. */
  const test = (x: number, y: number, z: number, rm: number, of: number, what: Cue) => {
    const dx = x - eye.x;
    const dy = y - eye.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 5) return;
    const a = wrap(atan2(dx, dy) * MIL - az);
    const e = atan2(z - eye.z, d) * MIL - el;
    const r = rm > 0 ? atan2(rm, d) * MIL : 0; // the disc as painted, mils
    // From the nearest point of the disc, then judged as a member is: the reach box and the score.
    const h = Math.sqrt(a * a + e * e);
    const k = h > r ? (h - r) / h : 0;
    if (Math.abs(k * a) > ra || Math.abs(k * e) > re) return; // k is 1 for a member: its rule is unchanged
    const oa = (k * a) / ra;
    const oe = (k * e) / re;
    const score = Math.sqrt(oa * oa + oe * oe);
    const mid = Math.sqrt((a / ra) * (a / ra) + (e / re) * (e / re));
    if (score < best || (score === best && mid < bestMid)) {
      best = score;
      bestMid = mid;
      pid = of;
      cue = what;
    }
  };
  s.platoons.forEach((p, i) => {
    if (p.state === 'wait') return;
    for (const q of p.members)
      if (q.vis) test(q.x, q.y, heightAt(t, q.x, q.y) + (q.kind === 'veh' ? PICK_Z.veh : q.prone ? PICK_Z.prone : PICK_Z.other), 0, i, q.kind === 'veh' ? 'veh' : 'man');
  });
  for (const e of s.effects) {
    if (!e.vis || e.kind === 'burst') continue; // our own 탄착 points at no enemy unit
    const c = signalAt(e, s.tick, w); // where and how large the view draws it
    test(c.x, c.y, c.z, c.r, e.pid, e.kind);
  }
  if (pid < 0) return false;
  const p = s.platoons[pid]!;
  const I = p.intel;
  I.seenAz = azFrom(s, p);
  I.seenTick = s.tick;
  if (I.stage === 0) {
    I.stage = 1;
    I.tnum = ++s.targets;
    I.cue = cue;
    I.firstTick = s.tick;
    s.score += SCORE.found;
  }
  return true;
}

/** 규모 from the most seen at once: 22 or more men a platoon, 12–21 a platoon (−), 5–11 a squad. */
function sizeOf(p: Platoon): { unit: Unit; n: number } {
  const n = p.intel.seenMax;
  if (p.type === 'apc') return { unit: 'vehicles', n: Math.max(1, n) };
  if (p.type === 'mortar') return p.intel.tubes ? { unit: 'tubes', n: p.intel.tubes } : { unit: 'none', n: 0 };
  if (n >= 22) return { unit: 'platoon', n };
  if (n >= 12) return { unit: 'platoon_minus', n };
  if (n >= 5) return { unit: 'squad', n };
  return { unit: 'men', n: Math.max(1, n) };
}

/** One tick of watching through the binoculars: found units in the field of view gain observation time. */
export function updateIntel(s: SimState, w: Weather): void {
  if (!s.bino) return;
  const aim = s.aim.az / 10;
  const inView = (x: number, y: number) => Math.abs(wrap(atan2(x - s.op.x, y - s.op.y) * MIL - aim)) <= WATCH_MIL;
  const signal = new Set<number>();
  for (const e of s.effects) {
    if (!e.vis || e.kind === 'burst') continue;
    const c = signalAt(e, s.tick, w); // where it is seen now, not where it was made
    if (inView(c.x, c.y)) signal.add(e.pid);
  }
  s.platoons.forEach((p, pid) => {
    const I = p.intel;
    if (I.stage < 1 || p.state === 'wait') return;
    let men = 0;
    let tubes = 0;
    for (const q of p.members)
      if (q.vis && inView(q.x, q.y)) {
        if (q.kind === 'tube') tubes++;
        else men++;
      }
    if (!men && !tubes && !signal.has(pid)) return;
    I.seenAz = azFrom(s, p);
    I.seenTick = s.tick;
    if (I.stage >= 3) return;
    I.prog += men || tubes ? 2 : 1;
    I.seenMax = Math.max(I.seenMax, men);
    I.tubes = Math.max(I.tubes, tubes);
    // 관측 시간: 3 s + 2.5 s/km to the type, then 6 s + 4 s/km more to the size, from the unit's distance now.
    const km = Math.sqrt((p.x - s.op.x) * (p.x - s.op.x) + (p.y - s.op.y) * (p.y - s.op.y)) / 1000;
    const t1 = 3 + 2.5 * km;
    const t2 = t1 + 6 + 4 * km;
    if (I.stage === 1 && I.prog >= t1 * HALF_TICKS_PER_S) I.stage = 2;
    else if (I.stage === 2 && I.prog >= t2 * HALF_TICKS_PER_S) {
      I.stage = 3;
      I.size = sizeOf(p);
      s.score += SCORE.sized;
    }
  });
}

/** 활동 (demo actOf): infantry assaulting attacks; APCs fired within 30 s and the mortar within 70 s are firing. */
export function activityOf(p: Platoon, tick: number): Activity {
  const fired = (s: number) => p.lastFire >= 0 && tick - p.lastFire < s * 20;
  if (p.type === 'inf' && p.state === 'assault' && tick >= p.pinnedUntil) return 'attacking';
  if (p.type === 'apc' && !p.moving && fired(30)) return 'firing';
  if (p.type === 'mortar') return fired(70) ? 'firing' : 'halted';
  return p.moving ? 'moving' : 'halted';
}
