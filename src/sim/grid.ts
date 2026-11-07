// 국지 좌표 ↔ 방안좌표 (ADR 0006): the only place meters and 4+4 digits meet. 좌표자 and the map use these too.
import type { GridRef, Point } from './terrain';

const UNIT = 10; // 8자리 = 10 m

/** Meters → digits, truncated. No wrap: the 방안 하나 불변 조건 keeps the battlefield inside 0–99999. */
export function toGrid(x: number, y: number, g: GridRef): { e: number; n: number } {
  return { e: Math.floor((g.e0 + x) / UNIT), n: Math.floor((g.n0 + y) / UNIT) };
}

/** Digits → meters at the centre of the 10 m square. Any digits convert as they are. */
export function fromGrid(e: number, n: number, g: GridRef): Point {
  return { x: e * UNIT + UNIT / 2 - g.e0, y: n * UNIT + UNIT / 2 - g.n0 };
}
