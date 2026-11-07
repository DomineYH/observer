/*
 * 결정적 수학: the simulation's transcendental functions, ported from fdlibm 5.3 to TypeScript (ADR 0005).
 * The port follows V8's copy (src/base/ieee754.cc, 13.6), which carries FreeBSD msun's errata fixes, so it
 * matches the Node and Chromium built-ins exactly where V8 uses fdlibm; the deviations from netlib are marked.
 * Only + - * /, IEEE word access and integer bit operations, so every engine gives the same bits.
 * Any change to an output changes every game result: bump SIM_VERSION and regenerate the goldens.
 *
 * ====================================================
 * Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.
 *
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 */

import { remPio2 } from './remPio2';
import { hi, lo, withHi, withLo } from './words';

const one = 1.0;
const huge = 1.0e300;
const twom1000 = 9.33263618503218878990e-302; // 2**-1000
const o_threshold = 7.09782712893383973096e2;
const u_threshold = -7.45133219101941108420e2;
const ln2HI = [6.93147180369123816490e-1, -6.93147180369123816490e-1] as const;
const ln2LO = [1.90821492927058770002e-10, -1.90821492927058770002e-10] as const;
const halF = [0.5, -0.5] as const;
const E = 2.718281828459045; // M_E
const invln2 = 1.44269504088896338700e0;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;

/** e_exp.c */
export function exp(x: number): number {
  let hi_ = 0;
  let lo_ = 0;
  let k = 0;
  let hx = hi(x) >>> 0;
  const xsb = hx >>> 31;
  hx &= 0x7fffffff;

  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | lo(x)) !== 0) return x + x; // NaN
      return xsb === 0 ? x : 0.0; // exp(+-inf) = {inf, 0}
    }
    if (x > o_threshold) return huge * huge;
    if (x < u_threshold) return twom1000 * twom1000;
  }

  if (hx > 0x3fd62e42) {
    // |x| > 0.5 ln2
    if (hx < 0x3ff0a2b2) {
      // and |x| < 1.5 ln2
      if (x === 1.0) return E; // V8: exp(1) is E exactly (netlib gives 1 ULP above)
      hi_ = x - ln2HI[xsb]!;
      lo_ = ln2LO[xsb]!;
      k = 1 - xsb - xsb;
    } else {
      k = (invln2 * x + halF[xsb]!) | 0;
      const t = k;
      hi_ = x - t * ln2HI[0];
      lo_ = t * ln2LO[0];
    }
    x = hi_ - lo_;
  } else if (hx < 0x3e300000) {
    // |x| < 2**-28
    if (huge + x > one) return one + x;
  } else k = 0;

  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return one - ((x * c) / (c - 2.0) - x);
  const y = one - (lo_ - (x * c) / (2.0 - c) - hi_);
  if (k >= -1021) return withHi(y, hi(y) + (k << 20));
  return withHi(y, hi(y) + ((k + 1000) << 20)) * twom1000;
}

const ln2_hi = 6.93147180369123816490e-1;
const ln2_lo = 1.90821492927058770002e-10;
const two54 = 1.80143985094819840000e16;
const Lg1 = 6.666666666666735130e-1;
const Lg2 = 3.999999999940941908e-1;
const Lg3 = 2.857142874366239149e-1;
const Lg4 = 2.222219843214978396e-1;
const Lg5 = 1.818357216161805012e-1;
const Lg6 = 1.531383769920937332e-1;
const Lg7 = 1.479819860511658591e-1;
const zero = 0.0;

/** e_log.c */
export function log(x: number): number {
  let hx = hi(x);
  const lx = lo(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2**-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -two54 / zero; // log(+-0) = -inf
    if (hx < 0) return (x - x) / zero; // log(-#) = NaN
    k -= 54;
    x *= two54; // subnormal number, scale up x
    hx = hi(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  x = withHi(x, hx | (i ^ 0x3ff00000)); // normalize x or x/2
  k += i >> 20;
  const f = x - 1.0;
  if ((0x000fffff & (2 + hx)) < 3) {
    // |f| < 2**-20
    if (f === zero) {
      if (k === 0) return zero;
      const dk = k;
      return dk * ln2_hi + dk * ln2_lo;
    }
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    if (k === 0) return f - R;
    const dk = k;
    return dk * ln2_hi - (R - dk * ln2_lo - f);
  }
  const s = f / (2.0 + f);
  const dk = k;
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * ln2_hi - (hfsq - (s * (hfsq + R) + dk * ln2_lo) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * ln2_hi - (s * (f - R) - dk * ln2_lo - f);
}

const atanhi = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800e0] as const;
const atanlo = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17] as const;
const aT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
] as const;

/** s_atan.c (used by atan2 only) */
function atan(x: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| >= 2^66
    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lo(x) !== 0)) return x + x; // NaN
    return hx > 0 ? atanhi[3] + atanlo[3] : -atanhi[3] - atanlo[3];
  }
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e400000) {
      // |x| < 2^-27 (V8; netlib 2^-29, same results)
      if (huge + x > one) return x;
    }
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      // |x| < 1.1875
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2.0 * x - one) / (2.0 + x);
      } else {
        id = 1;
        x = (x - one) / (x + one);
      }
    } else if (ix < 0x40038000) {
      // |x| < 2.4375
      id = 2;
      x = (x - 1.5) / (one + 1.5 * x);
    } else {
      id = 3;
      x = -1.0 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))));
  const s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = atanhi[id]! - (x * (s1 + s2) - atanlo[id]! - x);
  return hx < 0 ? -r : r;
}

const tiny = 1.0e-300;
const pi_o_4 = 7.8539816339744827900e-1;
const pi_o_2 = 1.5707963267948965580e0;
const pi = 3.1415926535897931160e0;
const pi_lo = 1.2246467991473532e-16;

/** e_atan2.c */
export function atan2(y: number, x: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  const lx = lo(x);
  const hy = hi(y);
  const iy = hy & 0x7fffffff;
  const ly = lo(y);
  if ((ix | ((lx | -lx) >>> 31)) > 0x7ff00000 || (iy | ((ly | -ly) >>> 31)) > 0x7ff00000) return x + y; // NaN
  if (((hx - 0x3ff00000) | lx) === 0) return atan(y); // x = 1.0
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2); // 2*sign(x)+sign(y)

  if ((iy | ly) === 0) {
    // y = 0
    if (m < 2) return y;
    return m === 2 ? pi + tiny : -pi - tiny;
  }
  if ((ix | lx) === 0) return hy < 0 ? -pi_o_2 - tiny : pi_o_2 + tiny; // x = 0
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return [pi_o_4 + tiny, -pi_o_4 - tiny, 3.0 * pi_o_4 + tiny, -3.0 * pi_o_4 - tiny][m]!;
    return [zero, -zero, pi + tiny, -pi - tiny][m]!;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -pi_o_2 - tiny : pi_o_2 + tiny;

  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) {
    // |y/x| > 2**60. V8/FreeBSD fix: the result is +-pi/2 for either sign of x (netlib loses 1 ULP for x < 0)
    z = pi_o_2 + 0.5 * pi_lo;
    m &= 1;
  } else if (hx < 0 && k < -60) z = 0.0; // |y|/x < -2**60
  else z = atan(Math.abs(y / x));
  if (m === 0) return z;
  if (m === 1) return -z;
  if (m === 2) return pi - (z - pi_lo);
  return z - pi_lo - pi;
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

/** k_cos.c: cos(x + y) on [-pi/4, pi/4], y the tail of x. */
function kernelCos(x: number, y: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    // |x| < 2**-27
    if ((x | 0) === 0) return one;
  }
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return one - (0.5 * z - (z * r - x * y)); // |x| < 0.3
  const qx = ix > 0x3fe90000 ? 0.28125 : fromHi(ix - 0x00200000); // x/4 (x > 0.78125: 0.28125)
  const iz = 0.5 * z - qx;
  const a = one - qx;
  return a - (iz - (z * r - x * y));
}
const fromHi = (h: number) => withLo(withHi(0, h), 0);

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

/** k_sin.c: sin(x + y) on [-pi/4, pi/4]; iy = 0 means y is 0. */
function kernelSin(x: number, y: number, iy: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    // |x| < 2**-27
    if ((x | 0) === 0) return x;
  }
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const T = [
  3.33333333333334091986e-1, 1.33333333333201242699e-1, 5.39682539762260521377e-2, 2.18694882948595424599e-2,
  8.86323982359930005737e-3, 3.59207910759131235356e-3, 1.45620945432529025516e-3, 5.88041240820264096874e-4,
  2.46463134818469906812e-4, 7.81794442939557092300e-5, 7.14072491382608190305e-5, -1.85586374855275456654e-5,
  2.59073051863633712884e-5,
] as const;
const pio4 = 7.85398163397448278999e-1;
const pio4lo = 3.06161699786838301793e-17;

/** k_tan.c (1.5, 04/04/22): tan(x + y) if iy = 1, -1/tan(x + y) if iy = -1, on [-pi/4, pi/4]. */
function kernelTan(x: number, y: number, iy: number): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  let z: number;
  let w: number;
  let v: number;
  let s: number;
  if (ix < 0x3e300000) {
    // |x| < 2**-28
    if ((x | 0) === 0) {
      if ((ix | lo(x) | (iy + 1)) === 0) return one / Math.abs(x);
      if (iy === 1) return x;
      // compute -1 / (x+y) carefully
      w = x + y;
      z = withLo(w, 0);
      v = y - (z - x);
      const a = -one / w;
      const t = withLo(a, 0);
      s = one + t * z;
      return t + a * (s + t * v);
    }
  }
  if (ix >= 0x3fe59428) {
    // |x| >= 0.6744
    if (hx < 0) {
      x = -x;
      y = -y;
    }
    z = pio4 - x;
    w = pio4lo - y;
    x = z + w;
    y = 0.0;
  }
  z = x * x;
  w = z * z;
  // Break x^5*(T[1]+x^2*T[2]+...) into x^5(T[1]+x^4*T[3]+...+x^20*T[11]) + x^5(x^2*(T[2]+x^4*T[4]+...+x^22*[T12]))
  let r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (ix >= 0x3fe59428) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2.0 * (x - ((w * w) / (w + v) - r)));
  }
  if (iy === 1) return w;
  // compute -1.0 / (x+r) accurately
  z = withLo(w, 0);
  v = r - (z - x); // z+v = r+x
  const a = -1.0 / w;
  const t = withLo(a, 0);
  s = 1.0 + t * z;
  return t + a * (s + t * v);
}

const ry = [0, 0];

/** s_sin.c */
export function sin(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0.0, 0); // |x| ~< pi/4
  if (ix >= 0x7ff00000) return x - x; // sin(Inf or NaN) is NaN
  const n = remPio2(x, ry);
  const y0 = ry[0]!;
  const y1 = ry[1]!;
  switch (n & 3) {
    case 0:
      return kernelSin(y0, y1, 1);
    case 1:
      return kernelCos(y0, y1);
    case 2:
      return -kernelSin(y0, y1, 1);
    default:
      return -kernelCos(y0, y1);
  }
}

/** s_cos.c */
export function cos(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0.0);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x, ry);
  const y0 = ry[0]!;
  const y1 = ry[1]!;
  switch (n & 3) {
    case 0:
      return kernelCos(y0, y1);
    case 1:
      return -kernelSin(y0, y1, 1);
    case 2:
      return -kernelCos(y0, y1);
    default:
      return kernelSin(y0, y1, 1);
  }
}

/** s_tan.c */
export function tan(x: number): number {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelTan(x, 0.0, 1);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x, ry);
  return kernelTan(ry[0]!, ry[1]!, 1 - ((n & 1) << 1)); // 1: n even, -1: n odd
}
