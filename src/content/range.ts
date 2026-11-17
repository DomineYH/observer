import type { GunProfile, Point, Scenario } from '@sim';

/** 여유: room for the routes' jitter and the formations (#119 Q7, a game value). */
export const RANGE_MARGIN_M = 500;

/** The 싸움터's farthest point from the battery, m: every point of every route, each NAI circle's edge, the four corners
 * of each mortar box (units and 증원), every friendly position. The map square is not looked at. */
export function farthestM(s: Scenario): number {
  const d = (p: Point) => Math.sqrt((p.x - s.battery.x) ** 2 + (p.y - s.battery.y) ** 2);
  const points: Point[] = [...Object.values(s.routes).flatMap((r) => r ?? []), ...s.friends];
  for (const u of [...s.units, ...s.reinforcements]) {
    const nai = u.type === 'mortar' ? s.nais[u.nai] : undefined;
    if (u.type !== 'mortar' || !nai) continue;
    for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) points.push({ x: nai.x + (sx * u.spread.x) / 2, y: nai.y + (sy * u.spread.y) / 2 });
  }
  return Math.max(...points.map(d), ...s.nais.map((n) => d(n) + n.r));
}

/** 판 전 사거리 검사 (#119 Q7): the farthest point + 500 m is within the gun's 최대 사거리. Outside the simulation, which
 * never reads it: the 내용 검증 and, from M3-15, the 포 고르기 use it. */
export const inRange = (s: Scenario, guns: GunProfile): boolean => farthestM(s) + RANGE_MARGIN_M <= guns.maxRangeM;
