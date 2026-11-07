import { describe, expect, test } from 'vitest';
import { createSim, replay, SIM_VERSION, validateReplay } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { init, replayData, START } from './init';

const { terrain } = init(20261106); // terrain is not part of 재생 자료

const errorOf = (x: unknown) => {
  const r = validateReplay(x);
  return r.ok ? null : r.error;
};

describe('뼈대', () => {
  test('뼈대: 같은 시드는 같은 상태 해시', () => {
    const a = createSim(init(20261106));
    const b = createSim(init(20261106));
    const other = createSim(init(20261107));
    expect(a.hash()).toBe(b.hash());
    for (let tick = 1; tick <= 50; tick++) {
      const inputs = tick === 1 ? [START] : [];
      a.step(inputs);
      b.step(inputs);
      other.step(inputs);
      expect(a.state.tick).toBe(tick);
      expect(a.hash()).toBe(b.hash());
      expect(other.hash()).not.toBe(a.hash());
    }
    expect(a.record()).toEqual(b.record());
  });

  test('뼈대: 한 틱 진행은 입력마다 수락 여부를 알린다', () => {
    const sim = createSim(init(7));
    const twin = createSim(init(7));
    expect(sim.step([]).accepted).toEqual([]);
    twin.step([]);
    // Unknown kinds are reported and ignored, and change nothing.
    const result = sim.step([{ a: 'zz' }, { a: 'yy', v: [1] }]);
    twin.step([]);
    expect(result.accepted).toEqual([false, false]);
    expect(result.events).toEqual([]);
    expect(sim.hash()).toBe(twin.hash());
  });

  test('뼈대: 재생 자료 형식 검사', () => {
    const valid = replayData([{ t: 0, a: 'bino', v: [1] }, { t: 3, a: 'cam', v: [1, -2] }, { t: 3, a: 'bino', v: [0] }, { t: 9, a: 'cam', v: [63999, 2000] }]);
    expect(validateReplay(valid)).toEqual({ ok: true, data: valid });

    // Ticks must not decrease and must stay below the total tick count.
    const bino = { a: 'bino', v: [1] };
    expect(errorOf(replayData([{ t: 3, ...bino }, { t: 2, ...bino }]))).toMatch(/tick/);
    expect(errorOf(replayData([{ t: 10, ...bino }]))).toMatch(/tick/);
    expect(errorOf(replayData([{ t: -1, ...bino }]))).toMatch(/tick/);

    // Integers, enums and integer arrays only; each kind with exactly its values, in range.
    expect(errorOf(replayData([{ t: 1, a: 'cam', v: [0.5, 0] }]))).not.toBeNull();
    for (const bad of [{ a: 'zz' }, { a: 'cam', v: [1] }, { a: 'cam', v: [64000, 0] }, { a: 'cam', v: [0, -2001] }, { a: 'bino' }, { a: 'bino', v: [2] }])
      expect(errorOf(replayData([{ t: 1, ...bad }]))).toMatch(/inputs\[0\]/);
    expect(errorOf({ ...valid, format: 2 })).not.toBeNull();
    expect(errorOf({ ...valid, stepMs: 16 })).not.toBeNull();
    expect(errorOf({ ...valid, mode: 'hard' })).not.toBeNull();
    expect(errorOf({ ...valid, weather: { ...valid.weather, tempTenthC: 9.4 } })).not.toBeNull();
    expect(errorOf({ ...valid, extra: 1 })).not.toBeNull();
    // The error does not depend on key order.
    expect(errorOf({ ...valid, b: 1, a: 1 })).toBe(errorOf({ ...valid, a: 1, b: 1 }));
    expect(errorOf(null)).not.toBeNull();

    // Replaying data that holds an input the simulation ignores counts it.
    const r = replay(replayData([{ t: 0, ...START }, { t: 2, a: 'zz' }]), terrain, BASE_SCENARIO);
    expect(r.ignored).toBe(1);
    expect(r.record.ticks).toBe(10);
    expect(() => replay({ ...valid, simVersion: SIM_VERSION + 1 }, terrain, BASE_SCENARIO)).toThrow(/simVersion/);
  });
});
