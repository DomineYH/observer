import { expect, test } from 'vitest';
import { reticle, tapeTicks } from './overlay';
import { focalOf, MIL, milToPx, project, pxToMil, QUALITIES } from './projection';

const VIEWS = Object.values(QUALITIES).flatMap((w) => [false, true].map((bino) => ({ w, bino })));

test('F-02: 픽셀과 각도 왕복', () => {
  for (const { w, bino } of VIEWS) {
    const focal = focalOf(w, bino);
    for (let px = -w / 2; px <= w / 2; px += 0.25) {
      const back = milToPx(pxToMil(px, focal), focal);
      expect(Math.abs(back - px)).toBeLessThan(0.5);
      expect(Math.abs(back - px)).toBeLessThan(1e-6); // a wrong formula would still fit 0.5 px near the centre
    }
  }
});

test('F-02: 밀 눈금은 투영과 같다', () => {
  const eye = { x: 5000, y: 2000, z: 300 };
  const at = (h: number, m: number, e = 0) => ({
    x: eye.x + Math.sin((h + m) / MIL) * 1000,
    y: eye.y + Math.cos((h + m) / MIL) * 1000,
    z: eye.z + Math.tan(e / MIL) * 1000 * Math.cos(m / MIL),
  });
  for (const { w, bino } of VIEWS) {
    const focal = focalOf(w, bino);
    const cx = w / 2;
    const cy = (w * 9) / 32;
    const view = { eye, h: 1234, focal, cx, hor: cy }; // level line of sight: the horizon is the centre row
    const r = reticle(focal, cx, cy);
    expect(r.h.map((t) => t.mil)).toEqual([-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    for (const t of r.h) expect(t.x).toBeCloseTo(project(view, at(view.h, t.mil))!.sx, 9);
    expect(r.v.map((t) => t.mil)).toEqual([-20, -15, -10, -5, 5, 10, 15, 20]);
    for (const t of r.v) expect(t.y).toBeCloseTo(project(view, at(view.h, 0, t.mil))!.sy, 9);
    expect(r.labels.map((l) => l.text)).toEqual(['40', '30', '20', '10', '10', '20', '30', '40']);

    // The tape (naked eye only) across north: 6380 mils looks at 6300 (63), 0 (00) and 100 (01).
    if (bino) continue;
    const tapeView = { ...view, h: 6380 };
    const tape = tapeTicks(6380, focal, cx, w);
    expect(tape.filter((t) => t.label).map((t) => t.label)).toContain('63');
    expect(tape.find((t) => t.label === '00')!.x).toBeCloseTo(project(tapeView, at(6380, 20))!.sx, 9);
    expect(tape.find((t) => t.label === '01')!.x).toBeCloseTo(project(tapeView, at(6380, 120))!.sx, 9);
    for (const t of tape) {
      expect(t.x).toBeCloseTo(project(tapeView, at(6380, t.mil - 6380))!.sx, 9);
      expect(t.mil % 50).toBe(0);
      expect(t.big).toBe(t.mil % 100 === 0);
      expect(Boolean(t.label)).toBe(t.big);
    }
  }
});
