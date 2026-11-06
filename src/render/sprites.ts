// 적 스프라이트 (demo lines 1103–1158): men, vehicles and tubes the simulation has decided are seen, drawn at display
// resolution over the voxel view. 지각 배율 (binoculars 2.2×, eye 1.4×) changes the drawing size only, never what is seen.
import { heightAt, type ReadonlySimState, type TerrainData, type Weather } from '@sim';
import { MIL, project, type ViewGeometry } from './projection';
import { atmosphere, type RGB } from './shade';

export interface Sprite {
  sx: number; // internal pixels
  sy: number;
  fwd: number; // m ahead of the eye
  k: number; // pixels per metre at that distance
  fz: number; // fog mix 0–0.9
  kind: 'man' | 'veh' | 'tube';
  prone: boolean;
  moving: boolean;
  rel: number; // heading relative to the line of sight, radians
  ph: number; // leg phase
}

const MARGIN = 6;
const PACE = { apc: 5, assault: 2.8, walk: 2 }; // leg-phase speeds

/** The sprites to draw, far first: alive and seen members of units that have set off. */
export function spritesOf(s: ReadonlySimState, v: ViewGeometry, t: TerrainData, w: Weather): Sprite[] {
  const { sigma } = atmosphere(w);
  const time = s.tick * 0.05;
  const out: Sprite[] = [];
  for (const p of s.platoons) {
    if (p.state === 'wait') continue;
    const speed = p.moving ? (p.type === 'apc' ? PACE.apc : p.state === 'assault' ? PACE.assault : PACE.walk) : 0;
    for (const q of p.members) {
      if (!q.vis) continue;
      const pr = project(v, { x: q.x, y: q.y, z: heightAt(t, q.x, q.y) });
      if (!pr || pr.sx < -MARGIN || pr.sx > v.cx * 2 + MARGIN) continue;
      out.push({
        sx: pr.sx,
        sy: pr.sy,
        fwd: pr.fwd,
        k: v.focal / pr.fwd,
        fz: Math.min(0.9, 1 - Math.exp(-sigma * pr.fwd)),
        kind: q.kind,
        prone: q.prone,
        moving: p.moving,
        rel: p.dir - v.h / MIL,
        ph: q.ph + time * speed * 3,
      });
    }
  }
  return out.sort((a, b) => b.fwd - a.fwd);
}

export type SpriteContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'fillRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'arc' | 'fill'
>;

const COLOUR = { man: [52, 54, 38], veh: [62, 64, 48], tube: [84, 84, 76] } as const;
const SKIN = [150, 118, 92];
const BOOT: RGB = [34, 32, 28];
const BLACK: RGB = [30, 30, 28];
const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Draws `list` with `scale` display pixels per internal pixel; every sprite is at least one device pixel. */
export function drawSprites(c: SpriteContext, list: readonly Sprite[], scale: number, bino: boolean, dpr: number, fog: RGB): void {
  const G = bino ? 2.2 : 1.4;
  const R = Math.round;
  const rect = (x0: number, y0: number, w: number, h: number, col: readonly number[]) => {
    c.fillStyle = rgb(col);
    c.fillRect(R(x0), R(y0), Math.max(1, R(w)), Math.max(1, R(h)));
  };
  for (const sp of list) {
    const mix = (v: number, i: number) => Math.round(v * (1 - sp.fz) + fog[i]! * sp.fz);
    const col = COLOUR[sp.kind].map(mix);
    const dark = col.map((v) => Math.round(v * 0.7));
    const kd = sp.k * scale * G;
    const x = sp.sx * scale;
    const y = sp.sy * scale;
    if (sp.kind === 'man') {
      const h = 1.75 * kd;
      if (sp.prone) {
        const w = Math.max(dpr, h * 0.9);
        const hh = Math.max(dpr, h * 0.2);
        rect(x - w / 2, y - hh, w, hh, col);
        continue;
      }
      if (h < 5 * dpr) {
        // A few pixels: a body and legs that scissor while walking.
        const w = Math.max(dpr, h * 0.3);
        const bob = sp.moving ? Math.abs(Math.sin(sp.ph)) * h * 0.08 : 0;
        rect(x - w / 2, y - h - bob, w, h * 0.7, col);
        const sw = sp.moving ? Math.sin(sp.ph) * w * 0.8 : 0;
        rect(x - w / 2 + sw, y - h * 0.32 - bob, w, h * 0.32, dark);
        if (sp.moving) rect(x - w / 2 - sw, y - h * 0.32 - bob, w, h * 0.32, dark);
        continue;
      }
      const u = h / 8;
      const bob = sp.moving ? Math.abs(Math.sin(sp.ph)) * u * 0.6 : 0;
      const top = y - h - bob;
      const sw = sp.moving ? Math.sin(sp.ph) * u * 1.3 : 0;
      if (h >= 16 * dpr) {
        // Close and large: helmet, face, webbing, pack, arms, rifle, legs and boots.
        const skin = SKIN.map(mix);
        const as = sp.moving ? Math.sin(sp.ph) * u * 0.9 : 0;
        rect(x - u * 0.55, top, u * 1.1, u * 0.35, dark);
        rect(x - u * 0.75, top + u * 0.3, u * 1.5, u * 0.55, dark);
        rect(x - u * 0.45, top + u * 0.85, u * 0.9, u * 0.6, skin);
        rect(x - u * 1.05, top + u * 1.45, u * 2.1, u * 2.9, col);
        rect(x - u * 1.05, top + u * 2.6, u * 2.1, u * 0.3, dark);
        rect(x - u * 1.45, top + u * 1.6, u * 0.5, u * 2.2, dark);
        rect(x - u * 1.35 - as * 0.3, top + u * 1.6, u * 0.45, u * 2.3, col);
        rect(x + u * 0.95 + as * 0.3, top + u * 1.6, u * 0.45, u * 2.1, col);
        c.strokeStyle = 'rgb(28,28,24)';
        c.lineWidth = Math.max(dpr, u * 0.28);
        c.beginPath();
        c.moveTo(R(x + u * 0.2), R(top + u * 3.4));
        c.lineTo(R(x + u * 1.9), R(top + u * 1.5));
        c.stroke();
        rect(x - u * 0.9 + sw, top + u * 4.35, u * 0.8, u * 3.1, dark);
        rect(x + u * 0.1 - sw, top + u * 4.35, u * 0.8, u * 3.1, dark);
        rect(x - u * 1.0 + sw, top + u * 7.4, u * 1.0, u * 0.6, BOOT);
        rect(x + u * 0.05 - sw, top + u * 7.4, u * 1.0, u * 0.6, BOOT);
        continue;
      }
      rect(x - u * 0.7, top, u * 1.4, u * 1.4, dark); // helmet
      rect(x - u, top + u * 1.4, u * 2, u * 3, col); // body
      rect(x + u, top + u * 1.8, u * 0.45, u * 2.6, dark); // rifle
      rect(x - u * 0.9 + sw, top + u * 4.4, u * 0.8, u * 3.6, dark); // legs
      rect(x + u * 0.1 - sw, top + u * 4.4, u * 0.8, u * 3.6, dark);
    } else if (sp.kind === 'veh') {
      // The hull's outline turns with its heading against the line of sight.
      const L = 6.7 * kd;
      const Wd = 3.2 * kd;
      const H = 2.2 * kd;
      const vw = Math.max(2 * dpr, L * Math.abs(Math.sin(sp.rel)) + Wd * Math.abs(Math.cos(sp.rel)));
      const side = Math.sin(sp.rel) >= 0 ? 1 : -1;
      rect(x - vw / 2, y - H * 0.8, vw, H * 0.55, col);
      rect(x - vw / 2, y - H * 0.28, vw, H * 0.28, dark);
      rect(x - vw * 0.18, y - H, vw * 0.32, H * 0.24, dark);
      if (H > 4 * dpr) rect(x + side * vw * 0.12, y - H * 0.92, side * vw * 0.4, Math.max(dpr, H * 0.06), dark); // gun
      if (H >= 12 * dpr && Math.abs(Math.sin(sp.rel)) > 0.5) {
        const n = 6;
        const r = H * 0.11;
        c.fillStyle = rgb(BLACK);
        for (let k = 0; k < n; k++) {
          c.beginPath();
          c.arc(R(x - vw / 2 + (vw * (k + 0.5)) / n), R(y - r * 1.1), Math.max(dpr, r), 0, Math.PI * 2);
          c.fill();
        }
        rect(x - vw / 2, y - H * 0.55, vw, Math.max(dpr, H * 0.05), BLACK);
      }
    } else {
      const L = 1.3 * kd;
      c.strokeStyle = rgb(dark);
      c.lineWidth = Math.max(dpr, 0.14 * kd);
      c.beginPath();
      c.moveTo(R(x), R(y));
      c.lineTo(R(x + L * 0.45), R(y - L * 0.9));
      c.stroke();
    }
  }
}
