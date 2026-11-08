import { expect, test } from 'vitest';
import { EYE_HEIGHT, heightAt, lineOfSight } from '@sim';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { viewshed } from './viewshed';

test('F-24: 가시권 — 시뮬레이션의 가시선 그대로, 관측소 북쪽 150 m 이남 제외', () => {
  // 640 m of flat ground with a 30 m wall across it at 390–410 m north; the post stands at (320, 100).
  const t = flatTerrain();
  for (let row = 39; row <= 41; row++) for (let i = 0; i < t.n; i++) t.surface[row * t.n + i] = 130;
  const g = 32; // 20 m cells
  const px = viewshed(t, { x: 320, y: 100 }, g);
  expect(px).toHaveLength(g * g * 4);
  // Image row 0 is the north edge; a cell's centre is 20·(j + .5) m north.
  const alpha = (northM: number) => {
    const row = g - 1 - Math.floor(northM / 20);
    return [...Array(g).keys()].map((i) => px[(row * g + i) * 4 + 3]);
  };
  const all = (a: number) => Array(g).fill(a);
  for (const y of [10, 90, 170, 230]) expect(alpha(y)).toEqual(all(0)); // south of 100 + 150 m: never marked
  for (const y of [270, 330]) expect(alpha(y)).toEqual(all(0)); // in sight: left clear
  for (const y of [450, 530, 630]) expect(alpha(y)).toEqual(all(120)); // behind the wall: darkened
});

test('F-24: 가시권 — 모든 칸이 시뮬레이션의 가시선과 같다', () => {
  // Rolling ground with a forest belt: hills 0–40 m and trees 15 m tall on one band of rows.
  const t = flatTerrain();
  for (let j = 0; j < t.n; j++)
    for (let i = 0; i < t.n; i++) {
      const g = 100 + 20 * Math.sin(i / 5) * Math.cos(j / 7) + 20 * Math.sin(j / 9);
      t.ground[j * t.n + i] = g;
      t.surface[j * t.n + i] = g + (j >= 30 && j <= 33 ? 15 : 0);
    }
  const op = { x: 300, y: 120 };
  const g = 64; // one cell per terrain cell
  const px = viewshed(t, op, g);
  const eye = { ...op, z: heightAt(t, op.x, op.y) + EYE_HEIGHT };
  let dark = 0;
  let clear = 0;
  let skipped = 0;
  for (let j = 0; j < g; j++)
    for (let i = 0; i < g; i++) {
      const x = (i + 0.5) * 10;
      const y = (j + 0.5) * 10;
      const a = px[((g - 1 - j) * g + i) * 4 + 3];
      // Spec: never marked within 150 m north of the post or south of it; elsewhere dark exactly where the sim's 가시선
      // to a man standing there (1.7 m) is blocked.
      const expected = y < op.y + 150 ? 0 : lineOfSight(t, eye, { x, y, z: heightAt(t, x, y) + 1.7 }) ? 0 : 120;
      expect(a, `cell ${i},${j}`).toBe(expected);
      if (y < op.y + 150) skipped++;
      else if (expected) dark++;
      else clear++;
    }
  // The terrain gives all three kinds, so the comparison means something.
  expect(Math.min(dark, clear, skipped)).toBeGreaterThan(100);
});
