import { expect, test } from 'vitest';
import { createSim, type Input } from '@sim';
import { init, START } from '../../tests/acceptance/init';
import { frameSteps } from './loop';
import { createSession } from './session';

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

test('F-14: 배속과 일시정지는 기록되지 않는다 — 프레임당 틱', () => {
  const at = (speed: number, frames: number[]) => {
    const acc = { ms: 0 };
    return frames.map((dt) => frameSteps(acc, dt, speed));
  };
  // ×8 runs eight times the ticks of ×1 over the same frames; a 0.1 s frame at ×8 is 16 ticks, under the 40 cap.
  expect(sum(at(8, Array(100).fill(16)))).toBe(8 * sum(at(1, Array(100).fill(16))));
  expect(at(8, [500])).toEqual([16]);
  expect(at(2, [25, 25])).toEqual([1, 1]);
  // Paused (pace 0): no tick, and the time already owed stays as it was.
  const acc = { ms: 0 };
  frameSteps(acc, 70, 1);
  expect([frameSteps(acc, 1000, 0), frameSteps(acc, 16, 0), acc.ms]).toEqual([0, 0, 20]);
});

test('수치표: 빠진 행 — 프레임당 최대 40스텝', () => {
  // ×8 never reaches the cap (a 0.1 s frame is 16 ticks): a 배속 of 40 does, 80 ticks owed. 40 run and the rest is
  // dropped, not owed to the next frame.
  const acc = { ms: 0 };
  expect(frameSteps(acc, 100, 40)).toBe(40);
  expect(acc.ms).toBe(0);
  expect(frameSteps(acc, 50, 1)).toBe(1);
});

test('F-14: 배속과 일시정지는 기록되지 않는다', () => {
  // The same inputs at the same ticks: one game stepped tick by tick, the other by frames whose pace keeps changing
  // (×1 ×2 ×4 ×8 and paused stretches). Pace is not an input: the state hash and the 입력 기록 come out the same.
  const plan = new Map<number, Input[]>([
    [0, [START]],
    [3, [{ a: 'bino', v: [1] }]],
    [40, [{ a: 'cam', v: [300, -100] }]],
    [41, [{ a: 'mode', v: ['training'] }]],
    [90, [{ a: 'bino', v: [0] }, { a: 'mode', v: ['standard'] }]],
  ]);
  const END = 200;
  const simA = createSim(init(20261106));
  const a = createSession(simA);
  const simB = createSim(init(20261106));
  const b = createSession(simB);
  for (let t = 0; t < END; t++) {
    for (const i of plan.get(t) ?? []) a.send(i);
    a.step();
  }
  const paces = [1, 2, 0, 4, 8, 0, 0, 1, 8];
  const acc = { ms: 0 };
  let paused = 0;
  for (let f = 0; simB.state.tick < END; f++) {
    const pace = paces[Math.floor(f / 7) % paces.length]!;
    const n = frameSteps(acc, 16, pace);
    if (pace === 0) paused += n;
    for (let k = 0; k < n && simB.state.tick < END; k++) {
      for (const i of plan.get(simB.state.tick) ?? []) b.send(i);
      b.step();
    }
  }
  expect(paused).toBe(0);
  expect(simB.state.tick).toBe(simA.state.tick);
  expect(simB.hash()).toBe(simA.hash());
  expect(b.log).toEqual(a.log);
  expect(b.log.map((i) => i.a)).toEqual(['start', 'bino', 'cam', 'mode', 'bino', 'mode']);
});
