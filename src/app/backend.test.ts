import { expect, test } from 'vitest';
import { mockTerrain } from '@adapters/mock/terrain';
import { selectBackend, terrainSourceOf } from './backend';

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
