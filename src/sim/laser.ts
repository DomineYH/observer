// 레이저 (demo lines 1048–1074, PRD F-05): the range along the line the lase was sent on, to the ground (forest and
// buildings included) or to a seen enemy in the reticle's middle, with a 2 m error from the laser's own stream (B6):
// one gaussian (two draws) per lase that meets something, none for 반사 없음.
import { MIL } from './ballistics';
import { PICK_Z } from './intel';
import { atan2, cos, sin, tan } from './math';
import { gauss, type Stream } from './rng';
import { EYE_HEIGHT, heightAt, surfaceAt, type TerrainData } from './terrain';
import type { SimState } from './types';

const REACH = [1.5, 3] as const; // 표적 반사: within this many mils across and up/down of the line
const MAX_M = 12000;
const SIGMA_M = 2;
const KEEP = 5;
const wrap = (mil: number) => ((((mil + 3200) % 6400) + 6400) % 6400) - 3200;

/** `lase` [az, el] in 0.1 mils, once the operation has started. A lase that meets nothing is still a lase. */
export function applyLase(s: SimState, t: TerrainData, las: Stream, v: readonly number[]): boolean {
  if (s.phase !== 'live') return false;
  const az = v[0]! / 10;
  const el = v[1]! / 10;
  const dx = sin(az / MIL);
  const dy = cos(az / MIL);
  const rise = tan(el / MIL);
  const eye = heightAt(t, s.op.x, s.op.y) + EYE_HEIGHT;
  // The ground: 2 m steps out to 2.5 km, 5 m beyond (demo).
  let hit: { z: number; h: number; target: boolean } | null = null;
  for (let z = 10; z < MAX_M; z += z < 2500 ? 2 : 5) {
    const h = surfaceAt(t, s.op.x + dx * z, s.op.y + dy * z);
    if (h >= eye + rise * z) {
      hit = { z, h, target: false };
      break;
    }
  }
  // A seen member nearest the line (signals never reflect); it wins when nearer than the ground (5 m slack).
  let best = Infinity;
  s.platoons.forEach((p) => {
    if (p.state === 'wait') return;
    for (const q of p.members) {
      if (!q.vis) continue;
      const qx = q.x - s.op.x;
      const qy = q.y - s.op.y;
      const d = Math.sqrt(qx * qx + qy * qy);
      if (d < 5) continue;
      const z = heightAt(t, q.x, q.y) + (q.kind === 'veh' ? PICK_Z.veh : q.prone ? PICK_Z.prone : PICK_Z.other);
      const a = wrap(atan2(qx, qy) * MIL - az);
      const e = atan2(z - eye, d) * MIL - el;
      if (Math.abs(a) > REACH[0] || Math.abs(e) > REACH[1]) continue;
      const score = Math.sqrt((a / REACH[0]) * (a / REACH[0]) + (e / REACH[1]) * (e / REACH[1]));
      if (score < best && (!hit || hit.target || d < hit.z + 5)) {
        best = score;
        hit = { z: d, h: z, target: true };
      }
    }
  });
  let range = null;
  if (hit) {
    const dist = Math.round(hit.z + gauss(las) * SIGMA_M);
    range = { dist, vm: Math.round(atan2(hit.h - eye, hit.z) * MIL), x: s.op.x + dx * dist, y: s.op.y + dy * dist, target: hit.target };
  }
  s.lases.unshift({ tick: s.tick, az: v[0]!, el: v[1]!, range });
  if (s.lases.length > KEEP) s.lases.pop();
  return true;
}
