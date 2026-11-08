import { describe, expect, test } from 'vitest';
import { createSim, replay, type Input } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { init, replayData, START } from './init';

const TRAINING: Input = { a: 'mode', v: ['training'] };
const STANDARD: Input = { a: 'mode', v: ['standard'] };

describe('F-14: 모드 전환은 입력이다', () => {
  test('F-14: 모드 전환은 입력이다', () => {
    const sim = createSim(init(20261106));
    const twin = createSim(init(20261106));
    sim.step([START]);
    twin.step([START]);
    expect(sim.record().mode).toBe('standard');

    expect(sim.step([TRAINING]).accepted).toEqual([true]);
    twin.step([]);
    expect(sim.state.mode).toBe('training');
    expect(sim.record().mode).toBe('training');
    expect(sim.hash()).not.toBe(twin.hash());

    // Back to standard: the game stays a training game (it is stored, never ranked).
    expect(sim.step([STANDARD]).accepted).toEqual([true]);
    twin.step([]);
    expect(sim.state.mode).toBe('standard');
    expect(sim.record().mode).toBe('training');
    expect(sim.hash()).not.toBe(twin.hash()); // same mode now, a different history

    // The same mode again, an unknown mode or a malformed value: ignored.
    for (const bad of [STANDARD, { a: 'mode', v: ['train'] }, { a: 'mode', v: [] }, { a: 'mode', v: [1] }, { a: 'mode' }])
      expect(sim.step([bad]).accepted).toEqual([false]);

    // The switches replay as inputs: the same record, none ignored.
    const inputs = [
      { t: 0, ...START },
      { t: 1, ...TRAINING },
      { t: 2, ...STANDARD },
    ];
    const r = replay(replayData(inputs, sim.state.tick), init(20261106).terrain, BASE_SCENARIO);
    expect(r.ignored).toBe(0);
    expect(r.record).toEqual(sim.record());
  });

  test('F-14: 모드 전환은 입력이다 — 작전 준비 중의 전환은 판 기록에 남지 않는다', () => {
    const free = createSim(init(20261106));
    expect(free.step([TRAINING]).accepted).toEqual([true]);
    expect(free.state.mode).toBe('training');
    expect(free.step([STANDARD]).accepted).toEqual([true]);
    free.step([START]);
    for (let i = 0; i < 20; i++) free.step([]);
    expect(free.record().mode).toBe('standard');

    // Still training at 작전 개시: a training game.
    const trained = createSim(init(20261106));
    trained.step([TRAINING]);
    trained.step([START]);
    trained.step([STANDARD]);
    expect(trained.record().mode).toBe('training');
  });

  test('F-14: 모드 전환은 입력이다 — 처음부터 훈련', () => {
    const sim = createSim({ ...init(20261106), mode: 'training' });
    expect(sim.state.mode).toBe('training');
    sim.step([START]);
    sim.step([STANDARD]);
    expect(sim.record().mode).toBe('training');
  });
});
