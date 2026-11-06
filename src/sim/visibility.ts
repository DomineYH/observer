// 가시 여부 (PRD 5.3, demo lines 536–552): the simulation decides what the observer can see, from the line of sight,
// the angular size and the visibility. Screen size and render quality play no part.
import { exp } from './math';
import { EYE_HEIGHT, heightAt, lineOfSight, type TerrainData } from './terrain';
import type { FieldEffect, Member, SimState, Weather } from './types';

/** Smallest angular height seen, mils: 1.7 m standing ≈ 1.1 km by eye, ≈ 5.7 km through binoculars. */
export const DET_MIL = { eye: 1.5, bino: 0.3 };
const OPAQUE = 0.9; // Koschmieder opacity past which nothing is seen
const LOS_AT = 0.85; // the sight line must reach this fraction of the target's height
const HEIGHT: Record<Member['kind'], number> = { man: 1.7, veh: 2.3, tube: 1.0 };
const PRONE_M = 0.45;

const effSize = (e: FieldEffect, age: number) => (e.kind === 'muzzle' ? (e.small ? 1.5 : 3) : 3) + age * 1.6;
/** Top of the dust or smoke `age` seconds after it was made: what the sight line must reach, and where it is drawn. */
export const effectTop = (e: Pick<FieldEffect, 'kind' | 'gz' | 'small'>, age: number) => e.gz + (e.kind === 'muzzle' ? 1 + age * (e.small ? 1.2 : 5) : 3);

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
        q.vis = visOf(q.x, q.y, hh, heightAt(t, q.x, q.y) + hh * LOS_AT);
      }
    }
  for (const e of s.effects) {
    if (!all && e.tick !== s.tick) continue;
    const age = (s.tick - e.tick) * 0.05;
    e.vis = visOf(e.x, e.y, effSize(e, age), effectTop(e, age));
  }
}
