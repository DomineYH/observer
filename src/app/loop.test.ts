import { expect, test } from 'vitest';
import { createSim, type Input } from '@sim';
import { init, START } from '../../tests/acceptance/init';
import { hiddenLines, SHOWN_MS } from '@ui/readback';
import { combatInit } from '../../tests/acceptance/init';
import { frameSteps, stretchOf, timescaleOf } from './loop';
import { prepLimit, PREP_LIMIT_MS } from './prepLimit';
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

test('시간 배율: 주소의 timescale은 1, 2, 4만', () => {
  expect(timescaleOf('')).toBe(1);
  expect(timescaleOf('?timescale=1')).toBe(1);
  expect(timescaleOf('?timescale=2')).toBe(2);
  expect(timescaleOf('?seed=1&timescale=4')).toBe(4);
  for (const v of ['8', '3', '0', '-4', '4x', '4.0', '%204', 'constructor', '']) expect(timescaleOf(`?timescale=${v}`)).toBe(1);
});

test('시간 배율: ×8의 네 배 — 프레임당 틱', () => {
  const at = (speed: number, frames: number[]) => {
    const acc = { ms: 0 };
    return sum(frames.map((dt) => frameSteps(acc, dt, speed)));
  };
  // 100 frames of 16 ms: ×8 gives 256 ticks, ×8 × 4 = 32 gives 1024 (10 or 11 a frame, under the 40 cap).
  expect(at(8, Array(100).fill(16))).toBe(256);
  expect(at(32, Array(100).fill(16))).toBe(1024);
  // One 0.1 s frame at 32 owes 64 ticks: 40 run, the rest is dropped.
  const acc = { ms: 0 };
  expect(frameSteps(acc, 100, 32)).toBe(40);
  expect(acc.ms).toBe(0);
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

test('timescale: 0.25·0.5·2·4만 받는다', () => {
  const practice = (v: string) => timescaleOf(`?seed=1&timescale=${v}`, true);
  expect(['0.25', '0.5', '2', '4'].map(practice)).toEqual([0.25, 0.5, 2, 4]);
  // Exact text only: another spelling of the same number, or another number, is 1.
  for (const v of ['.25', '0.250', '.5', '0.50', '1/4', '0.75', '0.125', '0', '1', '8', '2.0', '%200.5', '0.5x', '']) expect(practice(v), v).toBe(1);
});

test('timescale: 0.25에서 네 프레임에 한 틱', () => {
  const acc = { ms: 0 };
  const scale = timescaleOf('?seed=1&timescale=0.25', true);
  // 50 ms frames at ×1: a quarter of a tick each. At ×2 (the screen's 배속 is multiplied) every second frame steps.
  expect(Array.from({ length: 8 }, () => frameSteps(acc, 50, scale))).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
  expect(Array.from({ length: 4 }, () => frameSteps(acc, 50, 2 * scale))).toEqual([0, 1, 0, 1]);
  expect(sum(Array.from({ length: 1000 }, () => frameSteps(acc, 16, timescaleOf('?seed=1&timescale=0.5', true))))).toBe(160);
});

test('timescale: 일일 판에서는 느린 배속을 듣지 않는다', () => {
  for (const v of ['0.25', '0.5']) expect(timescaleOf(`?timescale=${v}`), v).toBe(1);
  // 2 and 4 are heard on any game, as before.
  expect([timescaleOf('?timescale=2'), timescaleOf('?timescale=4')]).toEqual([2, 4]);
});

test('timescale: 느린 배속은 준비 시간 제한과 가림 시간을 같은 비율로 늘리고 2·4는 그대로 둔다', () => {
  expect([0.25, 0.5, 1, 2, 4].map(stretchOf)).toEqual([4, 2, 1, 1, 1]);
  // 작전 준비 시간 제한: the clock is turned by hand; 실전 in 작전 준비.
  const prep = createSim(combatInit(7)).state;
  const leftAfter = (search: string, ms: number) => {
    let now = 0;
    const limit = prepLimit(() => now, () => stretchOf(timescaleOf(search, true)));
    limit.chose('combat');
    now = ms;
    return limit.left(prep);
  };
  expect(leftAfter('?seed=1&timescale=0.25', 0)).toBe(4 * PREP_LIMIT_MS);
  expect(leftAfter('?seed=1&timescale=0.25', 1_199_000)).toBe(1000);
  expect(leftAfter('?seed=1&timescale=0.25', 1_200_000)).toBe(0);
  expect(leftAfter('?seed=1&timescale=0.5', PREP_LIMIT_MS)).toBe(PREP_LIMIT_MS);
  for (const v of ['1', '2', '4']) expect(leftAfter(`?seed=1&timescale=${v}`, PREP_LIMIT_MS - 1000), v).toBe(1000);
  // 가림: a 교신 to read back that came in at 0 is covered 16 s later at 0.25, 4 s later otherwise.
  const line = { type: 'radio', tick: 0, at: 0, utterance: { speaker: 'fdc', kind: 'shot' } } as Parameters<typeof hiddenLines>[0][number];
  const covered = (search: string, now: number) => hiddenLines([line], now, SHOWN_MS * stretchOf(timescaleOf(search, true))).has(0);
  expect([covered('?seed=1&timescale=0.25', 15_999), covered('?seed=1&timescale=0.25', 16_000)]).toEqual([false, true]);
  expect([covered('?seed=1&timescale=0.5', 7999), covered('?seed=1&timescale=0.5', 8000)]).toEqual([false, true]);
  for (const v of ['2', '4']) expect([covered(`?seed=1&timescale=${v}`, 3999), covered(`?seed=1&timescale=${v}`, 4000)], v).toEqual([false, true]);
});
