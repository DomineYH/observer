// 지형 자료 and the simulation's queries on it. The data arrives finished from the 지형 원천.
import { Hasher } from './hash';

export const COVER = ['open', 'field', 'forest', 'water', 'road', 'village', 'building'] as const;
export type Cover = (typeof COVER)[number];

/** The observer's eye above the ground at the observation post, m (demo `EYE_H`: standing, binoculars on a tripod). */
export const EYE_HEIGHT = 3.5;

/** 국지 좌표 in meters: x east, y north. */
export interface Point {
  x: number;
  y: number;
}

/** 방안 기준: 방안 문자 and the 동·북 values of the local origin. */
export interface GridRef {
  letters: string;
  e0: number;
  n0: number;
}

export interface Village {
  name: string;
  x: number;
  y: number;
  r: number;
}

/** 지형 자료. Cell (i, j) is index j*n + i at x = i*cell, y = j*cell. */
export interface TerrainData {
  n: number;
  cell: number;
  ground: Float32Array; // 지면 높이
  surface: Float32Array; // 지면 + 숲 + 건물
  cover: Uint8Array; // index into COVER
  buildings: Float32Array; // building height per cell, 0 = none
  roads: readonly (readonly Point[])[]; // centrelines
  villages: readonly Village[];
  grid: GridRef;
}

// Demo `refl`: points off the map read the mirrored terrain.
function reflect(v: number, size: number): number {
  if (v < 0) v = -v;
  const m = size - 1e-3;
  if (v > m) {
    v = 2 * m - v;
    if (v < 0) v = 0;
  }
  return v;
}

// Demo `sampleH`: bilinear in the cell grid.
function sample(arr: Float32Array, t: TerrainData, x: number, y: number): number {
  const span = (t.n - 1) * t.cell;
  const u = reflect(x, span) / t.cell;
  const v = reflect(y, span) / t.cell;
  const ix = Math.min(Math.floor(u), t.n - 2);
  const iy = Math.min(Math.floor(v), t.n - 2);
  const fx = u - ix;
  const fy = v - iy;
  const k = iy * t.n + ix;
  const a = arr[k]!;
  const b = arr[k + 1]!;
  const c = arr[k + t.n]!;
  const d = arr[k + t.n + 1]!;
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 지면 높이 at a point (m). */
export const heightAt = (t: TerrainData, x: number, y: number): number => sample(t.ground, t, x, y);

/** 표면 높이 (ground + forest + buildings) at a point (m). */
export const surfaceAt = (t: TerrainData, x: number, y: number): number => sample(t.surface, t, x, y);

/** 가시선 between two points at absolute heights z (m): blocked by terrain, forest and buildings. Endpoints are not sampled. */
export function lineOfSight(t: TerrainData, a: Point & { z: number }, b: Point & { z: number }): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // ponytail: demo sampling (game rule): every 15 m, at most 400 samples. Beyond 6 km samples spread out, and from
  // 8 km (20 m apart) a lone 10 m cell such as one building can fall between them and not block. Changing it changes
  // results: raise SIM_VERSION and regenerate the goldens.
  const steps = Math.min(400, Math.max(8, Math.floor(Math.sqrt(dx * dx + dy * dy) / 15)));
  for (let s = 1; s < steps; s++) {
    const f = s / steps;
    if (surfaceAt(t, a.x + dx * f, a.y + dy * f) > a.z + (b.z - a.z) * f) return false;
  }
  return true;
}

const bits = (a: Float32Array) => new Uint32Array(a.buffer, a.byteOffset, a.length);
function text(h: Hasher, s: string): void {
  h.u32(s.length);
  for (let i = 0; i < s.length; i++) h.u32(s.charCodeAt(i));
}

/** 지형 해시: hashed once after generation for the golden header. Fixed field order; Float32 cells as their bits. */
export function terrainHash(t: TerrainData): string {
  const h = new Hasher();
  h.u32(t.n);
  h.f64(t.cell);
  text(h, t.grid.letters);
  h.f64(t.grid.e0);
  h.f64(t.grid.n0);
  for (const a of [t.ground, t.surface, t.buildings]) for (const x of bits(a)) h.u32(x);
  for (const c of t.cover) h.byte(c);
  h.u32(t.villages.length);
  for (const v of t.villages) {
    text(h, v.name);
    h.f64(v.x);
    h.f64(v.y);
    h.f64(v.r);
  }
  h.u32(t.roads.length);
  for (const road of t.roads) {
    h.u32(road.length);
    for (const p of road) {
      h.f64(p.x);
      h.f64(p.y);
    }
  }
  return h.hex();
}
