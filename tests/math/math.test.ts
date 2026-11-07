import { describe, expect, test } from 'vitest';
import * as det from '@sim/math';
import { createStreams, gauss, next, type Stream } from '@sim/rng';
import { BITS, evaluate, FNS, fromHex, toHex, type Fn } from './bits';

const BUILTIN: Record<Fn, (...a: number[]) => number> = {
  exp: Math.exp, log: Math.log, sin: Math.sin, cos: Math.cos, tan: Math.tan, atan2: Math.atan2,
};

// Signed distance in units in the last place; zeros, infinities and NaN must match exactly.
function ulps(a: number, b: number): number {
  if (a !== a || b !== b) return a !== a && b !== b ? 0 : Infinity;
  if (a === 0 || b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return Object.is(a, b) ? 0 : Infinity;
  const ord = (x: number) => {
    const bits = BigInt('0x' + toHex(x));
    return bits >> 63n ? -(bits & 0x7fffffffffffffffn) : bits;
  };
  const d = ord(a) - ord(b);
  return Number(d < 0n ? -d : d);
}

const uniform = (s: Stream, lo: number, hi: number) => lo + (hi - lo) * next(s);
// A random positive finite double: random exponent and mantissa bits.
const anyPositive = (s: Stream) =>
  fromHex(((next(s) * 0x7fe + 1) | 0).toString(16).padStart(3, '0') + Math.floor(next(s) * 0x10000000000000).toString(16).padStart(13, '0'));
const signed = (s: Stream, x: number) => (next(s) < 0.5 ? -x : x);

const N = 10000;
function samples(fn: Fn): number[][] {
  const s = createStreams(20261106).scn;
  const out: number[][] = [];
  for (let i = 0; i < N; i++) {
    if (fn === 'exp') out.push([uniform(s, -745.2, 709.8)]);
    else if (fn === 'log') out.push([i % 2 ? anyPositive(s) : uniform(s, 0.5, 2)]);
    else if (fn === 'atan2') out.push(i % 2 ? [signed(s, anyPositive(s)), signed(s, anyPositive(s))] : [uniform(s, -10, 10), uniform(s, -10, 10)]);
    else out.push([i < 200 ? signed(s, anyPositive(s)) : uniform(s, -1e3, 1e3)]);
  }
  return out;
}

describe('결정적 수학', () => {
  test('결정적 수학: 내장 함수와 1 ULP 이내', () => {
    for (const fn of FNS) {
      const ours = det[fn] as (...a: number[]) => number;
      let exact = 0;
      const table = BITS[fn].map(([inputs]) => inputs.map(fromHex));
      for (const args of [...table, ...samples(fn)]) {
        const d = ulps(ours(...args), BUILTIN[fn](...args));
        if (d > 1) expect.fail(`${fn}(${args.join(', ')}): ${ours(...args)} vs ${BUILTIN[fn](...args)} (${d} ULP)`);
        if (d === 0) exact++;
      }
      console.log(`${fn}: ${exact}/${table.length + N} equal to the built-in`);
    }
  });

  test('결정적 수학: 비트 출력 표', () => {
    for (const fn of FNS) expect(BITS[fn].length, fn).toBeGreaterThanOrEqual(15);
    const expected = Object.fromEntries(FNS.map((fn) => [fn, BITS[fn].map(([, out]) => out)]));
    expect(evaluate(det)).toEqual(expected);
  });

  test('결정적 수학: 가우시안 난수 값 열', () => {
    // The demo's sampler (OBSERVER_demo_v0.2.html lines 182, 192), copied verbatim; it uses the built-in Math.
    function demoMulberry32(a: number) {
      return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const TAU = Math.PI * 2;
    const gaussOf = (r: () => number) => {
      let u = 0;
      while (!u) u = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r());
    };

    const seed = 20261106;
    const stream = createStreams(seed).bal;
    const ours = Array.from({ length: 8 }, () => gauss(stream));
    // The demo's values on Node 24, frozen.
    expect(ours.map(toHex)).toEqual([
      '3fdba190d4c5a8b8', // 0.4317361905911059
      '3fc1ca28fa8c3906', // 0.13898193582321755
      'bfe6fd526c7dd762', // -0.718423091790765
      '3fe4b1c6d0bcabd4', // 0.6467012478727789
      'bfd3210f8c71badc', // -0.298892867233844
      'bfa9a8e2ebd818c6', // -0.05011662606197968
      'bfda950dc0351662', // -0.4153475167298436
      '3fe364eeb43f46c8', // 0.6060708542301763
    ]);
    expect(stream.count).toBe(16); // two draws per value, like the demo
    // Same rule as the demo in any runtime: equal up to the built-ins' rounding.
    const demo = demoMulberry32(seed ^ 0x5bd1e995);
    for (const g of ours) expect(Math.abs(g - gaussOf(demo))).toBeLessThanOrEqual(1e-14 * Math.abs(g));
  });
});
