import { expect, test } from 'vitest';
import { frameSteps } from './loop';

const run = (frames: number[]) => {
  const acc = { ms: 0 };
  return frames.map((dt) => frameSteps(acc, dt));
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('프레임 루프: 0.1초 자르기', () => {
  // A long frame counts as 0.1 s; the rest of the real time is dropped, not owed.
  expect(run([500, 50])).toEqual([2, 1]);
  expect(run(Array(10).fill(100))).toEqual(Array(10).fill(2));
  // Frames up to 0.1 s lose no tick: 1000 frames of 16 ms are 16 s, 320 ticks.
  expect(sum(run(Array(1000).fill(16)))).toBe(320);
  expect(run([25, 25, 25, 25])).toEqual([0, 1, 0, 1]);
  // Between, the remainder carries over: 70 + 30 = 100 ms is 2 ticks.
  expect(run([70, 30])).toEqual([1, 1]);
});
