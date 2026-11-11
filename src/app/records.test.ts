import { expect, test } from 'vitest';
import { replay, validateReplay, type SimInit } from '@sim';
import { mockArchive } from '@adapters/mock/records';
import { init, START } from '../../tests/acceptance/init';
import { CALL_FFE, DESC_UNKNOWN, EOM, LOC_CLEAR, POS_SKIP } from '../../tests/acceptance/mission';
import { MISSION, NO_ENEMY, oneMission, play } from '../../tests/acceptance/session';
import { memoryStorage } from '../../tests/acceptance/storage';
import { replayOf, submissionOf } from './records';

test('F-31: 받아들인 입력만 기록된다', () => {
  const at = { ...init(20261106), scenario: NO_ENEMY };
  const g = play(at);
  // 작전 준비: 발사 before any mission, an unknown kind, then 작전 개시 twice.
  for (const input of [{ a: 'fire' }, { a: 'bogus', v: [1] }, START, START]) g.session.send(input);
  g.step();
  for (const input of [POS_SKIP, CALL_FFE, LOC_CLEAR, DESC_UNKNOWN]) g.take(input);
  g.take(EOM('ineffective')); // 효력사 lands first: until then 임무끝 is ignored
  for (let k = 0; k < 40; k++) g.step();
  expect(g.events.filter((e) => e.type === 'impact').length).toBe(18); // 포대 3발: six guns
  expect(g.sent.length).toBeGreaterThan(g.session.log.length + 50); // most presses were ignored
  // Only what the simulation took is written down, at the tick it took it.
  expect(g.session.log.map((i) => i.a)).toEqual(['start', 'pos_skip', 'call', 'loc', 'desc', 'eom']);
  expect(g.session.log[0]).toEqual({ t: 0, ...START });
  const data = replayOf(at, g.session.log, g.sim.state.tick);
  const again = replay(data, at.terrain, at.scenario);
  expect(again.ignored).toBe(0);
  expect(again.record).toEqual(g.sim.record());
  expect(again.record.missions).toBe(1);
});

test('F-30: 랭킹 자격 — 시뮬레이션에서 온 기록', async () => {
  const archive = mockArchive(memoryStorage(), (x) => validateReplay(x).ok);
  const daily = oneMission();
  const practiceInit: SimInit = { ...init(42), seedKind: 'practice', scenario: NO_ENEMY };
  const practice = play(practiceInit);
  practice.take(START);
  for (let k = 0; k < 10; k++) practice.step();
  const sub = submissionOf('참새12', daily.sim, { ...init(20261106), scenario: NO_ENEMY }, daily.session.log);
  expect(sub.record).toEqual(daily.sim.record());
  expect(sub.record.mode).toBe('standard');
  expect(sub.replay.inputs).toEqual(daily.session.log);
  // 임무 요약: the one mission, its 18 rounds as the events showed them.
  expect(sub.missions).toEqual([
    expect.objectContaining({ rounds: daily.events.filter((e) => e.type === 'impact').length, corrections: 0, report: 'ineffective' }),
  ]);
  expect((await archive.submit(sub)).ranked).toBe(true);
  expect((await archive.submit(submissionOf('참새34', practice.sim, practiceInit, practice.session.log))).ranked).toBe(false);
  const total = await archive.board('total');
  expect(total.find((r) => r.callsign === '참새12')?.record.score).toBe(daily.sim.record().score);
  expect(total.map((r) => r.callsign)).not.toContain('참새34');
  expect((await archive.mine()).map((r) => [r.callsign, r.record.seedKind])).toEqual([
    ['참새34', 'practice'],
    ['참새12', 'daily'],
  ]);
});

test('F-30: 랭킹 자격 — 작전 개시 뒤 훈련으로 바꾼 판은 저장만 된다', async () => {
  const archive = mockArchive(memoryStorage(), (x) => validateReplay(x).ok);
  const at = { ...init(20261106), scenario: NO_ENEMY };
  const TRAINING = { a: 'mode', v: ['training'] };
  const STANDARD = { a: 'mode', v: ['standard'] };
  // Standard daily, switched to training after 작전 개시 and back: stored, not ranked.
  const switched = play(at);
  switched.take(START);
  switched.take(TRAINING);
  switched.take(STANDARD);
  for (const input of MISSION) switched.take(input);
  // Switched in 작전 준비 only, and back before 작전 개시: still a standard game.
  const free = play(at);
  free.take(TRAINING);
  free.take(STANDARD);
  free.take(START);
  for (const input of MISSION) free.take(input);

  const a = await archive.submit(submissionOf('참새12', switched.sim, at, switched.session.log));
  const b = await archive.submit(submissionOf('참새34', free.sim, at, free.session.log));
  expect([a.record.mode, a.ranked]).toEqual(['training', false]);
  expect([b.record.mode, b.ranked]).toEqual(['standard', true]);
  expect((await archive.board('total')).map((r) => r.callsign)).toContain('참새34');
  expect((await archive.board('total')).map((r) => r.callsign)).not.toContain('참새12');
  expect((await archive.mine()).map((r) => r.callsign)).toEqual(['참새34', '참새12']);
});

test('F-30: 랭킹 자격 — 한 틱 안에 훈련으로 바꿨다 돌아온 판도 저장만 된다', async () => {
  const archive = mockArchive(memoryStorage(), (x) => validateReplay(x).ok);
  const at = { ...init(20261106), scenario: NO_ENEMY };
  const g = play(at);
  g.take(START);
  g.session.send({ a: 'mode', v: ['training'] });
  g.session.send({ a: 'mode', v: ['standard'] });
  g.step();
  expect(g.session.log.slice(-2).map((i) => [i.t, i.v![0]])).toEqual([
    [1, 'training'],
    [1, 'standard'],
  ]);
  for (const input of MISSION) g.take(input);
  const sub = submissionOf('참새56', g.sim, at, g.session.log);
  expect(replay(sub.replay, at.terrain, at.scenario).record.mode).toBe('training');
  const stored = await archive.submit(sub);
  expect([stored.record.mode, stored.ranked]).toEqual(['training', false]);
  expect((await archive.board('total')).map((r) => r.callsign)).not.toContain('참새56');
});

test('F-31: 재생 자료 — mock 판에는 terrain이 없다', () => {
  const at = { ...init(20261106), scenario: NO_ENEMY };
  const g = play(at);
  g.take(START);
  for (let k = 0; k < 10; k++) g.step();
  const data = replayOf(at, g.session.log, g.sim.state.tick);
  // M1's keys, in M1's order
  expect(Object.keys(data)).toEqual(['format', 'simVersion', 'seed', 'seedKind', 'scenario', 'guns', 'weather', 'mode', 'stepMs', 'inputs', 'totalTicks']);
  expect(validateReplay(data).ok).toBe(true);
  const other = replayOf({ ...at, terrain: { ...at.terrain, id: 'x', version: 2 } }, g.session.log, g.sim.state.tick);
  expect(other.terrain).toEqual({ id: 'x', version: 2 });
  expect(validateReplay(other).ok).toBe(true);
});
