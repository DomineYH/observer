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

test('실전: 더 많은 적 — 증원은 실전에서만 나오고 같은 시드의 원래 적·아군 배치는 표준과 같다', () => {
  for (const seed of [20261106, 1]) {
    const standard = createSim(init(seed));
    const combat = createSim(combatInit(seed));
    // 표준: the scenario stream draws as it did before 증원 (the count at creation, measured before M3-16).
    expect(standard.state.rng.scn.count, `${seed}`).toBe(1051);
    expect(standard.state.platoons, `${seed}`).toHaveLength(5);
    expect(combat.state.rng.scn.count, `${seed}`).toBeGreaterThan(1051); // 실전 draws the 증원 second
    // The five units and the friendly soldiers stand where 표준 puts them, to the last digit; 실전 has two more.
    expect(combat.state.platoons.slice(0, 5), `${seed}`).toEqual(standard.state.platoons);
    expect(combat.state.friendlies, `${seed}`).toEqual(standard.state.friendlies);
    const [inf, apc] = combat.state.platoons.slice(5);
    expect(combat.state.platoons, `${seed}`).toHaveLength(7);
    expect(inf, `${seed}`).toMatchObject({ type: 'inf', state: 'wait', t0: 420 * 20 });
    expect(['A', 'C'], `${seed}`).toContain(inf!.route);
    expect(apc, `${seed}`).toMatchObject({ type: 'apc', state: 'wait', t0: 480 * 20 });
    expect(['B', 'C'], `${seed}`).toContain(apc!.route);
    // Ordinary units once added: 판 기록의 전투 부대 수 counts them.
    expect(standard.record().combatUnits).toBe(4);
    expect(combat.record().combatUnits).toBe(6);
  }
  // `base` sets them off at 420 s and 480 s.
  const sim = createSim(combatInit(20261106));
  sim.step([START]);
  const [inf, apc] = sim.state.platoons.slice(5);
  while (sim.state.tick < 420 * 20 - 1) sim.step([]);
  expect([inf!.state, apc!.state]).toEqual(['wait', 'wait']);
  sim.step([]);
  expect([inf!.state, apc!.state]).toEqual(['approach', 'wait']);
  while (sim.state.tick < 480 * 20 - 1) sim.step([]);
  expect(apc!.state).toBe('wait');
  sim.step([]);
  expect(apc!.state).toBe('approach');
  expect(sim.state.phase).toBe('live');
});
