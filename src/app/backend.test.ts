import { expect, test } from 'vitest';
import { selectBackend } from './backend';

test('조립 지점: mock이 아니면 멈춘다', () => {
  expect(selectBackend(undefined)).toBe('mock');
  expect(selectBackend('mock')).toBe('mock');
  for (const value of ['real', 'MOCK', '', 'x']) expect(() => selectBackend(value), value).toThrow(/VITE_OBSERVER_BACKEND/);
});
