// 효과 관측 in training (demo afterFFE, line 795): the real casualties of the unit the mission hit hardest.
import type { ReadonlySimState, UnitType } from '@sim';

const NAME: Record<UnitType, string> = { inf: '적 보병', recon: '적 정찰조', apc: '적 장갑차', mortar: '적 박격포반' };

/** "(훈련) 표적 2 실제 사상 9/30 (30%)" for the unit with the most kills in the current mission (ties: the first), or null
 * when its rounds killed nobody. A unit not yet found goes by its kind. */
export function casualtyNote(s: Pick<ReadonlySimState, 'missions' | 'platoons'>): string | null {
  const kills = s.missions.at(-1)?.kills ?? [];
  let best = -1;
  kills.forEach((k, i) => {
    if (k > 0 && (best < 0 || k > kills[best]!)) best = i;
  });
  const p = s.platoons[best];
  if (!p) return null;
  const dead = p.members.filter((m) => !m.alive).length;
  const name = p.intel.stage > 0 ? `표적 ${p.intel.tnum}` : NAME[p.type];
  return `(훈련) ${name} 실제 사상 ${dead}/${p.members.length} (${Math.round((dead / p.members.length) * 100)}%)`;
}
