import { describe, expect, test } from 'vitest';
import * as det from '@sim/math';
import { createStreams, next, type Stream } from '@sim/rng';
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
});
