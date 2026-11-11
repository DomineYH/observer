// mock 기상 원천: the demo's five presets (demo lines 330–336) in spec units. A daily seed picks one with the demo's
// weights (demo line 1552); a practice seed takes the preset chosen. Gusts and the weather code are not in the value.
import type { Weather } from '@sim';
import type { WeatherPreset, WeatherSource } from '../index';
import { hash } from '../terrainFile/cellHash';

const PRESETS: Record<WeatherPreset, Weather> = {
  clear: { visibilityM: 24000, cloudPct: 15, windFromDeg: 285, windSpeedTenthMs: 26, tempTenthC: 94, precipTenthMmH: 0, pressureHpa: 1023, humidityPct: 48 },
  haze: { visibilityM: 6500, cloudPct: 70, windFromDeg: 220, windSpeedTenthMs: 14, tempTenthC: 61, precipTenthMmH: 0, pressureHpa: 1017, humidityPct: 88 },
  rain: { visibilityM: 8000, cloudPct: 100, windFromDeg: 200, windSpeedTenthMs: 52, tempTenthC: 112, precipTenthMmH: 24, pressureHpa: 1009, humidityPct: 94 },
  wind: { visibilityM: 20000, cloudPct: 40, windFromDeg: 315, windSpeedTenthMs: 108, tempTenthC: 23, precipTenthMmH: 0, pressureHpa: 1028, humidityPct: 35 },
  fog: { visibilityM: 2500, cloudPct: 100, windFromDeg: 180, windSpeedTenthMs: 7, tempTenthC: 40, precipTenthMmH: 0, pressureHpa: 1020, humidityPct: 99 },
};

/** 맑음: the weather tests and goldens are written for. */
export const CLEAR_WEATHER: Weather = PRESETS.clear;
export const presetWeather = (p: WeatherPreset): Weather => ({ ...PRESETS[p] });

/** The daily seed's preset: clear 30%, haze 25%, rain 15%, strong north-westerly 20%, fog 10%. */
function dailyPreset(seed: number): WeatherPreset {
  const u = hash(seed, 0, 0x77ea);
  return u < 0.3 ? 'clear' : u < 0.55 ? 'haze' : u < 0.7 ? 'rain' : u < 0.9 ? 'wind' : 'fog';
}

export const mockWeather: WeatherSource = {
  load: async (seed, seedKind, preset) => presetWeather(seedKind === 'practice' && preset ? preset : dailyPreset(seed)),
};
