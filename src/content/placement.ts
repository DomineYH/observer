import type { Confidence, Point, Ref, RouteKey, Scenario } from '@sim';

/** 글: the 작전 준비 글 (demo lines 925–933, in the scenario's
 * order) and the planned post's place name. Outside the scenario version. */
export interface Briefing {
  plannedOp: string;
  enemy: string;
  nais: string[];
  routes: { readonly [K in RouteKey]?: string };
  conf: Record<Confidence, string>;
  mission: string;
  caution: string;
}

/** 배치: one scenario, its 글, and the 전장 식별자 · 지형 판 it is laid on. One file each in `scenarios/`, named by the
 * scenario id; no file takes a value from another. */
export interface Placement {
  scenario: Scenario;
  briefing: Briefing;
  terrain: Ref;
}

/** The two base scenarios always have routes A, B and C. M3-9 drops this when the 배치 tests loop over every 배치. */
export type BaseScenario = Scenario & { routes: Readonly<Record<'A' | 'B' | 'C', readonly Point[]>> };
