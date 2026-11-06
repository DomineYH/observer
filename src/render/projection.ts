// The observation view's one projection (demo lines 320–327, 377): every pixel ↔ angle conversion, the reticle and
// the azimuth tape use these functions, so a mil read on the scale is a mil in the drawn terrain.
import type { Point } from '@sim';

/** Mils per radian (6400 mils in a circle). */
export const MIL = 3200 / Math.PI;
/** 시야각 in mils: 육안 60°, 쌍안경 7°. */
export const FOV_MIL = { eye: (60 * 6400) / 360, bino: (7 * 6400) / 360 } as const;
/** 화질: internal render width (height is 9/16 of it). */
export const QUALITIES = { medium: 480, high: 640, max: 960 } as const;
export type Quality = keyof typeof QUALITIES;
export const DEFAULT_QUALITY: Quality = 'high';

export const fovOf = (bino: boolean): number => (bino ? FOV_MIL.bino : FOV_MIL.eye);
/** Focal length in pixels for a view `width` pixels wide. */
export const focalOf = (width: number, bino: boolean): number => width / 2 / Math.tan(fovOf(bino) / MIL / 2);
/** Horizontal (or vertical) pixel offset from the view centre of a direction `mil` off the line of sight. */
export const milToPx = (mil: number, focal: number): number => Math.tan(mil / MIL) * focal;
export const pxToMil = (px: number, focal: number): number => Math.atan(px / focal) * MIL;

export type Eye = Point & { z: number };
/** Where the last frame was drawn from: what `project` needs. Pixels are the view's internal pixels. */
export interface ViewGeometry {
  eye: Eye;
  h: number; // azimuth of the line of sight, mils
  focal: number;
  cx: number; // view centre column
  hor: number; // row of the horizon
}

/** Screen position of a world point (demo `proj`), or null when it is behind or within 5 m of the eye. */
export function project(v: ViewGeometry, p: Eye): { sx: number; sy: number; fwd: number } | null {
  const rx = p.x - v.eye.x;
  const ry = p.y - v.eye.y;
  const s = Math.sin(v.h / MIL);
  const c = Math.cos(v.h / MIL);
  const fwd = rx * s + ry * c;
  if (fwd < 5) return null;
  const lat = rx * c - ry * s;
  return { sx: v.cx + (lat / fwd) * v.focal, sy: v.hor + ((v.eye.z - p.z) / fwd) * v.focal, fwd };
}
