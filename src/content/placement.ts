import type { Ref, RouteKey, Scenario } from '@sim';
import { BASE_SCENARIO, BRIEFING } from './scenario';

/** 작전 준비 글: the briefing texts and the planned post's place name. */
export type Briefing = Omit<typeof BRIEFING, 'routes'> & { routes: { readonly [K in RouteKey]?: string }; plannedOp: string };

/** 배치: one 전장's scenario, its 작전 준비 글, and the 전장 식별자 · 지형 판 it is laid on. */
export interface Placement {
  scenario: Scenario;
  briefing: Briefing;
  terrain: Ref;
}

export const MOCK_PLACEMENT: Placement = {
  scenario: BASE_SCENARIO,
  briefing: { ...BRIEFING, plannedOp: '1번 고지' },
  terrain: { id: 'mock', version: 1 },
};
