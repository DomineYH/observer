// 지도 바탕 (demo lines 1263–1280): shaded cover colours, 20 m contours (every 100 m darker) and the 1 km 방안선.
import { COVER, fromGrid, toGrid, type TerrainData } from '@sim';

const PALETTE: Record<(typeof COVER)[number], readonly [number, number, number]> = {
  open: [152, 138, 84],
  field: [182, 162, 104],
  forest: [56, 76, 44],
  water: [78, 104, 122],
  road: [160, 150, 128],
  village: [176, 164, 128],
  building: [150, 72, 56],
};
const COLOURS = COVER.map((c) => PALETTE[c]);
const CONTOUR = 20;
const INK = [90, 60, 30] as const;

/** RGBA pixels, one per cell, north up. */
export function mapBase(t: TerrainData): Uint8ClampedArray {
  const { n, ground: g } = t;
  const px = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      // Lit from the north-west: brighter where the cell stands above its north-west neighbour.
      const hs = Math.min(1.25, Math.max(0.7, 1 + (g[k]! - g[Math.min(n - 1, j + 1) * n + Math.max(0, i - 1)]!) * 0.05));
      const c0 = Math.floor(g[k]! / CONTOUR);
      const ce = i < n - 1 ? Math.floor(g[k + 1]! / CONTOUR) : c0;
      const cn = j < n - 1 ? Math.floor(g[k + n]! / CONTOUR) : c0;
      // The contour crossed here is the upper band's floor; every fifth one (100 m) is the index contour.
      const a = c0 === ce && c0 === cn ? 0 : Math.max(c0, ce, cn) % 5 === 0 ? 0.6 : 0.35;
      const rgb = COLOURS[t.cover[k]!]!;
      const o = ((n - 1 - j) * n + i) * 4;
      for (let ch = 0; ch < 3; ch++) px[o + ch] = rgb[ch]! * hs * (1 - a) + INK[ch]! * a;
      px[o + 3] = 255;
    }
  return px;
}

export interface GridLine {
  axis: 'e' | 'n';
  at: number; // 국지 좌표 of the line, m
  label: string; // the two kilometre digits
}

/** 1 km 방안선 inside the map, placed and labelled with the conversion pair. */
export function gridLines(t: TerrainData): GridLine[] {
  const size = t.n * t.cell;
  const first = toGrid(0, 0, t.grid);
  const last = toGrid(size, size, t.grid);
  const lines: GridLine[] = [];
  const label = (km: number) => String(km % 100).padStart(2, '0');
  // fromGrid gives a 10 m square's centre; the line is its south-west edge.
  for (let km = Math.ceil(first.e / 100); km <= Math.floor(last.e / 100); km++)
    lines.push({ axis: 'e', at: fromGrid(km * 100, 0, t.grid).x - 5, label: label(km) });
  for (let km = Math.ceil(first.n / 100); km <= Math.floor(last.n / 100); km++)
    lines.push({ axis: 'n', at: fromGrid(0, km * 100, t.grid).y - 5, label: label(km) });
  return lines;
}
