// 실전의 바탕 (M3-5): the third mode is a 생성 인자. Through the simulation's public interface only.
import { expect, test } from 'vitest';
import { createSim, validateReplay, type Input } from '@sim';
import { COMBAT } from '@content/combat';
import { combatInit, init, replayData, START } from './init';

const mode = (m: string): Input => ({ a: 'mode', v: [m] });

test('실전: 모드 — 실전은 판을 만드는 값이고 mode 입력으로 드나들 수 없다', () => {
  // No way out: a combat game takes no mode input, in 작전 준비 or after 작전 개시.
  const sim = createSim(combatInit(20261106));
  expect(sim.state.mode).toBe('combat');
  expect(sim.step([mode('standard'), mode('training'), mode('combat')]).accepted).toEqual([false, false, false]);
  expect(sim.step([START]).accepted).toEqual([true]);
  expect(sim.step([mode('standard'), mode('training')]).accepted).toEqual([false, false]);
  expect(sim.state.mode).toBe('combat');
  expect(sim.state.trainingUsed).toBe(false);
  // No way in: the value is not one a mode input carries, so a standard game ignores it too.
  const standard = createSim(init(20261106));
  expect(standard.step([mode('combat')]).accepted).toEqual([false]);
  expect(standard.step([START, mode('combat')]).accepted).toEqual([true, false]);
  expect(standard.state.mode).toBe('standard');
  expect(standard.step([mode('training')]).accepted).toEqual([true]); // 훈련↔표준 as before
  // The format check: combat in a mode input is refused, combat in the header passes.
  const header = { ...replayData([{ t: 0, ...START }]), mode: 'combat', combatDataVersion: COMBAT.version };
  expect(validateReplay(header).ok).toBe(true);
  expect(validateReplay({ ...header, inputs: [{ t: 0, ...START }, { t: 1, ...mode('combat') }] })).toEqual({ ok: false, error: 'inputs[1]: unknown kind or bad value' });
  expect(validateReplay({ ...replayData([{ t: 0, ...START }, { t: 1, ...mode('combat') }]) }).ok).toBe(false);
  // The 실전 수치 go with a combat game and only with it.
  expect(() => createSim({ ...init(1), mode: 'combat' })).toThrow('combat data goes with mode combat');
  expect(() => createSim({ ...init(1), combat: COMBAT })).toThrow('combat data goes with mode combat');
});

test('실전: 판 기록의 모드는 실전 판에서만 combat이다', () => {
  const combat = createSim(combatInit(20261106));
  expect(combat.record().mode).toBe('combat'); // 작전 준비
  combat.step([START]);
  for (let k = 0; k < 5; k++) combat.step([]);
  expect(combat.record().mode).toBe('combat');
  expect(Object.keys(combat.record())).toHaveLength(23);
  for (const m of ['standard', 'training'] as const) {
    const sim = createSim({ ...init(20261106), mode: m });
    sim.step([START]);
    sim.step([mode(m === 'standard' ? 'training' : 'standard')]);
    expect(sim.record().mode, m).not.toBe('combat');
    expect(Object.keys(sim.record()), m).toEqual(Object.keys(combat.record())); // the same 23 items
  }
});
