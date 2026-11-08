import { expect, test } from 'vitest';
import { presetWeather } from '@adapters/mock/weather';
import { friendLabels, rainStreaks } from './overlay';
import { flatTerrain } from '../../tests/acceptance/terrain';

test('F-17: 빗줄기', () => {
  // 90 streaks per mm/h (demo 1191): 비 (2.4 mm/h) draws 216, dry weather none.
  const rain = presetWeather('rain');
  expect(rainStreaks(rain, 0, 800, 450, 1, 3.5)).toHaveLength(216);
  expect(rainStreaks(presetWeather('clear'), 0, 800, 450, 1, 3.5)).toEqual([]);
  // Each falls 16 px and leans with the crosswind: wind from the west seen looking north blows right, looking south left.
  const west = { ...rain, windFromDeg: 270, windSpeedTenthMs: 50 };
  const lean = (h: number) => rainStreaks(west, h, 800, 450, 1, 3.5).map(([x0, y0, x1, y1]) => [x1 - x0, y1 - y0]);
  for (const d of lean(0)) expect(d).toEqual([expect.closeTo(11, 9), 16]);
  for (const d of lean(3200)) expect(d).toEqual([expect.closeTo(-11, 9), 16]);
  // Inside the view.
  for (const [x, y] of rainStreaks(west, 0, 800, 450, 1, 3.5)) expect(x >= 0 && x < 800 && y >= 0 && y < 450).toBe(true);
});

test('F-14: 훈련 아군 표시', () => {
  // Looking north from (320, 100) on flat ground 100 m high, a 640-pixel view: a position ahead is labelled with its
  // number 12 m above the ground, one behind or off the side of the view is not.
  const geom = { eye: { x: 320, y: 100, z: 103.5 }, h: 0, focal: 400, cx: 320, hor: 180 };
  const labels = friendLabels([{ x: 320, y: 50 }, { x: 320, y: 500 }, { x: 2000, y: 200 }], geom, flatTerrain());
  expect(labels).toEqual([{ n: 2, sx: 320, sy: 180 + ((103.5 - 112) / 400) * 400 }]);
});
