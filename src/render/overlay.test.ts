import { expect, test } from 'vitest';
import { presetWeather } from '@adapters/mock/weather';
import { rainStreaks } from './overlay';

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
