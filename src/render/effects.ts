// 먼지와 사격 연기 (demo lines 1162–1176, disc 392): drawn into the low-resolution view before the dot look, only when
// the simulation has decided they are seen. They drift downwind and fade with age and distance.
import { effectTop, type ReadonlySimState, type Weather } from '@sim';
import { project, type ViewGeometry } from './projection';
import { atmosphere, hash } from './shade';
import type { ViewBuffers } from './voxel';

/** Where the wind carries smoke, m/s: it blows towards `windFromDeg` + 180°. */
export function windOf(w: Weather): { x: number; y: number } {
  const d = ((w.windFromDeg + 180) * Math.PI) / 180;
  const v = w.windSpeedTenthMs / 10;
  return { x: Math.sin(d) * v, y: Math.cos(d) * v };
}

// A soft disc blended into the buffer; `grain` leaves a speckle of holes.
function disc(buf: ViewBuffers, cx: number, cy: number, r: number, rgb: readonly number[], a: number, grain: number): void {
  const { w, h, pix } = buf;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || (grain && hash(x, y, grain) > 0.75)) continue;
      const k = a * (1 - (0.35 * d2) / r2);
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) pix[i + c] = pix[i + c]! * (1 - k) + rgb[c]! * k;
    }
}

const DUST = [156, 138, 100];
const FLASH = [255, 230, 160];
const SMOKE = [128, 126, 118];

export function drawEffects(buf: ViewBuffers, v: ViewGeometry, s: ReadonlySimState, w: Weather): void {
  const { sigma } = atmosphere(w);
  const wind = windOf(w);
  for (const e of s.effects) {
    if (!e.vis) continue;
    const age = (s.tick - e.tick) * 0.05;
    const t = age / (e.life * 0.05);
    const tr = Math.exp(-sigma * Math.hypot(e.x - v.eye.x, e.y - v.eye.y));
    const wx = wind.x * age;
    const wy = wind.y * age;
    if (e.kind === 'dust') {
      const p = project(v, { x: e.x + wx * 0.8, y: e.y + wy * 0.8, z: e.gz + 1.5 + age * 0.8 });
      if (p) disc(buf, p.sx, p.sy, Math.max(0.8, (3 + age * 1.6) * (v.focal / p.fwd)), DUST, 0.55 * (1 - t) * tr, 11);
      continue;
    }
    const size = e.small ? 1.2 : 2.5;
    const p = project(v, { x: e.x, y: e.y, z: e.gz });
    if (p && age < 0.15) disc(buf, p.sx, p.sy, Math.max(1, size * (v.focal / p.fwd)), FLASH, Math.sqrt(tr), 0);
    const q = project(v, { x: e.x + wx, y: e.y + wy, z: effectTop(e, age) });
    if (q) disc(buf, q.sx, q.sy, Math.max(0.8, (size + age * 1.6) * (v.focal / q.fwd)), SMOKE, 0.6 * (1 - t) * tr, 13);
  }
}
