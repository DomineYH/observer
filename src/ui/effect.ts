// 효과 관측 (demo afterFFE and shortOf, lines 535, 793–797): the unit the mission hit hardest, its real casualties in
// training, and the name the 전과 보고 will give it.
import type { ReadonlySimState, TargetNameSlots, UnitType } from '@sim';

const NAME: Record<UnitType, string> = { inf: '적 보병', recon: '적 정찰조', apc: '적 장갑차', mortar: '적 박격포반' };
type Seen = Pick<ReadonlySimState, 'missions' | 'platoons'>;

/** The unit with the most kills in the current mission (ties: the first) among those a round landed within 220 m of, 0
 * kills included (demo bestPlatoon); −1 when it struck none. */
function hardestHit(s: Seen): number {
  const kills = s.missions.at(-1)?.kills ?? [];
  let best = -1;
  kills.forEach((k, i) => {
    if (k !== null && (best < 0 || k > kills[best]!)) best = i;
  });
  return best;
}

/** "(훈련) 표적 2 실제 사상 9/30 (30%)" for the unit hit hardest, or null when it struck none. A unit not yet found goes by
 * its kind. */
export function casualtyNote(s: Seen): string | null {
  const p = s.platoons[hardestHit(s)];
  if (!p) return null;
  const dead = p.members.filter((m) => !m.alive).length;
  const name = p.intel.stage > 0 ? `표적 ${p.intel.tnum}` : NAME[p.type];
  return `(훈련) ${name} 실제 사상 ${dead}/${p.members.length} (${Math.round((dead / p.members.length) * 100)}%)`;
}

/** 효과 보고의 표적 이름 for the preview: the unit hit hardest, else the mission's target, by what the observer knows of it
 * (병종 from stage 2, 규모 from stage 3). The simulation decides the name it says by the same rule (sim report.ts). */
export function reportName(s: Seen): TargetNameSlots {
  const hit = hardestHit(s);
  const p = s.platoons[hit >= 0 ? hit : (s.missions.at(-1)?.target ?? -1)];
  const stage = p ? p.intel.stage : 0;
  if (!p || stage < 2) return { targetName: 'unknown' };
  if (p.type === 'apc') return { targetName: 'apc' };
  if (p.type === 'mortar') return { targetName: 'mortar', named: stage === 3 ? 1 : 0 };
  if (p.type === 'recon' && stage === 3) return { targetName: 'recon' };
  return { targetName: 'infantry', named: stage === 3 && p.type === 'inf' ? 1 : 0 };
}
