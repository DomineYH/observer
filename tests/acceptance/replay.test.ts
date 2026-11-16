// 재생 자료의 terrain: the validator and the replayer through the public sim interface.
import { describe, expect, test } from 'vitest';
import { replay, validateReplay, type ReplayData, type TerrainData } from '@sim';
import { COMBAT } from '@content/combat';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { readGolden } from '../golden/golden';
import { replayData, START } from './init';
import { flatTerrain } from './terrain';

const data = (): ReplayData => replayData([{ t: 0, ...START }]);
const withTerrain = (terrain: unknown): unknown => ({ ...data(), terrain });
const combat = (): ReplayData => ({ ...data(), mode: 'combat', combatDataVersion: COMBAT.version });

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
    expect(() => replay(data(), { ...mock, id: 'x' }, BASE_SCENARIO, BASE_GUNS)).toThrow(/terrain/);
    expect(() => replay(data(), { ...mock, version: 2 }, BASE_SCENARIO, BASE_GUNS)).toThrow(/terrain/);
    const onX2 = { ...data(), terrain: { id: 'x', version: 2 } };
    expect(() => replay(onX2, mock, BASE_SCENARIO, BASE_GUNS)).toThrow(/terrain/);
    expect(replay(onX2, x2, BASE_SCENARIO, BASE_GUNS).record).toEqual(replay(data(), mock, BASE_SCENARIO, BASE_GUNS).record);
  });

  test('F-31: 포 프로파일이나 실전 자료 판이 다르면 재생하지 않는다', () => {
    const mock = flatTerrain();
    expect(() => replay(data(), mock, BASE_SCENARIO, { ...BASE_GUNS, id: 'k9' })).toThrow("guns k9@1 is not the header's base@1");
    expect(() => replay(data(), mock, BASE_SCENARIO, { ...BASE_GUNS, version: 2 })).toThrow("guns base@2 is not the header's base@1");
    const onK9 = { ...data(), guns: { id: 'k9', version: 1 } };
    expect(() => replay(onK9, mock, BASE_SCENARIO, BASE_GUNS)).toThrow("guns base@1 is not the header's k9@1");
    // The check is by id and version: the same numbers under the header's name replay to the same game.
    expect(replay(onK9, mock, BASE_SCENARIO, { ...BASE_GUNS, id: 'k9' }).record).toEqual(replay(data(), mock, BASE_SCENARIO, BASE_GUNS).record);
    // A header that carries the numbers is refused by the format check.
    expect(validateReplay({ ...data(), guns: BASE_GUNS })).toEqual({ ok: false, error: 'guns: unknown key' });
    // 실전 자료 판: a combat header is replayed with the 실전 자료 of its 판 only.
    expect(replay(combat(), mock, BASE_SCENARIO, BASE_GUNS, COMBAT).record.mode).toBe('combat');
    expect(() => replay(combat(), mock, BASE_SCENARIO, BASE_GUNS, { ...COMBAT, version: 2 })).toThrow("combat data version 2 is not the header's 1");
    expect(() => replay({ ...combat(), combatDataVersion: 2 }, mock, BASE_SCENARIO, BASE_GUNS, COMBAT)).toThrow("combat data version 1 is not the header's 2");
    expect(() => replay(combat(), mock, BASE_SCENARIO, BASE_GUNS)).toThrow("combat data version none is not the header's 1");
    // A training or standard header has none to compare: what is handed over is left out of the game.
    expect(replay(data(), mock, BASE_SCENARIO, BASE_GUNS, { ...COMBAT, version: 2 })).toEqual(replay(data(), mock, BASE_SCENARIO, BASE_GUNS));
  });

  test('F-31: 실전의 머리', () => {
    expect(validateReplay(combat()).ok).toBe(true);
    // combat ⇒ combatDataVersion, an integer from 1
    const bare: Partial<ReplayData> = combat();
    delete bare.combatDataVersion;
    expect(validateReplay(bare)).toEqual({ ok: false, error: 'combatDataVersion: integer in 1..2147483647 expected' });
    for (const v of [0, 1.5, '1', null]) expect(validateReplay({ ...combat(), combatDataVersion: v }), String(v)).toEqual({ ok: false, error: 'combatDataVersion: integer in 1..2147483647 expected' });
    // not combat ⇒ no combatDataVersion
    for (const mode of ['standard', 'training']) expect(validateReplay({ ...combat(), mode }), mode).toEqual({ ok: false, error: 'combatDataVersion: only with mode combat' });
    expect(validateReplay({ ...data(), mode: 'live' })).toEqual({ ok: false, error: 'mode: training | standard | combat expected' });
    // a mode input never carries combat, in any header; training and standard still pass
    const modeInput = (m: string) => [{ t: 0, a: 'mode', v: [m] }, { t: 0, ...START }];
    expect(validateReplay({ ...combat(), inputs: modeInput('combat') })).toEqual({ ok: false, error: 'inputs[0]: unknown kind or bad value' });
    expect(validateReplay({ ...data(), inputs: modeInput('combat') })).toEqual({ ok: false, error: 'inputs[0]: unknown kind or bad value' });
    for (const m of ['training', 'standard']) expect(validateReplay({ ...data(), inputs: modeInput(m) }).ok, m).toBe(true);
    // a mode input in a combat game passes the format check; replayed, it is an ignored input (ADR 0003)
    const switched = { ...combat(), inputs: [{ t: 0, ...START }, { t: 1, a: 'mode', v: ['standard'] }] };
    expect(validateReplay(switched).ok).toBe(true);
    expect(replay(switched, flatTerrain(), BASE_SCENARIO, BASE_GUNS, COMBAT).ignored).toBe(1);
    // guns stay an id and a version in a combat header too
    expect(validateReplay({ ...combat(), guns: BASE_GUNS })).toEqual({ ok: false, error: 'guns: unknown key' });
  });

  // The terrain check comes before the simulation starts, so no real land is loaded here.
  test('F-31: ⑤의 재생 자료는 terrain으로 지형을 가리킨다', () => {
    const five = readGolden('5-real-laser-move.json').replay;
    expect(validateReplay(five).ok).toBe(true);
    expect(five.terrain).toEqual({ id: 'mungyeong', version: 2 });
    const scenario = MUNGYEONG_PLACEMENT.scenario;
    expect(() => replay(five, { ...flatTerrain(), id: 'mungyeong', version: 3 }, scenario, BASE_GUNS)).toThrow(/terrain/); // another 판
    expect(() => replay(five, flatTerrain(), scenario, BASE_GUNS)).toThrow(/terrain/); // mock@1
  });
});
