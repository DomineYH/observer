// 가시 여부 (PRD 5.3, demo lines 536–552): the simulation decides what the observer can see, from the line of sight,
// the angular size and the visibility. Screen size and render quality play no part.
import { cos, exp, sin } from './math';
import { EYE_HEIGHT, heightAt, lineOfSight, type TerrainData } from './terrain';
import type { FieldEffect, Member, SimState, Weather } from './types';

/** Smallest angular height seen, mils: 1.7 m standing ≈ 1.1 km by eye, ≈ 5.7 km through binoculars. */
export const DET_MIL = { eye: 1.5, bino: 0.3 };
const OPAQUE = 0.9; // Koschmieder opacity past which nothing is seen
const LOS_AT = 0.85; // the sight line must reach this fraction of the target's height
const HEIGHT: Record<Member['kind'], number> = { man: 1.7, veh: 2.3, tube: 1.0 };
const PRONE_M = 0.45;

/** Where a dust cloud or smoke puff is at `tick` (demo drawing, lines 1162–1176): its centre, carried downwind
 * (dust at 80% of the wind) and rising, and its radius, m. It is drawn, pressed and watched there. */
export function signalAt(e: Pick<FieldEffect, 'kind' | 'x' | 'y' | 'gz' | 'small' | 'tick'>, tick: number, w: Weather) {
  const age = (tick - e.tick) * 0.05;
  const to = ((w.windFromDeg + 180) * Math.PI) / 180; // the wind blows towards `windFromDeg` + 180°
  const drift = (w.windSpeedTenthMs / 10) * age * (e.kind === 'dust' ? 0.8 : 1);
  return {
    x: e.x + sin(to) * drift,
    y: e.y + cos(to) * drift,
    z: e.kind === 'dust' ? e.gz + 1.5 + age * 0.8 : e.gz + 1 + age * (e.small ? 1.2 : 5),
    r: (e.kind === 'dust' ? 3 : e.small ? 1.2 : 2.5) + age * 1.6,
  };
}

/** How a signal or a burst is detected (demo effSize/effTop, lines 544–551): its size, m, and the height the sight
 * line must reach, both at where it was made. The demo detects with these, apart from its drawing, so detection keeps
 * them. */
export function signalDetect(e: Pick<FieldEffect, 'kind' | 'gz' | 'small' | 'tick'>, tick: number) {
  const age = (tick - e.tick) * 0.05;
  if (e.kind === 'muzzle') return { size: (e.small ? 1.5 : 3) + age * 1.6, top: e.gz + 1 + age * (e.small ? 1.2 : 5) };
  if (e.kind === 'burst') return { size: 6 + age * 2.2, top: e.gz + 6 };
  return { size: 3 + age * 1.6, top: e.gz + 3 };
}

/** Recomputes 보임 for every member (`all`) or only for effects made this tick. */
export function updateVisibility(s: SimState, t: TerrainData, w: Weather, all: boolean): void {
  const eye = { x: s.op.x, y: s.op.y, z: heightAt(t, s.op.x, s.op.y) + EYE_HEIGHT };
  const sigma = 3.912 / w.visibilityM;
  const minMil = s.bino ? DET_MIL.bino : DET_MIL.eye;
  const visOf = (x: number, y: number, size: number, topZ: number): boolean => {
    const d = Math.sqrt((x - eye.x) * (x - eye.x) + (y - eye.y) * (y - eye.y));
    if (d < 5) return false;
    if (1 - exp(-sigma * d) > OPAQUE) return false;
    if ((size / d) * 1000 < minMil) return false;
    return lineOfSight(t, eye, { x, y, z: topZ });
  };
  if (all)
    for (const p of s.platoons) {
      if (p.state === 'wait') continue;
      for (const q of p.members) {
        const hh = q.prone ? PRONE_M : HEIGHT[q.kind];
        q.vis = q.alive && visOf(q.x, q.y, hh, heightAt(t, q.x, q.y) + hh * LOS_AT); // the dead are not seen
      }
    }
  for (const e of s.effects) {
    if (!all && e.tick !== s.tick) continue;
    const d = signalDetect(e, s.tick);
    e.vis = visOf(e.x, e.y, d.size, d.top);
  }
}
