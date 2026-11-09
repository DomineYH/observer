// 탄도 (demo lines 640, 662–669, 697–700, 800–803; PRD 6장): the adjusting round's flight time, where it falls, and how
// a correction moves the aim. Game numbers, not a firing table.
import { cos, sin } from './math';
import { gauss, next, type Stream } from './rng';
import type { Point } from './terrain';
import type { Weather } from './types';

export const MIL = 3200 / Math.PI; // mils per radian
const TAU = Math.PI * 2;
const PE_TO_SD = 0.6745; // 공산오차 = 0.6745 standard deviations

/** 포대 6문 W자 방열 (demo line 670): each gun's offset across (right +) and along (beyond +) the line of fire, m. */
export const SHEAF: readonly (readonly [lat: number, rng: number])[] = [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]];

/** 비과시간, s, for a range of `d` m. */
export const tofSec = (d: number) => 3 + (d / 1000) * 2.6;

const WIND_M_PER_MS = 6; // 기상 잔차 (demo line 698): downwind, per m/s
const TEMP_M_PER_C = 1.2; // and along the battery → 고정점 line, per °C off the standard 15 °C (cold falls short)
const STD_TEMP_C = 15;

/** 기상 잔차, m: the same for every mission of a game, added to each mission's random 비표준 조건 오차. */
export function weatherResidual(w: Weather, battery: Point, fixed: Point): Point {
  const to = ((w.windFromDeg + 180) * Math.PI) / 180; // the wind blows towards `windFromDeg` + 180°
  const v = (w.windSpeedTenthMs / 10) * WIND_M_PER_MS;
  const tk = (w.tempTenthC / 10 - STD_TEMP_C) * TEMP_M_PER_C;
  const fx = fixed.x - battery.x;
  const fy = fixed.y - battery.y;
  const f = Math.sqrt(fx * fx + fy * fy);
  return { x: sin(to) * v + (fx / f) * tk, y: cos(to) * v + (fy / f) * tk };
}

/** The random part of a mission's 비표준 조건 오차: 30–90 m in a random direction (two draws: size, then direction). */
export function drawBias(bal: Stream): Point {
  const b = 30 + next(bal) * 60;
  const a = next(bal) * TAU;
  return { x: sin(a) * b, y: cos(a) * b };
}

/** Where one round falls: aim + bias + 공산오차 along the line of fire (range: 1.5 m/km + 2 m) and across it
 * (deflection: 0.5 m/km + 1 m), plus the gun's `sheaf` offset (the centre gun has none). Range error is drawn first. */
export function fall(aim: Point, battery: Point, bias: Point, bal: Stream, sheaf: readonly [lat: number, rng: number] = [0, 0]): Point {
  const gx = aim.x - battery.x;
  const gy = aim.y - battery.y;
  const gd = Math.sqrt(gx * gx + gy * gy);
  const ux = gx / gd;
  const uy = gy / gd;
  const er = (gauss(bal) * ((1.5 * gd) / 1000 + 2)) / PE_TO_SD + sheaf[1];
  const ed = (gauss(bal) * ((0.5 * gd) / 1000 + 1)) / PE_TO_SD + sheaf[0];
  return { x: aim.x + bias.x + ux * er + uy * ed, y: aim.y + bias.y + uy * er - ux * ed };
}

/** A correction on the 기준선 `dirMil` (observer → target): `lat` m to the right (negative: left), `rng` m further
 * (negative: nearer). */
export function shifted(aim: Point, dirMil: number, lat: number, rng: number): Point {
  const a = dirMil / MIL;
  const ox = sin(a);
  const oy = cos(a);
  return { x: aim.x + oy * lat + ox * rng, y: aim.y - ox * lat + oy * rng };
}

/** 수정 스냅: to the nearest `step` m (좌우 10, 사거리 50), halves up. */
export const snap = (v: number, step: number) => Math.round(v / step) * step;
