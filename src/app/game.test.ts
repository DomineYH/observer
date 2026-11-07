import { expect, test } from 'vitest';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { mockWeather } from '@adapters/mock/weather';
import type { SimInit } from '@sim';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { newGame } from './game';

const practice = async (preset: 'clear' | 'fog'): Promise<SimInit> => ({
  seed: 1234,
  seedKind: 'practice',
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: await mockWeather.load(1234, 'practice', preset),
  mode: 'standard',
  terrain: flatTerrain(),
});

test('F-30: 기상 변경은 판을 새로 만든다', async () => {
  const a = newGame(await practice('clear'));
  a.session.send({ a: 'pick', v: [300, 340] });
  a.session.step();
  expect(a.sim.state.picked).toBe(true);
  const aLog = [...a.session.log];

  // A new simulation and a new 입력 기록, under the new weather, with the chosen 관측소 후보 put in again.
  const fog = await practice('fog');
  const b = newGame(fog, a);
  expect(b.sim).not.toBe(a.sim);
  expect(b.init.weather).toEqual(fog.weather);
  expect(b.session.log).toEqual([]);
  expect(b.sim.state.picked).toBe(false);
  b.session.step();
  expect(b.sim.state.tick).toBe(0);
  expect(b.sim.state.phase).toBe('prep');
  expect(b.sim.state.picked).toBe(true);
  expect(b.sim.state.op).toEqual({ x: 300, y: 340 });
  expect(b.session.log).toEqual([{ t: 0, a: 'pick', v: [300, 340] }]);
  expect(a.session.log).toEqual(aLog); // the old game's record is left as it was

  // A pick sent and not yet stepped is the one carried over; nothing else queued is.
  b.session.send({ a: 'pick', v: [310, 350] });
  b.session.send({ a: 'bino', v: [1] });
  const c = newGame(await practice('clear'), b);
  c.session.step();
  expect(c.sim.state.op).toEqual({ x: 310, y: 350 });
  expect(c.session.log).toEqual([{ t: 0, a: 'pick', v: [310, 350] }]);

  // Without a 후보 nothing is put in.
  const d = newGame(await practice('fog'), newGame(await practice('clear')));
  d.session.step();
  expect(d.session.log).toEqual([]);
  expect(d.sim.state.picked).toBe(false);
});
