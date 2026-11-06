import type { Point, Scenario } from '@sim';

// Identity only for now; the scenario slices add the enemy order of battle.
export const BASE_SCENARIO: Scenario = { id: 'base', version: 1 };

/** 포대 위치, off the map to the south (demo `BATT`). The fire-mission slice folds it into the scenario. */
export const BATTERY: Point = { x: 4200, y: -4600 };

/** 계획된 관측소 (1번 고지, demo `PLANNED_OP`). Keep equal to the mock terrain's `OP_HILL`. Until the 작전 준비 slice
 * puts the observation post in the simulation, the observation view looks from here. */
export const PLANNED_OP: Point = { x: 5120, y: 1800 };
