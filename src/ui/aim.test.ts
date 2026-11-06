import { expect, test } from 'vitest';
import type { Input } from '@sim';
import { fovOf } from '@render/projection';
import { createAimControl } from './aim';

const control = (az = 10000, el = 0) => {
  const sent: Input[] = [];
  return { sent, c: createAimControl({ az, el }, (i) => sent.push(i)) };
};

test('F-03: 방향키 조준', () => {
  // [key, shift, bino] → mils moved in azimuth (h) or elevation (p)
  const cases: [string, boolean, boolean, number, number][] = [
    ['ArrowRight', false, false, 20, 0],
    ['ArrowRight', true, false, 200, 0],
    ['ArrowLeft', false, false, -20, 0],
    ['ArrowLeft', true, true, -20, 0],
    ['ArrowRight', false, true, 2, 0],
    ['ArrowRight', true, true, 20, 0],
    ['ArrowUp', false, false, 0, 5],
    ['ArrowUp', true, false, 0, 25],
    ['ArrowDown', false, false, 0, -5],
    ['ArrowUp', false, true, 0, 1],
    ['ArrowUp', true, true, 0, 5],
    ['ArrowDown', true, true, 0, -5],
  ];
  for (const [key, shift, bino, dh, dp] of cases) {
    const { c } = control();
    expect(c.key(key, shift, bino)).toBe(true);
    expect(c.aim()).toEqual({ h: 1000 + dh, p: dp });
  }
  // Other keys are not aiming keys.
  expect(control().c.key('a', false, false)).toBe(false);
  // Elevation stops at ±200 mils, azimuth wraps through north.
  const { c } = control(63900, 1990);
  c.key('ArrowUp', false, false);
  c.key('ArrowRight', false, false);
  expect(c.aim()).toEqual({ h: 10, p: 200 });
});

test('F-03: 조준 입력 양자화', () => {
  const W = fovOf(true) * 10; // at this width one dragged pixel is 0.1 mil through binoculars
  const drag = (c: ReturnType<typeof createAimControl>, tenths: number) => c.drag(-tenths, 0, W, true); // dragging left turns right
  const valid = (sent: Input[]) =>
    sent.every((i) => i.a === 'cam' && i.v!.every(Number.isInteger) && i.v![0]! >= 0 && i.v![0]! <= 63999 && Math.abs(i.v![1]!) <= 2000);

  // Nothing is sent until the aim is 1 mil away from the last value sent (not from the last value seen).
  const a = control();
  drag(a.c, 5);
  expect(a.sent).toEqual([]);
  drag(a.c, 5);
  expect(a.sent).toEqual([{ a: 'cam', v: [10010, 0] }]);
  drag(a.c, 4);
  drag(a.c, 6);
  expect(a.sent).toEqual([{ a: 'cam', v: [10010, 0] }, { a: 'cam', v: [10020, 0] }]);

  // Small steps add up: 0.04 mil a move, 4 mils in all → exactly four inputs.
  const b = control();
  for (let i = 0; i < 100; i++) b.c.drag(-0.4, 0, W, true);
  expect(b.sent.map((i) => i.v)).toEqual([[10010, 0], [10020, 0], [10030, 0], [10040, 0]]);

  // Across north the change is the short way round.
  const c = control(63995);
  drag(c.c, 6); // 6399.5 → 0.1 mil: 0.6 mil moved
  expect(c.sent).toEqual([]);
  drag(c.c, 5); // → 0.6 mil
  expect(c.sent).toEqual([{ a: 'cam', v: [6, 0] }]);
  const d = control(63990);
  d.c.drag(-9.7, 0, W, true); // 6399.97 mil rounds to 0, never 64000
  expect(d.sent).toEqual([{ a: 'cam', v: [0, 0] }]);

  // Elevation in 0.1 mils, clamped at ±200 mils.
  const e = control(10000, 1980);
  e.c.key('ArrowUp', true, false);
  e.c.key('ArrowDown', false, true);
  expect(e.sent).toEqual([{ a: 'cam', v: [10000, 2000] }, { a: 'cam', v: [10000, 1990] }]);
  for (const s of [a, b, c, d, e]) expect(valid(s.sent)).toBe(true);

  // 쌍안경 toggles from the current state.
  const f = control();
  f.c.toggleBino(false);
  f.c.toggleBino(true);
  expect(f.sent).toEqual([{ a: 'bino', v: [1] }, { a: 'bino', v: [0] }]);
});
