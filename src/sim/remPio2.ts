/*
 * Argument reduction for sin/cos/tan (결정적 수학): __ieee754_rem_pio2 and __kernel_rem_pio2 from fdlibm 5.3,
 * ported from V8's copy (src/base/ieee754.cc, 13.6) like math.ts.
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 */
import { fromWords, hi, lo, withHi, withLo } from './words';

// 2/pi in 24-bit chunks.
const two_over_pi = [
  0xa2f983, 0x6e4e44, 0x1529fc, 0x2757d1, 0xf534dd, 0xc0db62, 0x95993c, 0x439041, 0xfe5163, 0xabdebb, 0xc561b7,
  0x246e3a, 0x424dd2, 0xe00649, 0x2eea09, 0xd1921c, 0xfe1deb, 0x1cb129, 0xa73ee8, 0x8235f5, 0x2ebb44, 0x84e99c,
  0x7026b4, 0x5f7e41, 0x3991d6, 0x398353, 0x39f49c, 0x845f8b, 0xbdf928, 0x3b1ff8, 0x97ffde, 0x05980f, 0xef2f11,
  0x8b5a0a, 0x6d1f6d, 0x367ecf, 0x27cb09, 0xb74f46, 0x3f669e, 0x5fea2d, 0x7527ba, 0xc7ebe5, 0xf17b3d, 0x0739f7,
  0x8a5292, 0xea6bfb, 0x5fb11f, 0x8d5d08, 0x560330, 0x46fc7b, 0x6babf0, 0xcfbc20, 0x9af436, 0x1da9e3, 0x91615e,
  0xe61b08, 0x659985, 0x5f14a0, 0x68408d, 0xffd880, 0x4d7327, 0x310606, 0x1556ca, 0x73a8c9, 0x60e27b, 0xc08c6b,
] as const;

// High words of n*pi/2, n = 1..32.
const npio2_hw = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a,
  0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a,
  0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac,
  0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb,
] as const;

const zero = 0.0;
const half = 0.5;
const one = 1.0;
const two24 = 1.67772160000000000000e7;
const twon24 = 5.96046447753906250000e-8;
const invpio2 = 6.36619772367581382433e-1;
const pio2_1 = 1.57079632673412561417e0;
const pio2_1t = 6.07710050650619224932e-11;
const pio2_2 = 6.07710050630396597660e-11;
const pio2_2t = 2.02226624879595063154e-21;
const pio2_3 = 2.02226624871116645580e-21;
const pio2_3t = 8.47842766036889956997e-32;

/**
 * Writes x - n*pi/2 as y[0] + y[1] (|y| <= pi/4) and returns n (C's __ieee754_rem_pio2).
 * Callers have already handled |x| <= pi/4 and non-finite x except where noted.
 */
export function remPio2(x: number, y: number[]): number {
  const hx = hi(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    // |x| ~<= pi/4, no need for reduction
    y[0] = x;
    y[1] = 0;
    return 0;
  }
  if (ix < 0x4002d97c) {
    // |x| < 3pi/4, special case with n = +-1
    if (hx > 0) {
      let z = x - pio2_1;
      if (ix !== 0x3ff921fb) {
        // 33+53 bit pi is good enough
        y[0] = z - pio2_1t;
        y[1] = z - y[0] - pio2_1t;
      } else {
        // near pi/2, use 33+33+53 bit pi
        z -= pio2_2;
        y[0] = z - pio2_2t;
        y[1] = z - y[0] - pio2_2t;
      }
      return 1;
    }
    let z = x + pio2_1;
    if (ix !== 0x3ff921fb) {
      y[0] = z + pio2_1t;
      y[1] = z - y[0] + pio2_1t;
    } else {
      z += pio2_2;
      y[0] = z + pio2_2t;
      y[1] = z - y[0] + pio2_2t;
    }
    return -1;
  }
  if (ix <= 0x413921fb) {
    // |x| ~<= 2^19*(pi/2), medium size
    let t = Math.abs(x);
    const n = (t * invpio2 + half) | 0;
    const fn = n;
    let r = t - fn * pio2_1;
    let w = fn * pio2_1t; // 1st round good to 85 bit
    if (n < 32 && ix !== npio2_hw[n - 1]) {
      y[0] = r - w; // quick check no cancellation
    } else {
      const j = ix >> 20;
      y[0] = r - w;
      let i = j - ((hi(y[0]) >> 20) & 0x7ff);
      if (i > 16) {
        // 2nd iteration needed, good to 118
        t = r;
        w = fn * pio2_2;
        r = t - w;
        w = fn * pio2_2t - (t - r - w);
        y[0] = r - w;
        i = j - ((hi(y[0]) >> 20) & 0x7ff);
        if (i > 49) {
          // 3rd iteration needed, 151 bits acc
          t = r;
          w = fn * pio2_3;
          r = t - w;
          w = fn * pio2_3t - (t - r - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = r - y[0]! - w;
    if (hx < 0) {
      y[0] = -y[0]!;
      y[1] = -y[1];
      return -n;
    }
    return n;
  }
  if (ix >= 0x7ff00000) {
    // x is inf or NaN
    y[0] = y[1] = x - x;
    return 0;
  }
  // set z = scalbn(|x|, ilogb(x)-23)
  let z = withLo(0, lo(x));
  const e0 = (ix >> 20) - 1046; // e0 = ilogb(z)-23
  z = withHi(z, ix - (e0 << 20));
  const tx = [0, 0, 0];
  for (let i = 0; i < 2; i++) {
    tx[i] = z | 0;
    z = (z - tx[i]!) * two24;
  }
  tx[2] = z;
  let nx = 3;
  while (tx[nx - 1] === zero) nx--; // skip zero term
  const n = kernelRemPio2(tx, y, e0, nx);
  if (hx < 0) {
    y[0] = -y[0]!;
    y[1] = -y[1]!;
    return -n;
  }
  return n;
}

const PIo2 = [
  1.57079625129699707031e0, 7.54978941586159635335e-8, 5.39030252995776476554e-15, 3.28200341580791294123e-22,
  1.27065575308067607349e-29, 1.22933308981111328932e-36, 2.73370053816464559624e-44, 2.16741683877804819444e-51,
] as const;

/** x * 2**n, exact while the result stays normal (always so here: |n| is a few hundred at most). */
const scalbn = (x: number, n: number) => x * fromWords((n + 1023) << 20, 0);

/**
 * C's __kernel_rem_pio2 with prec = 2 (53-bit result as y[0] + y[1]), the only precision rem_pio2 uses.
 * x: the input split into nx 24-bit chunks; e0: exponent of x[0] (-24 * index).
 */
function kernelRemPio2(x: number[], y: number[], e0: number, nx: number): number {
  const jk = 4; // init_jk[prec = 2]
  const jp = jk;
  const iq: number[] = [];
  const f: number[] = [];
  const fq: number[] = [];
  const q: number[] = [];

  // determine jx, jv, q0, note that 3 > q0
  const jx = nx - 1;
  let jv = ((e0 - 3) / 24) | 0;
  if (jv < 0) jv = 0;
  let q0 = e0 - 24 * (jv + 1);

  // set up f[0] to f[jx+jk] where f[jx+jk] = ipio2[jv+jk]
  let j = jv - jx;
  const m = jx + jk;
  for (let i = 0; i <= m; i++, j++) f[i] = j < 0 ? zero : two_over_pi[j]!;

  // compute q[0], q[1], ... q[jk]
  for (let i = 0; i <= jk; i++) {
    let fw = 0.0;
    for (j = 0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
    q[i] = fw;
  }

  let jz = jk;
  let z: number;
  let n: number;
  let ih: number;
  for (;;) {
    // recompute: distill q[] into iq[] reversingly
    let i = 0;
    z = q[jz]!;
    for (j = jz; j > 0; i++, j--) {
      const fw = (twon24 * z) | 0;
      iq[i] = (z - two24 * fw) | 0;
      z = q[j - 1]! + fw;
    }

    // compute n
    z = scalbn(z, q0); // actual value of z
    z -= 8.0 * Math.floor(z * 0.125); // trim off integer >= 8
    n = z | 0;
    z -= n;
    ih = 0;
    if (q0 > 0) {
      // need iq[jz-1] to determine n
      i = iq[jz - 1]! >> (24 - q0);
      n += i;
      iq[jz - 1] = iq[jz - 1]! - (i << (24 - q0));
      ih = iq[jz - 1]! >> (23 - q0);
    } else if (q0 === 0) ih = iq[jz - 1]! >> 23;
    else if (z >= 0.5) ih = 2;

    if (ih > 0) {
      // q > 0.5
      n += 1;
      let carry = 0;
      for (i = 0; i < jz; i++) {
        // compute 1-q
        j = iq[i]!;
        if (carry === 0) {
          if (j !== 0) {
            carry = 1;
            iq[i] = 0x1000000 - j;
          }
        } else iq[i] = 0xffffff - j;
      }
      if (q0 === 1) iq[jz - 1] = iq[jz - 1]! & 0x7fffff;
      else if (q0 === 2) iq[jz - 1] = iq[jz - 1]! & 0x3fffff;
      if (ih === 2) {
        z = one - z;
        if (carry !== 0) z -= scalbn(one, q0);
      }
    }

    // check if recomputation is needed
    if (z !== zero) break;
    j = 0;
    for (i = jz - 1; i >= jk; i--) j |= iq[i]!;
    if (j !== 0) break;
    let k = 1;
    while (jk >= k && iq[jk - k] === 0) k++; // k = no. of terms needed
    for (i = jz + 1; i <= jz + k; i++) {
      // add q[jz+1] to q[jz+k]
      f[jx + i] = two_over_pi[jv + i]!;
      let fw = 0.0;
      for (j = 0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
      q[i] = fw;
    }
    jz += k;
  }

  // chop off zero terms
  if (z === 0.0) {
    jz -= 1;
    q0 -= 24;
    while (iq[jz] === 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    // break z into 24-bit if necessary
    z = scalbn(z, -q0);
    if (z >= two24) {
      const fw = (twon24 * z) | 0;
      iq[jz] = (z - two24 * fw) | 0;
      jz += 1;
      q0 += 24;
      iq[jz] = fw;
    } else iq[jz] = z | 0;
  }

  // convert integer "bit" chunk to floating-point value
  let fw = scalbn(one, q0);
  for (let i = jz; i >= 0; i--) {
    q[i] = fw * iq[i]!;
    fw *= twon24;
  }

  // compute PIo2[0, ..., jp] * q[jz, ..., 0]
  for (let i = jz; i >= 0; i--) {
    fw = 0.0;
    for (let k = 0; k <= jp && k <= jz - i; k++) fw += PIo2[k]! * q[i + k]!;
    fq[jz - i] = fw;
  }

  // compress fq[] into y[]
  fw = 0.0;
  for (let i = jz; i >= 0; i--) fw += fq[i]!;
  y[0] = ih === 0 ? fw : -fw;
  fw = fq[0]! - fw;
  for (let i = 1; i <= jz; i++) fw += fq[i]!;
  y[1] = ih === 0 ? fw : -fw;
  return n & 7;
}
