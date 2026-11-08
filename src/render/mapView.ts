// 지도 보기: zoom, pan and the map pixel ↔ 국지 좌표 ↔ 방안좌표 conversions the map panel and 좌표자 use.
import { toGrid, type GridRef, type Point, type TerrainData } from '@sim';

/** 8자리 방안좌표 of a point, by the one conversion pair. */
export const gridOf = (g: GridRef, p: Point): { e: number; n: number } => toGrid(p.x, p.y, g);

/** A map press's 관측소 이동: the simulation's own plan, guard and forest test, so the preview is what it will do. */
export { moveCheck, planMove, underCanopy } from '@sim';

/** 지도 보기 (demo `MV`): zoom 1–8 and the top-left visible cell, counted from the west and from the north edge. */
export interface MapView {
  z: number;
  x0: number;
  y0: number;
}
export const FULL_VIEW: MapView = { z: 1, x0: 0, y0: 0 };

/** The point under a press at fractions (fx, fy) of the panel, in whole meters, with its 방안좌표 (좌표자, demo 1264). */
export type Pin = Point & { e: number; n: number };

export function pointAt(t: TerrainData, v: MapView, fx: number, fy: number): Pin {
  const span = t.n / v.z;
  const x = Math.round((v.x0 + fx * span) * t.cell);
  const y = Math.round((t.n - (v.y0 + fy * span)) * t.cell);
  return { x, y, ...gridOf(t.grid, { x, y }) };
}

const MAX_ZOOM = 8;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Zoom 1–8 and the visible square kept inside the map (demo mapClamp). */
function clampView(t: TerrainData, v: MapView): MapView {
  const z = clamp(v.z, 1, MAX_ZOOM);
  const room = t.n - t.n / z;
  return { z, x0: clamp(v.x0, 0, room), y0: clamp(v.y0, 0, room) };
}

/** Zoom by `f` keeping the point at panel fractions (fx, fy) under the cursor (demo mapZoomAt). */
export function zoomAt(t: TerrainData, v: MapView, f: number, fx: number, fy: number): MapView {
  const span = t.n / v.z;
  const cx = v.x0 + fx * span;
  const cy = v.y0 + fy * span;
  const z = clamp(v.z * f, 1, MAX_ZOOM);
  const s2 = t.n / z;
  return clampView(t, { z, x0: cx - fx * s2, y0: cy - fy * s2 });
}

/** Drag the map by panel fractions: the content follows the pointer. */
export const panBy = (t: TerrainData, v: MapView, dfx: number, dfy: number): MapView =>
  clampView(t, { z: v.z, x0: v.x0 - dfx * (t.n / v.z), y0: v.y0 - dfy * (t.n / v.z) });

/** Centre on a point at zoom `z` (demo mapCenterOn). */
export function centreOn(t: TerrainData, v: MapView, p: Point, z = v.z): MapView {
  const zz = clamp(z, 1, MAX_ZOOM);
  const span = t.n / zz;
  return clampView(t, { z: zz, x0: p.x / t.cell - span / 2, y0: t.n - p.y / t.cell - span / 2 });
}

/** Meters → map pixels for a view drawn `w` pixels wide, measured from the panel's west and south edges. */
export function projector(t: TerrainData, v: MapView, w: number) {
  const k = (w * v.z) / (t.n * t.cell); // pixels per meter
  const west = v.x0 * t.cell;
  const south = (t.n - v.y0 - t.n / v.z) * t.cell;
  return { k, x: (x: number) => (x - west) * k, y: (y: number) => w - (y - south) * k };
}
