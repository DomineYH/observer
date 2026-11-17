import { expect, test } from 'vitest';
import { combatInit, init, START } from '../../tests/acceptance/init';
import { CALL_ADJUST, openRadio } from '../../tests/acceptance/mission';
import { ACTS } from './queue';
import { STREAMS } from './rng';
import { createSim } from './sim';
import { hashState, SHOOTERS } from './stateHash';
import { MODES, type Sim, type SimState } from './types';

test('상태 해시: 실전의 상태는 실전에서만 든다', () => {
  const standard = createSim(init(7));
  standard.step([START]);
  const state = structuredClone(standard.state) as SimState;
  const base = hashState(state);
  expect(state.combat).toBeNull();
  // 표준 판의 상태에 실전 값을 채워도 해시가 같다.
  for (const lasesUsed of [0, 3]) expect(hashState({ ...structuredClone(state), combat: { lasesUsed } }), String(lasesUsed)).toBe(base);
  const training = { ...structuredClone(state), mode: 'training' as const };
  expect(hashState({ ...training, combat: { lasesUsed: 3 } })).toBe(hashState(training));
  // The chunk is there in a combat game: the same state as combat hashes apart from the mode alone.
  const combat = createSim(combatInit(7));
  combat.step([START]);
  expect(combat.state.combat).toEqual({ lasesUsed: 0 });
  expect(combat.hash()).not.toBe(base);
  const used = (lasesUsed: number) => hashState({ ...structuredClone(combat.state as SimState), combat: { lasesUsed } });
  expect(used(0)).toBe(combat.hash());
  expect(new Set([0, 1, 5].map(used)).size).toBe(3); // 쓴 레이저 횟수
  // M3-18 · 20 add here: each value of the chunk, changed alone in a combat state, changes the hash.
  // 밀린 복창 (M3-14): per mission, in mission order; a standard game's missions carry none.
  const called = (sim: Sim): SimState => {
    sim.step([START]);
    openRadio(sim);
    expect(sim.step([CALL_ADJUST]).accepted).toEqual([true]);
    return structuredClone(sim.state) as SimState;
  };
  const inCombat = called(createSim(combatInit(7)));
  const none = hashState(inCombat);
  for (const k of ['mto', 'shot', 'rounds_complete', 'correcting'] as const) {
    const c = structuredClone(inCombat);
    c.missions[0]!.readback = { ...c.missions[0]!.readback!, [k]: true };
    expect(hashState(c), k).not.toBe(none);
  }
  const inStandard = called(createSim(init(7)));
  expect(inStandard.missions[0]!.readback).toBeNull();
  const filled = structuredClone(inStandard);
  filled.missions[0]!.readback = { mto: true, shot: true, rounds_complete: true, correcting: true };
  expect(hashState(filled)).toBe(hashState(inStandard));
});

test('상태 해시: 번호로 읽는 목록은 끝에만 더한다', () => {
  expect(MODES.slice(0, 2)).toEqual(['training', 'standard']);
  expect(MODES.indexOf('combat')).toBe(2);
  expect(ACTS.slice(0, 25)).toEqual(['radio_check', 'check_reply', 'call_ack', 'loc_readback', 'desc_readback', 'mto', 'ready',
    'shot', 'shot_readback', 'impact', 'adjust_open', 'corr_readback', 'rounds_complete', 'rounds_complete_readback',
    'effect_open', 'repeat_ack', 'dc_resend', 'shift_readback', 'move_readback', 'pos_readback',
    'retaliation', 'retaliation_muzzle', 'end', 'shell', 'shelling_note']);
  expect(SHOOTERS.slice(0, 2)).toEqual(['mortar', 'direct']);
  expect(STREAMS).toEqual(['scn', 'bal', 'fdc', 'exp', 'ai', 'las']);
});
