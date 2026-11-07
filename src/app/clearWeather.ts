import type { Weather } from '@sim';

// 맑음, from the demo's WX_PRESETS.clear in spec units. Passed until the weather slice brings the weather source.
export const CLEAR_WEATHER: Weather = {
  visibilityM: 24000,
  cloudPct: 15,
  windFromDeg: 285,
  windSpeedTenthMs: 26,
  tempTenthC: 94,
  precipTenthMmH: 0,
  pressureHpa: 1023,
  humidityPct: 48,
};
