import type { SimInit } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@app/clearWeather';

export const init = (seed: number): SimInit => ({
  seed,
  seedKind: 'daily',
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: CLEAR_WEATHER,
  mode: 'standard',
});
