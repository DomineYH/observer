// 받기의 읽기 코드: node positions in lon/lat, the raster window that covers them, and the two samplers. Plain
// objects only, so the tests run it on synthetic rasters without a file.
import proj4 from 'proj4';
import type { Frame } from '../config';

/** [west, south, east, north] in degrees. */
export type Box = [number, number, number, number];

/** Lon/lat of every node; node k = j·n + i sits at (x0 + i·cell, y0 + j·cell), row 0 is the south row. */
export function nodeLonLat({ proj, x0, y0, n, cell }: Frame): { lon: Float64Array; lat: Float64Array; box: Box } {
  const toLonLat = proj4(proj, 'WGS84');
  const lon = new Float64Array(n * n);
  const lat = new Float64Array(n * n);
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const [x, y] = toLonLat.forward([x0 + i * cell, y0 + j * cell]) as [number, number];
      const k = j * n + i;
      lon[k] = x;
      lat[k] = y;
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  }
  return { lon, lat, box };
}

/** A north-up geographic image: origin is the outer corner (area) or the centre (point) of pixel (0, 0); resY < 0. */
export interface Geo {
  originX: number;
  originY: number;
  resX: number;
  resY: number;
  width: number;
  height: number;
  point: boolean; // GeoTIFF PixelIsPoint
}

/** [c0, r0, c1, r1), end exclusive. */
export type Window = [number, number, number, number];

export interface Raster {
  data: ArrayLike<number>;
  width: number;
  height: number;
  nodata: number | null;
  col: (lon: number) => number; // fractional pixel-centre index inside the window
  row: (lat: number) => number;
}

const centre0 = (g: Geo): [number, number] => (g.point ? [g.originX, g.originY] : [g.originX + g.resX / 2, g.originY + g.resY / 2]);

/** The pixels whose centres cover the box, plus a 2-pixel margin, clipped to the image. */
export function windowOf(g: Geo, [w, s, e, n]: Box): Window {
  const [cx, cy] = centre0(g);
  return [
    Math.max(0, Math.floor((w - cx) / g.resX) - 2),
    Math.max(0, Math.floor((n - cy) / g.resY) - 2),
    Math.min(g.width, Math.ceil((e - cx) / g.resX) + 3),
    Math.min(g.height, Math.ceil((s - cy) / g.resY) + 3),
  ];
}

export function rasterOf(g: Geo, [c0, r0, c1, r1]: Window, data: ArrayLike<number>, nodata: number | null): Raster {
  const [cx, cy] = centre0(g);
  return { data, width: c1 - c0, height: r1 - r0, nodata, col: (lon) => (lon - cx) / g.resX - c0, row: (lat) => (lat - cy) / g.resY - r0 };
}

/** Pixel (c, r) of the window, or undefined outside it (column and row checked apart: a flat index would wrap). */
const at = (r: Raster, c: number, j: number): number | undefined =>
  c >= 0 && c < r.width && j >= 0 && j < r.height ? r.data[j * r.width + c] : undefined;

/** Bilinear between the four nearest pixel centres; NaN when one is outside the window, NaN or nodata. */
export function bilinear(r: Raster, lon: number, lat: number): number {
  const u = r.col(lon);
  const v = r.row(lat);
  const i = Math.floor(u);
  const j = Math.floor(v);
  const p = [at(r, i, j), at(r, i + 1, j), at(r, i, j + 1), at(r, i + 1, j + 1)];
  if (p.some((x) => x === undefined || Number.isNaN(x) || x === r.nodata)) return NaN;
  const [a, b, c, d] = p as [number, number, number, number];
  const fx = u - i;
  const fy = v - j;
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Value of the pixel whose centre is nearest, or undefined outside the window. */
export const nearest = (r: Raster, lon: number, lat: number): number | undefined => at(r, Math.round(r.col(lon)), Math.round(r.row(lat)));
