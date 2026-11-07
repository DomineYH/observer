import { expect, test } from 'vitest';
import type { Input } from '@sim';
import { fovOf } from '@render/projection';
import { createAimControl } from './aim';

// A stand-in for the simulation's live state; tests move its tick and bino as a step would.
const control = (az = 10000, el = 0, bino = false) => {
  const sent: Input[] = [];
  const state = { aim: { az, el }, tick: 0, bino };
  return { sent, state, c: createAimControl(state, (i) => sent.push(i)) };
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
    const { c } = control(10000, 0, bino);
    expect(c.key(key, shift)).toBe(true);
    expect(c.aim()).toEqual({ h: 1000 + dh, p: dp });
  }
  // Other keys are not aiming keys.
  expect(control().c.key('a', false)).toBe(false);
  // Elevation stops at ±200 mils, azimuth wraps through north.
  const { c } = control(63900, 1990);
  c.key('ArrowUp', false);
  c.key('ArrowRight', false);
  expect(c.aim()).toEqual({ h: 10, p: 200 });
});

test('F-03: 조준 입력 양자화', () => {
  const W = fovOf(true) * 10; // at this width one dragged pixel is 0.1 mil through binoculars
  const drag = (c: ReturnType<typeof createAimControl>, tenths: number) => c.drag(-tenths, 0, W); // dragging left turns right
  const valid = (sent: Input[]) =>
    sent.every((i) => {
      const v = i.v as number[];
      return i.a === 'cam' && v.every(Number.isInteger) && v[0]! >= 0 && v[0]! <= 63999 && Math.abs(v[1]!) <= 2000;
    });

  // Nothing is sent until the aim is 1 mil away from the last value sent (not from the last value seen).
  const a = control(10000, 0, true);
  drag(a.c, 5);
  expect(a.sent).toEqual([]);
  drag(a.c, 5);
  expect(a.sent).toEqual([{ a: 'cam', v: [10010, 0] }]);
  drag(a.c, 4);
  drag(a.c, 6);
  expect(a.sent).toEqual([{ a: 'cam', v: [10010, 0] }, { a: 'cam', v: [10020, 0] }]);

  // Small steps add up: 0.04 mil a move, 4 mils in all → exactly four inputs.
  const b = control(10000, 0, true);
  for (let i = 0; i < 100; i++) b.c.drag(-0.4, 0, W);
  expect(b.sent.map((i) => i.v)).toEqual([[10010, 0], [10020, 0], [10030, 0], [10040, 0]]);

  // Across north the change is the short way round.
  const c = control(63995, 0, true);
  drag(c.c, 6); // 6399.5 → 0.1 mil: 0.6 mil moved
  expect(c.sent).toEqual([]);
  drag(c.c, 5); // → 0.6 mil
  expect(c.sent).toEqual([{ a: 'cam', v: [6, 0] }]);
  const d = control(63990, 0, true);
  d.c.drag(-9.7, 0, W); // 6399.97 mil rounds to 0, never 64000
  expect(d.sent).toEqual([{ a: 'cam', v: [0, 0] }]);

  // Elevation in 0.1 mils, clamped at ±200 mils.
  const e = control(10000, 1980);
  e.c.key('ArrowUp', true);
  e.state.bino = true;
  e.c.key('ArrowDown', false);
  expect(e.sent).toEqual([{ a: 'cam', v: [10000, 2000] }, { a: 'cam', v: [10000, 1990] }]);
  for (const s of [a, b, c, d, e]) expect(valid(s.sent)).toBe(true);

});

test('F-03: 쌍안경은 아직 적용되지 않은 입력을 따른다', () => {
  // Inputs apply on the next tick. Two presses within one tick end with binoculars off.
  const a = control();
  a.c.toggleBino();
  expect(a.c.bino()).toBe(true);
  a.c.toggleBino();
  expect(a.sent).toEqual([{ a: 'bino', v: [1] }, { a: 'bino', v: [0] }]);
  expect(a.c.bino()).toBe(false);

  // B then an arrow within one tick moves by the binocular step.
  const b = control();
  b.c.toggleBino();
  b.c.key('ArrowRight', false);
  expect(b.c.aim().h).toBe(1002);
  b.c.drag(-fovOf(true) / 10, 0, fovOf(true)); // a tenth of the width is a tenth of the binocular field
  expect(b.c.aim().h).toBeCloseTo(1002 + fovOf(true) / 10, 9);

  // Once the tick has run, the simulation's state rules, including a refusal.
  b.state.tick = 1;
  b.state.bino = true;
  expect(b.c.bino()).toBe(true);
  const refused = control();
  refused.c.toggleBino();
  refused.state.tick = 1; // the step ran but kept binoculars off
  expect(refused.c.bino()).toBe(false);
  refused.c.toggleBino();
  expect(refused.sent).toEqual([{ a: 'bino', v: [1] }, { a: 'bino', v: [1] }]);
});

test('F-05: 레이저 측정 — 입력기', () => {
  // The lase goes out on the live aim, in 0.1 mils, even before the aim has been sent as 조준 (under 1 mil moved).
  const { sent, c } = control(63990, -220);
  c.key('ArrowRight', false); // 6399 + 20 mils, through north: 19 mils
  c.lase();
  expect(sent.at(-1)).toEqual({ a: 'lase', v: [190, -220] });
  c.drag(0.02, 0, 960); // a hair: no 조준 sent, the lase still follows it
  const n = sent.length;
  c.lase();
  expect(sent).toHaveLength(n + 1);
  const [az, el] = sent.at(-1)!.v as number[];
  expect(az).toBe(Math.round(c.aim().h * 10) % 64000);
  expect(el).toBe(-220);
});
