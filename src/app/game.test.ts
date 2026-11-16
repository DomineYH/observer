import { expect, test } from 'vitest';
import { COMBAT } from '@content/combat';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { mockWeather } from '@adapters/mock/weather';
import { replay, validateReplay, type SimInit } from '@sim';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { newGame } from './game';
import { replayOf } from './records';

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

test('F-30: 기상 변경은 고른 모드를 남긴다', async () => {
  const training = { a: 'mode', v: ['training'] } as const;
  const standard = { a: 'mode', v: ['standard'] } as const;

  // Training applied: the new game goes back into it through its own 입력 기록.
  const applied = newGame(await practice('clear'));
  applied.session.send(training);
  applied.session.step();
  const b = newGame(await practice('fog'), applied);
  b.session.step();
  expect(b.sim.state.mode).toBe('training');
  expect(b.session.log).toEqual([{ t: 0, ...training }]);

  // Training sent and not yet stepped counts, also through a second change with no step between.
  const queued = newGame(await practice('clear'));
  queued.session.send(training);
  const c = newGame(await practice('fog'), queued);
  const twice = newGame(await practice('clear'), c);
  twice.session.step();
  expect(twice.sim.state.mode).toBe('training');
  expect(twice.session.log).toEqual([{ t: 0, ...training }]);

  // Standard queued over an applied training wins, and the new game starts in it: nothing to put in.
  const back = newGame(await practice('clear'));
  back.session.send(training);
  back.session.step();
  back.session.send(standard);
  const d = newGame(await practice('fog'), back);
  d.session.step();
  expect(d.sim.state.mode).toBe('standard');
  expect(d.session.log).toEqual([]);

  // With the 후보: the pick, then the mode.
  const both = newGame(await practice('clear'));
  both.session.send({ a: 'pick', v: [300, 340] });
  both.session.send(training);
  both.session.step();
  const init = await practice('fog');
  const e = newGame(init, both);
  e.session.send({ a: 'start', v: [300, 340] });
  for (let k = 0; k < 200; k++) e.session.step();
  expect(e.session.log.map((i) => i.a)).toEqual(['pick', 'mode', 'start']);

  // Its 입력 기록 replays to the same game: nothing ignored, the same 판 기록 in training, the same state hash.
  const again = replay(replayOf(init, e.session.log, e.sim.state.tick), init.terrain, BASE_SCENARIO, init.guns);
  expect(again.ignored).toBe(0);
  expect(again.record).toEqual(e.sim.record());
  expect(again.record.mode).toBe('training');
  expect(again.checkpoints.at(-1)).toEqual({ tick: 200, hash: e.sim.hash() });
});

test('실전: 판을 새로 만들 때 실전은 만드는 값으로 넘어가고 재생 자료 머리에 실전 자료 판이 실린다', async () => {
  const combat = async (preset: 'clear' | 'fog'): Promise<SimInit> => ({ ...(await practice(preset)), mode: 'combat', combat: COMBAT });
  // Into combat: the mode the old game was in is not put in again as an input.
  const training = newGame({ ...(await practice('clear')), mode: 'training' });
  training.session.send({ a: 'pick', v: [300, 340] });
  training.session.step();
  const a = newGame(await combat('clear'), training);
  a.session.step();
  expect(a.sim.state.mode).toBe('combat');
  expect(a.session.log).toEqual([{ t: 0, a: 'pick', v: [300, 340] }]); // the 관측소 후보 only
  // A weather change in combat: the new game is combat by its 생성 인자, with no mode input.
  const b = newGame({ ...a.init, weather: (await practice('fog')).weather }, a);
  b.session.send({ a: 'start', v: [300, 340] });
  b.session.step();
  b.session.step();
  expect(b.sim.state.mode).toBe('combat');
  expect(b.session.log.some((i) => i.a === 'mode')).toBe(false);
  // Its 재생 자료 carries the 실전 자료 판, passes the format check and replays with nothing ignored.
  const data = replayOf(b.init, b.session.log, b.sim.state.tick);
  expect(data.mode).toBe('combat');
  expect(data.combatDataVersion).toBe(COMBAT.version);
  expect(validateReplay(data).ok).toBe(true);
  const replayed = replay(data, b.init.terrain, BASE_SCENARIO, BASE_GUNS, COMBAT);
  expect([replayed.ignored, replayed.record]).toEqual([0, b.sim.record()]);
  // Out of combat: a combat game's mode is not put into the new game either.
  const c = newGame(await practice('clear'), b);
  c.session.step();
  expect(c.sim.state.mode).toBe('standard');
  expect(c.session.log.some((i) => i.a === 'mode')).toBe(false);
  // A training or standard game's 재생 자료 has no such key.
  expect(Object.hasOwn(replayOf(c.init, c.session.log, 0), 'combatDataVersion')).toBe(false);
});
