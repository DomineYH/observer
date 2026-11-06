// Authored features of the mock battlefield (demo lines 207–237). They stay fixed for every seed.
import type { GridRef, Point } from '@sim';

export const N = 1024;
export const CELL = 10;

/** 방안 기준: 찰리호텔, 원점 동 40000·북 30000. */
export const GRID: GridRef = { letters: 'CH', e0: 40000, n0: 30000 };

/** The planned observation post's hill (1번 고지). Keep equal to the scenario's planned OP. */
export const OP_HILL: Point = { x: 5120, y: 1800 };
/** Low rises under the friendly platoons. Keep equal to the scenario's friendly positions. */
export const FRIEND_HILLS: readonly Point[] = [
  { x: 4350, y: 3380 },
  { x: 5150, y: 3460 },
  { x: 5950, y: 3380 },
];

export interface VillageSite {
  name: string;
  x: number; // multiples of CELL: the flattening reads the cell at the centre
  y: number;
  r: number;
  houses: number;
  town?: boolean;
}

export const VILLAGES: readonly VillageSite[] = [
  { name: '청계읍', x: 4300, y: 1050, r: 330, houses: 120, town: true },
  { name: '새터마을', x: 4720, y: 2930, r: 170, houses: 28 },
  { name: '솔미리', x: 6350, y: 3020, r: 160, houses: 22 },
  { name: '아랫말', x: 3200, y: 3250, r: 140, houses: 16 },
  { name: '갈골', x: 3700, y: 4450, r: 150, houses: 18 },
  { name: '북원리', x: 5650, y: 5350, r: 170, houses: 24 },
  { name: '윗말', x: 2700, y: 6250, r: 120, houses: 12 },
];

/** Road waypoints; the centreline wiggles between them. */
export const ROADS: readonly (readonly Point[])[] = [
  [{ x: 300, y: 3150 }, { x: 3200, y: 3250 }, { x: 4720, y: 2930 }, { x: 5600, y: 3100 }, { x: 6350, y: 3020 }, { x: 9900, y: 3200 }], // 골짜기 도로
  [{ x: 4300, y: 1050 }, { x: 4380, y: 1800 }, { x: 4500, y: 2500 }, { x: 4720, y: 2930 }], // 청계읍 → 고개 → 새터
  [{ x: 4720, y: 2930 }, { x: 4900, y: 3900 }, { x: 5650, y: 5350 }, { x: 5900, y: 6900 }, { x: 6100, y: 9900 }], // 북쪽 도로(다리)
  [{ x: 3200, y: 3250 }, { x: 3700, y: 4450 }, { x: 2700, y: 6250 }, { x: 2400, y: 9900 }],
  [{ x: 3700, y: 4450 }, { x: 5650, y: 5350 }],
  [{ x: 300, y: 900 }, { x: 4300, y: 1050 }, { x: 9900, y: 1300 }],
];
