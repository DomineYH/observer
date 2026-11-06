// 작전 준비와 개시 (demo lines 1424–1436): the 관측소 후보 and the start of the operation.
import type { Point, TerrainData } from './terrain';
import type { SimState } from './types';

const EDGE_M = 200; // candidates and move destinations keep this far inside every side of the map (B2)
// Game rule from the demo (line 1434: moved = distance > 50): within 50 m counts as the planned post. Demo values are
// canonical where they differ from the PRD without a defect (spec #19 범위), so this is not "any difference".
const MOVED_M = 50; // farther than this from the planned post, 위치 보고 is required

/** Inside the map with the 200 m margin on all four sides; exactly 200 m is allowed. */
export function onMap(t: TerrainData, x: number, y: number): boolean {
  const far = t.n * t.cell - EDGE_M;
  return x >= EDGE_M && x <= far && y >= EDGE_M && y <= far;
}

/** Applies `pick` or `start` ([동, 북] m) if the state allows it; false means ignored and nothing changed. */
export function applyPrep(s: SimState, t: TerrainData, plannedOp: Point, a: 'pick' | 'start', v: readonly number[]): boolean {
  const [x, y] = v as [number, number];
  if (s.phase !== 'prep' || !onMap(t, x, y)) return false;
  s.op = { x, y };
  if (a === 'pick') s.picked = true;
  else {
    s.reportDue = Math.sqrt((x - plannedOp.x) * (x - plannedOp.x) + (y - plannedOp.y) * (y - plannedOp.y)) > MOVED_M;
    s.phase = 'live';
  }
  return true;
}
