// 보셀 지형 (ADR 0007, demo lines 319–395): each screen column is swept front to back through the surface heights,
// then ridge lines and the ordered-dither posterize give the dot look. Plain typed arrays, so it also runs in Node.
import { COVER, type TerrainData, type Weather } from '@sim';
import { focalOf, MIL, type Eye, type ViewGeometry } from './projection';
import { atmosphere, hash, type TerrainColours } from './shade';

export interface ViewBuffers {
  w: number;
  h: number;
  pix: Uint8ClampedArray; // RGBA
  pix32: Uint32Array; // the same pixels, one word each
  ybuf: Int32Array; // per column: the highest row drawn so far
  dbuf: Float32Array; // per pixel: the distance drawn there
  vbuf: Float32Array; // per pixel: how much the 안개 띠 covers it, 0–1
}

export function createViewBuffers(w: number): ViewBuffers {
  const h = Math.round((w * 9) / 16);
  const pix = new Uint8ClampedArray(w * h * 4);
  return { w, h, pix, pix32: new Uint32Array(pix.buffer), ybuf: new Int32Array(w), dbuf: new Float32Array(w * h), vbuf: new Float32Array(w * h) };
}

const pack = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const Z_MAX = 11500;
const FOREST = COVER.indexOf('forest');
// 안개 띠 (#59 decision 7): with `edge: 'veil'` the ground fades to the fog colour over this many meters outside the
// square. Display only: no version moves when it changes.
const VEIL_M = 600;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Draws one frame of the observation view into `buf`; `aim` is in mils. Returns what `project` needs.
 * `under` paints into the buffer after the ridge lines and before the dot look, as the demo draws dust and smoke. */
export function renderView(
  buf: ViewBuffers,
  t: TerrainData,
  col: TerrainColours,
  eye: Eye,
  aim: { h: number; p: number },
  bino: boolean,
  weather: Weather,
  under?: (buf: ViewBuffers, v: ViewGeometry) => void,
): ViewGeometry {
  const { w: VW, h: VH, pix32, ybuf, dbuf, vbuf } = buf;
  const veil = t.edge === 'veil';
  const { n: N, cell: CELL, surface: SURF, ground: GROUND, buildings: BLD } = t;
  const { r: CR, g: CG, b: CB, light } = col;
  const atm = atmosphere(weather);
  const FOG = atm.fog;
  const [s0, s1] = atm.sky;
  const h = aim.h / MIL;
  const focal = focalOf(VW, bino);
  const tanH = VW / 2 / focal;
  const hor = VH / 2 + Math.tan(aim.p / MIL) * focal;
  for (let y = 0; y < VH; y++) {
    const k = clamp((hor - y) / (VH * 0.9), 0, 1);
    pix32.fill(pack((s1[0] + (s0[0] - s1[0]) * k) | 0, (s1[1] + (s0[1] - s1[1]) * k) | 0, (s1[2] + (s0[2] - s1[2]) * k) | 0), y * VW, (y + 1) * VW);
  }
  dbuf.fill(Infinity);
  vbuf.fill(0);
  ybuf.fill(VH);
  const dx = Math.sin(h), dy = Math.cos(h), rx = Math.cos(h), ry = -Math.sin(h);
  const SM = (N - 1) * CELL - 1e-3;
  const refl = (v: number) => {
    // Same mirror rule as the simulation's height query.
    if (v < 0) v = -v;
    if (v > SM) v = Math.max(0, 2 * SM - v);
    return v;
  };
  // Column i, rows y0..y1-1: this colour at this distance, under this much 안개 띠.
  const put = (i: number, y0: number, y1: number, colour: number, dist: number, v: number) => {
    for (let y = y0; y < y1; y++) {
      pix32[y * VW + i] = colour;
      dbuf[y * VW + i] = dist;
      vbuf[y * VW + i] = v;
    }
  };
  let z = bino ? 40 : 4;
  while (z < Z_MAX) {
    const half = z * tanH;
    let px = eye.x + dx * z - rx * half;
    let py = eye.y + dy * z - ry * half;
    const sx = (rx * 2 * half) / VW, sy = (ry * 2 * half) / VW;
    const f = Math.min(0.97, 1 - Math.exp(-atm.sigma * z));
    const near = z < 450;
    const f1 = 1 - f, fr = FOG[0] * f, fg = FOG[1] * f, fb = FOG[2] * f, inv = focal / z;
    for (let i = 0; i < VW; i++, px += sx, py += sy) {
      if (ybuf[i] === 0) continue;
      let qx = px, qy = py;
      let v = 0;
      let g1 = f1, gr = fr, gg = fg, gb = fb;
      if (qx < 0 || qx > SM || qy < 0 || qy > SM) {
        if (veil) {
          // Distance outside the square, blended on top of the haze: fog colour from VEIL_M out.
          v = Math.min(1, Math.hypot(qx < 0 ? -qx : qx > SM ? qx - SM : 0, qy < 0 ? -qy : qy > SM ? qy - SM : 0) / VEIL_M);
          const ff = f + (1 - f) * v;
          g1 = 1 - ff;
          gr = FOG[0] * ff;
          gg = FOG[1] * ff;
          gb = FOG[2] * ff;
        }
        qx = refl(qx);
        qy = refl(qy);
      }
      const gx = qx / CELL, gy = qy / CELL;
      let ix = gx | 0, iy = gy | 0;
      if (ix > N - 2) ix = N - 2;
      if (iy > N - 2) iy = N - 2;
      const fx = gx - ix, fy = gy - iy, k0 = iy * N + ix;
      const a = SURF[k0]!, b1 = SURF[k0 + 1]!, c1 = SURF[k0 + N]!, d1 = SURF[k0 + N + 1]!;
      const hh = a + (b1 - a) * fx + (c1 - a) * fy + (a - b1 - c1 + d1) * fx * fy;
      let yy = Math.floor((eye.z - hh) * inv + hor);
      const e = ybuf[i]!;
      if (yy >= e) continue;
      if (yy < 0) yy = 0;
      const k = k0 + (fy >= 0.5 ? N : 0) + (fx >= 0.5 ? 1 : 0);
      const tx = near ? 1 + (hash((px * 0.6) | 0, (py * 0.6) | 0, 3) - 0.5) * 0.22 * (1 - z / 450) : 1;
      const bld = BLD[k]!;
      let cr: number, cg: number, cb: number;
      if (bld > 0) {
        cr = CR[k]!;
        cg = CG[k]!;
        cb = CB[k]!;
      } else {
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        cr = CR[k0]! * w00 + CR[k0 + 1]! * w10 + CR[k0 + N]! * w01 + CR[k0 + N + 1]! * w11;
        cg = CG[k0]! * w00 + CG[k0 + 1]! * w10 + CG[k0 + N]! * w01 + CG[k0 + N + 1]! * w11;
        cb = CB[k0]! * w00 + CB[k0 + 1]! * w10 + CB[k0 + N]! * w01 + CB[k0 + N + 1]! * w11;
      }
      const c = pack((cr * tx * g1 + gr) | 0, (cg * tx * g1 + gg) | 0, (cb * tx * g1 + gb) | 0);
      if ((bld > 0 || t.cover[k] === FOREST) && e - yy > 1) {
        // Roof or crown on top, wall or trunks only as tall as the object, ground colour below.
        const objPx = (SURF[k]! - GROUND[k]!) * inv;
        const top = yy + Math.max(1, Math.min(e - yy, (objPx * (bld > 0 ? 0.35 : 0.5)) | 0));
        const side = Math.min(e, yy + Math.max(1, objPx | 0));
        let c2: number;
        if (bld > 0) {
          const wv = (1 - 0.15 * hash(k, 1, 31)) * light[k]! * g1;
          c2 = pack((206 * wv + gr) | 0, (200 * wv + gg) | 0, (188 * wv + gb) | 0);
        } else c2 = pack((cr * 0.72 * tx * g1 + gr) | 0, (cg * 0.72 * tx * g1 + gg) | 0, (cb * 0.72 * tx * g1 + gb) | 0);
        put(i, yy, top, c, z, v);
        put(i, top, side, c2, z, v);
        put(i, side, e, c, z, v);
      } else put(i, yy, e, c, z, v);
      ybuf[i] = yy;
    }
    z += bino ? (z < 9000 ? Math.max(3, Math.min(10, z * 0.0028)) : z * 0.004) : Math.max(1.2, z * 0.0072);
  }
  ridgeLines(buf, atm.sigma);
  const geom = { eye, h: aim.h, focal, cx: VW / 2, hor };
  under?.(buf, geom);
  posterize(buf);
  return geom;
}

/** A dark line where the distance jumps (ridge outlines); the 안개 띠 fades it, so mirrored ridges stay hidden. */
function ridgeLines({ w, h, pix, dbuf, vbuf }: ViewBuffers, sigma: number): void {
  for (let y = 1; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = dbuf[i]!;
      if (d === Infinity) continue;
      if (dbuf[i - w]! > d * 1.25 + 50) {
        const k = 1 - 0.5 * Math.exp(-sigma * d) * (1 - vbuf[i]!);
        const o = i * 4;
        pix[o] = pix[o]! * k;
        pix[o + 1] = pix[o + 1]! * k;
        pix[o + 2] = pix[o + 2]! * k;
      }
    }
}

/** 16 levels per channel with a 4×4 Bayer dither: the dot look. */
function posterize({ w, h, pix }: ViewBuffers): void {
  const S = 16;
  for (let y = 0; y < h; y++) {
    const by = (y & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = (BAYER[by + (x & 3)]! / 16 - 0.5) * S;
      pix[i] = Math.round((pix[i]! + t) / S) * S;
      pix[i + 1] = Math.round((pix[i + 1]! + t) / S) * S;
      pix[i + 2] = Math.round((pix[i + 2]! + t) / S) * S;
    }
  }
}
