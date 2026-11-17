import type { CombatData, GunProfile, ReplayData, Ref, Scenario } from '@sim';
import { COMBAT } from './combat';
import { GUNS } from './guns';
import type { Placement } from './placement';
import { BASE } from './scenarios/base';
import { APC_MUNGYEONG } from './scenarios/apc-mungyeong';
import { BASE_MUNGYEONG } from './scenarios/base-mungyeong';

/** 배치 목록: every 배치 of this build, in order. A new 배치 goes at the end; a 전장's first 배치 is its 기본 시나리오. */
export const PLACEMENTS: readonly Placement[] = [BASE, BASE_MUNGYEONG, APC_MUNGYEONG];
export { GUNS };

function find<T extends Ref>(kind: string, list: readonly T[], want: Ref): T {
  const found = list.find((x) => x.id === want.id);
  if (!found) throw new Error(`${kind} ${want.id}: unknown id`);
  if (found.version !== want.version)
    throw new Error(`${kind} ${want.id}@${want.version}: unknown version (this build has ${found.id}@${found.version})`);
  return found;
}

/** 찾기 함수: 재생 자료 머리 → the content it names, and for a combat header the 실전 자료. Throws naming what is unknown. */
export function contentOf(header: Pick<ReplayData, 'scenario' | 'guns'> & Partial<Pick<ReplayData, 'mode' | 'combatDataVersion'>>): {
  scenario: Scenario;
  guns: GunProfile;
  combat?: CombatData;
} {
  if (header.mode === 'combat' && header.combatDataVersion !== COMBAT.version)
    throw new Error(`combat@${header.combatDataVersion}: unknown version (this build has combat@${COMBAT.version})`);
  return {
    scenario: find('scenario', PLACEMENTS.map((p) => p.scenario), header.scenario),
    guns: find('guns', GUNS.map((g) => g.profile), header.guns),
    ...(header.mode === 'combat' ? { combat: COMBAT } : {}),
  };
}
