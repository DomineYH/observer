import { describe, expect, test } from 'vitest';
import { createSim, replay, SIM_VERSION, validateReplay } from '@sim';
import type { ReplayData } from '@sim';
import { init } from './init';

const replayData = (inputs: ReplayData['inputs'], totalTicks = 10): ReplayData => ({
  format: 1,
  simVersion: SIM_VERSION,
  ...init(20261106),
  stepMs: 50,
  inputs,
  totalTicks,
});

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
      a.step([]);
      b.step([]);
      other.step([]);
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
    // No input kinds exist in the skeleton: every input is reported and ignored, and changes nothing.
    const result = sim.step([{ a: 'zz' }, { a: 'yy', v: [1] }]);
    twin.step([]);
    expect(result.accepted).toEqual([false, false]);
    expect(result.events).toEqual([]);
    expect(sim.hash()).toBe(twin.hash());
  });

  test('뼈대: 재생 자료 형식 검사', () => {
    const valid = replayData([{ t: 0, a: 'zz' }, { t: 3, a: 'zz', v: [1, -2] }, { t: 3, a: 'yy' }, { t: 9, a: 'zz' }]);
    expect(validateReplay(valid)).toEqual({ ok: true, data: valid });

    // Ticks must not decrease and must stay below the total tick count.
    expect(errorOf(replayData([{ t: 3, a: 'zz' }, { t: 2, a: 'zz' }]))).toMatch(/tick/);
    expect(errorOf(replayData([{ t: 10, a: 'zz' }]))).toMatch(/tick/);
    expect(errorOf(replayData([{ t: -1, a: 'zz' }]))).toMatch(/tick/);

    // Integers, enums and integer arrays only.
    expect(errorOf(replayData([{ t: 1, a: 'zz', v: [0.5] }]))).not.toBeNull();
    expect(errorOf({ ...valid, format: 2 })).not.toBeNull();
    expect(errorOf({ ...valid, stepMs: 16 })).not.toBeNull();
    expect(errorOf({ ...valid, mode: 'hard' })).not.toBeNull();
    expect(errorOf({ ...valid, weather: { ...valid.weather, tempTenthC: 9.4 } })).not.toBeNull();
    expect(errorOf({ ...valid, extra: 1 })).not.toBeNull();
    expect(errorOf(null)).not.toBeNull();

    // Replaying data that holds an input the simulation ignores counts it.
    const r = replay(replayData([{ t: 2, a: 'zz' }]));
    expect(r.ignored).toBe(1);
    expect(r.record.ticks).toBe(10);
    expect(() => replay({ ...valid, simVersion: SIM_VERSION + 1 })).toThrow(/simVersion/);
  });
});
