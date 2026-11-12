// 재생 자료의 terrain: the validator and the replayer through the public sim interface.
import { describe, expect, test } from 'vitest';
import { replay, validateReplay, type ReplayData, type TerrainData } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { readGolden } from '../golden/golden';
import { replayData, START } from './init';
import { flatTerrain } from './terrain';

const data = (): ReplayData => replayData([{ t: 0, ...START }]);
const withTerrain = (terrain: unknown): unknown => ({ ...data(), terrain });

describe('F-31', () => {
  test('F-31: 재생 자료 검사기와 terrain', () => {
    expect(validateReplay(data()).ok).toBe(true);
    expect(validateReplay(withTerrain({ id: 'mungyeong', version: 2 })).ok).toBe(true);
    const bad = [
      { id: 'mock', version: 1 },
      { id: 'mungyeong', version: 0 },
      { id: 'mungyeong', version: 1.5 },
      { id: 'A b', version: 1 },
      { id: 'mungyeong', version: 1, extra: 1 },
      { id: 'mungyeong' },
      null,
      'mungyeong',
      undefined,
    ];
    for (const t of bad) {
      const r = validateReplay(withTerrain(t));
      expect(r.ok, JSON.stringify(t)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/terrain/);
    }
  });

  test('F-31: 시나리오 식별자에 하이픈', () => {
    const withScenario = (id: string) => validateReplay({ ...data(), scenario: { id, version: 1 } });
    for (const id of ['base-mungyeong', 'a-b-c', 'base_2']) expect(withScenario(id).ok, id).toBe(true);
    for (const id of ['-base', 'base-', 'base--x', 'Base-mungyeong', 'base mungyeong', 'base.x', '문경', '']) {
      const r = withScenario(id);
      expect(r.ok, id).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/scenario\.id/);
    }
    expect(validateReplay(withTerrain({ id: 'A b', version: 1 })).ok).toBe(false);
  });

  test('F-31: 재생 자료의 지형이 다르면 재생하지 않는다', () => {
    const mock = flatTerrain();
    const x2: TerrainData = { ...mock, id: 'x', version: 2 };
    expect(() => replay(data(), { ...mock, id: 'x' }, BASE_SCENARIO)).toThrow(/terrain/);
    expect(() => replay(data(), { ...mock, version: 2 }, BASE_SCENARIO)).toThrow(/terrain/);
    const onX2 = { ...data(), terrain: { id: 'x', version: 2 } };
    expect(() => replay(onX2, mock, BASE_SCENARIO)).toThrow(/terrain/);
    expect(replay(onX2, x2, BASE_SCENARIO).record).toEqual(replay(data(), mock, BASE_SCENARIO).record);
  });

  // The terrain check comes before the simulation starts, so no real land is loaded here.
  test('F-31: ⑤의 재생 자료는 terrain으로 지형을 가리킨다', () => {
    const five = readGolden('5-real-laser-move.json').replay;
    expect(validateReplay(five).ok).toBe(true);
    expect(five.terrain).toEqual({ id: 'mungyeong', version: 2 });
    const scenario = MUNGYEONG_PLACEMENT.scenario;
    expect(() => replay(five, { ...flatTerrain(), id: 'mungyeong', version: 3 }, scenario)).toThrow(/terrain/); // another 판
    expect(() => replay(five, flatTerrain(), scenario)).toThrow(/terrain/); // mock@1
  });
});
