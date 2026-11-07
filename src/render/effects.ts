// 먼지와 사격 연기 and our own 탄착 (demo lines 1162–1182, disc 392): drawn into the low-resolution view before the dot
// look, only when the simulation has decided they are seen. Dust and smoke drift downwind and fade with age and
// distance; a burst's smoke does not drift yet (smoke flow comes with the weather slice, M1-15). A 접근신관 burst
// flashes 7 m up and leaves a dark puff there over the earth thrown up below it.
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
const BURST_FLASH = [255, 238, 170];
const EARTH = [104, 94, 78]; // 연기·흙먼지 of a burst
const AIRBURST = [64, 64, 66]; // 접근신관's puff
const VT_HEIGHT_M = 7;

export function drawEffects(buf: ViewBuffers, v: ViewGeometry, s: ReadonlySimState, w: Weather): void {
  const { sigma } = atmosphere(w);
  for (const e of s.effects) {
    if (!e.vis) continue;
    const age = (s.tick - e.tick) * 0.05;
    const t = age / (e.life * 0.05);
    const tr = Math.exp(-sigma * Math.hypot(e.x - v.eye.x, e.y - v.eye.y));
    if (e.kind === 'burst') {
      const up = e.vt ? VT_HEIGHT_M : 0;
      const f = age < 0.3 && project(v, { x: e.x, y: e.y, z: e.gz + up });
      if (f) disc(buf, f.sx, f.sy, Math.max(1.6, 8 * (v.focal / f.fwd)), BURST_FLASH, Math.sqrt(tr), 0);
      if (age <= 0.05) continue;
      const rise = 4 + age * 2.4;
      const r = (fwd: number) => Math.max(1.2, (6 + age * 2.2) * (v.focal / fwd));
      const a = e.vt && project(v, { x: e.x, y: e.y, z: e.gz + up + rise });
      if (a) disc(buf, a.sx, a.sy, r(a.fwd) * 0.9, AIRBURST, 0.8 * (1 - t) * tr, 7);
      const p = project(v, { x: e.x, y: e.y, z: e.gz + rise * (e.vt ? 0.4 : 1) });
      if (p) disc(buf, p.sx, p.sy, r(p.fwd), EARTH, 0.78 * (1 - t) * tr, 3);
      continue;
    }
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
