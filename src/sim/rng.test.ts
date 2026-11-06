import { describe, expect, test } from 'vitest';
import { createStreams, next, STREAMS } from './rng';

// Reference: the demo's generator (OBSERVER_demo_v0.2.html line 182), copied verbatim.
function demoMulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('난수 스트림', () => {
  test('six streams in fixed order, salted from the seed like the demo plus a laser stream', () => {
    expect(STREAMS).toEqual(['scn', 'bal', 'fdc', 'exp', 'ai', 'las']);
    const seed = 20261106;
    const rng = createStreams(seed);
    const salts = { scn: 0, bal: 0x5bd1e995, fdc: 0x1b873593, exp: 0x68e31da4, ai: 0x3c6ef372, las: 0x2545f491 };
    for (const name of STREAMS) {
      const ref = demoMulberry32(seed ^ salts[name]);
      const ours = [next(rng[name]), next(rng[name]), next(rng[name])];
      expect(ours).toEqual([ref(), ref(), ref()]);
      expect(rng[name].count).toBe(3);
    }
  });

  test('drawing from one stream does not move another', () => {
    const rng = createStreams(1);
    next(rng.bal);
    expect(rng.scn.count).toBe(0);
    expect(next(rng.scn)).toBe(demoMulberry32(1)());
  });
});
