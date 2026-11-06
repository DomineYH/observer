// 먼지와 사격 연기 (demo lines 1162–1176, disc 392): drawn into the low-resolution view before the dot look, only when
// the simulation has decided they are seen. They drift downwind and fade with age and distance.
import { signalAt, type ReadonlySimState, type Weather } from '@sim';
import { project, type ViewGeometry } from './projection';
import { atmosphere, hash } from './shade';
import type { ViewBuffers } from './voxel';

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
  for (const e of s.effects) {
    if (!e.vis) continue;
    const age = (s.tick - e.tick) * 0.05;
    const t = age / (e.life * 0.05);
    const tr = Math.exp(-sigma * Math.hypot(e.x - v.eye.x, e.y - v.eye.y));
    const c = signalAt(e, s.tick, w); // the same place the simulation sees, picks and watches
    const p = project(v, c);
    if (e.kind === 'dust') {
      if (p) disc(buf, p.sx, p.sy, Math.max(0.8, c.r * (v.focal / p.fwd)), DUST, 0.55 * (1 - t) * tr, 11);
      continue;
    }
    const f = age < 0.15 && project(v, { x: e.x, y: e.y, z: e.gz });
    if (f) disc(buf, f.sx, f.sy, Math.max(1, (e.small ? 1.2 : 2.5) * (v.focal / f.fwd)), FLASH, Math.sqrt(tr), 0);
    if (p) disc(buf, p.sx, p.sy, Math.max(0.8, c.r * (v.focal / p.fwd)), SMOKE, 0.6 * (1 - t) * tr, 13);
  }
}
