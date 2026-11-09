import { expect, test } from 'vitest';
import { dailySeed } from '@app/seed';
import { WEATHER_PRESETS } from '../index';
import { mockWeather } from './weather';

// The demo's five presets (demo lines 332–336) in spec units: m, %, deg from, 0.1 m/s, 0.1 °C, 0.1 mm/h, hPa, %.
const w = (...v: number[]) => {
  const [visibilityM, cloudPct, windFromDeg, windSpeedTenthMs, tempTenthC, precipTenthMmH, pressureHpa, humidityPct] = v as [number, number, number, number, number, number, number, number];
  return { visibilityM, cloudPct, windFromDeg, windSpeedTenthMs, tempTenthC, precipTenthMmH, pressureHpa, humidityPct };
};
const DEMO = {
  clear: w(24000, 15, 285, 26, 94, 0, 1023, 48),
  haze: w(6500, 70, 220, 14, 61, 0, 1017, 88),
  rain: w(8000, 100, 200, 52, 112, 24, 1009, 94),
  wind: w(20000, 40, 315, 108, 23, 0, 1028, 35),
  fog: w(2500, 100, 180, 7, 40, 0, 1020, 99),
};

const days2027 = () => {
  const out: number[] = [];
  for (let t = Date.UTC(2027, 0, 1); t < Date.UTC(2028, 0, 1); t += 86400e3) {
    const d = new Date(t);
    out.push(dailySeed(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }
  return out;
};

test('F-26: 일일 시드의 기상', async () => {
  const seen = new Set<string>();
  for (const seed of days2027()) {
    const a = await mockWeather.load(seed, 'daily');
    // The same day gives the same weather, and a daily seed ignores any preset asked for.
    expect(await mockWeather.load(seed, 'daily')).toEqual(a);
    expect(await mockWeather.load(seed, 'daily', 'fog')).toEqual(a);
    const key = Object.entries(DEMO).find(([, v]) => JSON.stringify(v) === JSON.stringify(a))?.[0];
    expect(key).toBeDefined(); // always one of the five presets
    seen.add(key!);
  }
  expect([...seen].sort()).toEqual(['clear', 'fog', 'haze', 'rain', 'wind']);
});

test('F-30: 연습 시드의 기상 선택 — 기상 원천', async () => {
  expect([...WEATHER_PRESETS]).toEqual(['clear', 'haze', 'rain', 'wind', 'fog']);
  for (const p of WEATHER_PRESETS) expect(await mockWeather.load(1234, 'practice', p)).toEqual(DEMO[p]);
});
