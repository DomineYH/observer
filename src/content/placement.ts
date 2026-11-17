import type { Confidence, Ref, RouteKey, Scenario } from '@sim';

/** 글: the 배치's name and 한 줄 소개 (on the screen from M3-13), the 작전 준비 글 (demo lines 925–933, in the scenario's
 * order) and the planned post's place name. Outside the scenario version. */
export interface Briefing {
  name: string;
  blurb: string;
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
  /** 일일 시작일 (ADR 0020): the first day, YYYYMMDD, it is a 일일 시나리오 candidate; outside every version. Never on a
   * 전장's first 배치, and once on main never changed (`시나리오: main에 들어간 일일 시작일은 그대로다`). */
  dailyFrom?: number;
}

