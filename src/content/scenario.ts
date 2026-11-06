import type { Point, Scenario } from '@sim';

// Identity only for now; the scenario slices add the enemy order of battle.
export const BASE_SCENARIO: Scenario = { id: 'base', version: 1 };

/** 포대 위치, off the map to the south (demo `BATT`). The fire-mission slice folds it into the scenario. */
export const BATTERY: Point = { x: 4200, y: -4600 };
