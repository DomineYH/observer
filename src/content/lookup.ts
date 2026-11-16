import type { CombatData, GunProfile, ReplayData, Ref, Scenario } from '@sim';
import { COMBAT } from './combat';
import { BASE_GUNS } from './guns';
import { MUNGYEONG_PLACEMENT } from './mungyeong';
import { MOCK_PLACEMENT, type Placement } from './placement';

/** The two 배치 in order. M3-6 turns this into the 배치 목록. */
export const PLACEMENTS: readonly Placement[] = [MOCK_PLACEMENT, MUNGYEONG_PLACEMENT];
export const GUNS: readonly GunProfile[] = [BASE_GUNS];

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
    guns: find('guns', GUNS, header.guns),
    ...(header.mode === 'combat' ? { combat: COMBAT } : {}),
  };
}
