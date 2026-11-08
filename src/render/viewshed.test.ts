import { expect, test } from 'vitest';
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
