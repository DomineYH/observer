import { expect, test } from 'vitest';
import { mockTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO, BRIEFING } from '@content/scenario';
import { MOCK_PLACEMENT } from '@content/placement';
import { placementOf, selectBackend, terrainSourceOf } from './backend';

test('조립 지점: real을 받는다', () => {
  expect(selectBackend(undefined)).toBe('mock');
  expect(selectBackend('mock')).toBe('mock');
  expect(selectBackend('real')).toBe('real');
  for (const value of ['MOCK', 'REAL', '', 'x']) expect(() => selectBackend(value), value).toThrow(/VITE_OBSERVER_BACKEND/);
});

test('조립 지점: real은 원천이 없어 멈춘다', () => {
  expect(terrainSourceOf('mock')).toBe(mockTerrain);
  expect(() => terrainSourceOf('real')).toThrow(/실제 지형 원천이 아직 없다/);
});

test('배치: 조립 지점이 지형 원천과 짝지어 고른다', async () => {
  const placement = placementOf('mock');
  expect(placement).toBe(MOCK_PLACEMENT);
  expect(placement.scenario).toBe(BASE_SCENARIO);
  expect(placement.briefing).toEqual({ ...BRIEFING, plannedOp: '1번 고지' });
  expect(placement.scenario.reserveOps).toBeUndefined();
  for (const seed of [1, 20261106]) {
    const terrain = await terrainSourceOf('mock').load(seed);
    expect({ id: terrain.id, version: terrain.version }, String(seed)).toEqual(placement.terrain);
  }
  expect(() => placementOf('real')).toThrow(/배치가 아직 없다/);
}, 30_000); // two mock terrain generations: several seconds, more under load
