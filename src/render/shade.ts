// Terrain colours for the observation view (demo genTerrain colours, lines 279–287, and shadeTerrain, 289–304),
// worked out once per terrain and weather. The cover class comes from the terrain data; the speckle is render's own.
import { COVER, type TerrainData, type Weather } from '@sim';

const C = Object.fromEntries(COVER.map((c, i) => [c, i])) as Record<(typeof COVER)[number], number>;
export type RGB = readonly [number, number, number];
const ROOFS: readonly RGB[] = [[150, 72, 56], [72, 92, 132], [122, 122, 116], [82, 112, 92], [172, 104, 62], [196, 190, 178]];
const FIELDS: readonly RGB[] = [[182, 162, 104], [164, 150, 92], [148, 126, 78]];

/** Uniform in [0, 1) from a cell and a salt (the terrain generator's integer hash). */
export function hash(ix: number, iy: number, s: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth value noise in [-1, 1) and its octaves (demo vnoise and fbm, lines 214–215).
function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = (x - ix) * (x - ix) * (3 - 2 * (x - ix));
  const fy = (y - iy) * (y - iy) * (3 - 2 * (y - iy));
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) * 2 - 1;
}

export function fbm(x: number, y: number, s: number, o: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < o; i++) {
    v += a * vnoise(x * f, y * f, s + i * 17);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const field = (x: number, y: number) => FIELDS[(((Math.floor(x / 160) + Math.floor(y / 120) * 2) % 3) + 3) % 3]!;

function baseColour(t: TerrainData, i: number, j: number): RGB {
  const k = j * t.n + i;
  const x = i * t.cell;
  const y = j * t.cell;
  switch (t.cover[k]) {
    case C.building: return ROOFS[Math.floor(hash(i, j, 21) * 6)]!;
    case C.road: return [160, 150, 128];
    case C.water: return [78, 104, 122];
    case C.village:
      if (hash(i, j, 23) > 0.35) return [176, 164, 128];
      // A roofless village cell falls through to the demo's field-or-open test (demo 283).
      return t.ground[k]! < 175 && fbm(x / 500, y / 500, 83, 3) > -0.15 ? field(x, y) : [152, 138, 84];
    case C.forest:
      if (hash(i, j, 13) > 0.86) return [152, 108, 48];
      return fbm(x / 400, y / 400, 71, 2) > 0 ? [56, 76, 44] : [126, 90, 46];
    case C.field: return field(x, y);
    default: return [152, 138, 84];
  }
}

export interface TerrainColours {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  light: Float32Array; // the lighting factor each cell got (building walls reuse it)
}

/** Lit colour per cell: low west-south-west sun, valleys darker and ridges lighter, flatter light under cloud. */
export function terrainColours(t: TerrainData, weather: Weather): TerrainColours {
  const { n, cell, surface: S, ground: G, cover } = t;
  const out = { r: new Uint8Array(n * n), g: new Uint8Array(n * n), b: new Uint8Array(n * n), light: new Float32Array(n * n) };
  const cloud = weather.cloudPct / 100;
  const sunAz = (250 * Math.PI) / 180;
  const sunEl = ((32 - weather.cloudPct * 0.05) * Math.PI) / 180;
  const L = [Math.sin(sunAz) * Math.cos(sunEl), Math.cos(sunAz) * Math.cos(sunEl), Math.sin(sunEl)] as const;
  const dirK = 1.05 * (1 - 0.65 * cloud);
  const amb = 0.42 + 0.3 * cloud;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
      let nx = -(S[j * n + i1]! - S[j * n + i0]!) / (2 * cell);
      let ny = -(S[j1 * n + i]! - S[j0 * n + i]!) / (2 * cell);
      let nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;
      let lit = amb + dirK * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      let avg = 0;
      for (let dj = -6; dj <= 6; dj += 6)
        for (let di = -6; di <= 6; di += 6) avg += G[clamp(j + dj, 0, n - 1) * n + clamp(i + di, 0, n - 1)]!;
      lit *= clamp(1 + (G[k]! - avg / 9) * 0.012, 0.78, 1.12);
      const c = cover[k];
      const solid = c === C.forest || c === C.building;
      if (!solid && c !== C.road && 1 - nz > 0.22) lit *= 0.93;
      const m = lit * (1 + hash(i, j, 9) * 0.12 - 0.06 + (solid ? 0 : 0.16 * fbm(i * 0.23, j * 0.23, 91, 2)));
      const [r, g, b] = baseColour(t, i, j);
      out.r[k] = clamp(r * m, 0, 255);
      out.g[k] = clamp(g * m, 0, 255);
      out.b[k] = clamp(b * m, 0, 255);
      out.light[k] = m;
    }
  return out;
}

export interface Atmosphere {
  sigma: number; // extinction per metre (Koschmieder: 2% contrast at the visibility)
  fog: RGB;
  sky: readonly [top: RGB, bottom: RGB];
}

/** Fog and sky colours from the weather (demo setWeather). */
export function atmosphere(w: Weather): Atmosphere {
  const c = w.cloudPct / 100;
  const wet = w.precipTenthMmH > 0 || w.humidityPct >= 95; // the demo wets fog by its weather code, not in our value
  const fog: RGB = [Math.round(198 - 22 * c - (wet ? 14 : 0)), Math.round(200 - 18 * c - (wet ? 10 : 0)), Math.round(196 - 8 * c - (wet ? 4 : 0))];
  return { sigma: 3.912 / w.visibilityM, fog, sky: [[Math.round(120 + 40 * c), Math.round(147 + 18 * c), Math.round(188 - 20 * c)], fog] };
}
