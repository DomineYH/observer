import { expect, test } from 'vitest';
import { CALL_ADJUST, POLAR, answered, openRadio, send, started } from '../../tests/acceptance/mission';
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
