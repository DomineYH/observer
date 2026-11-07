import { expect, test } from 'vitest';
import { CALL_ADJUST, CALL_FFE, LOC_CLEAR, POLAR, SHIFT, answered, ended, openRadio, send, started } from '../../tests/acceptance/mission';
import { hashState } from './stateHash';
import type { SimState } from './types';

test('상태 해시: 극좌표 표적위치의 방법·방위각·거리가 해시에 든다', () => {
  // A real state with a polar 표적위치; copies that differ in that location alone must hash apart.
  const sim = started();
  openRadio(sim);
  send(sim, CALL_ADJUST);
  answered(sim, 'call');
  expect(send(sim, POLAR(800, 1000)).ok).toBe(true);
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (l: { method: string; azimuth: number; distance: number }) => void) => {
    const s = structuredClone(state);
    change(s.missions[0]!.location as never);
    return hashState(s);
  };
  expect(hashState(structuredClone(state))).toBe(base);
  expect(differs((l) => (l.distance = 1100))).not.toBe(base);
  expect(differs((l) => (l.azimuth = 801))).not.toBe(base);
  // And no location at all is not the same as a polar one.
  const none = structuredClone(state);
  none.missions[0]!.location = null;
  expect(hashState(none)).not.toBe(base);
});

test('상태 해시: 전이 임무의 전이 슬롯이 해시에 든다', () => {
  // A real state just after a 전이; copies that differ in one 전이 slot alone must hash apart.
  const sim = started();
  openRadio(sim);
  ended(sim, CALL_FFE, LOC_CLEAR);
  expect(send(sim, SHIFT(800, 'right', 100, 'add', 200, 3, 0, 'infantry', 'moving', 'men', 12)).ok).toBe(true);
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (t: Record<string, unknown>) => void) => {
    const s = structuredClone(state);
    change(s.missions[1]!.shift as never);
    return hashState(s);
  };
  expect(hashState(structuredClone(state))).toBe(base);
  const changes: [string, unknown][] = [['targetNumber', 1000], ['direction', 801], ['lateralDir', 'left'], ['lateral', 110],
    ['rangeDir', 'drop'], ['range', 250], ['rounds', 2], ['dangerClose', 1], ['targetType', 'apc'], ['activity', 'halted'],
    ['unit', 'vehicles'], ['count', 11]];
  for (const [k, value] of changes) expect(differs((t) => (t[k] = value)), k).not.toBe(base);
  const none = structuredClone(state);
  none.missions[1]!.shift = null;
  expect(hashState(none)).not.toBe(base);
});
