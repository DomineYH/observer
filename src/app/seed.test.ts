import { expect, test } from 'vitest';
import { chooseSeed, dailySeed, kstDate } from './seed';

test('F-30: 일일 시드와 연습 시드', () => {
  // The daily seed is the KST calendar date: KST runs 9 hours ahead of UTC.
  expect(dailySeed(2026, 11, 6)).toBe(20261106);
  expect(kstDate(Date.UTC(2026, 10, 5, 15, 0))).toEqual({ y: 2026, m: 11, d: 6 });
  expect(kstDate(Date.UTC(2026, 10, 6, 14, 59, 59, 999))).toEqual({ y: 2026, m: 11, d: 6 });
  expect(kstDate(Date.UTC(2026, 10, 6, 15, 0))).toEqual({ y: 2026, m: 11, d: 7 });
  expect(kstDate(Date.UTC(2026, 11, 31, 15, 0))).toEqual({ y: 2027, m: 1, d: 1 });

  // Without ?seed= the same KST date gives the same daily seed all day long.
  for (const now of [Date.UTC(2026, 10, 5, 15, 0), Date.UTC(2026, 10, 6, 3, 30), Date.UTC(2026, 10, 6, 14, 59, 59, 999)])
    expect(chooseSeed('', now)).toEqual({ seed: 20261106, seedKind: 'daily' });
  expect(chooseSeed('?fps=1', Date.UTC(2026, 10, 6, 15, 0))).toEqual({ seed: 20261107, seedKind: 'daily' });

  // ?seed= with 1–9 digits is a practice seed; anything else falls back to the daily seed (demo line 188).
  const now = Date.UTC(2026, 10, 6, 0, 0);
  expect(chooseSeed('?seed=1234', now)).toEqual({ seed: 1234, seedKind: 'practice' });
  expect(chooseSeed('?fps=1&seed=999999999', now)).toEqual({ seed: 999999999, seedKind: 'practice' });
  for (const q of ['?seed=', '?seed=abc', '?seed=-5', '?seed=12.5', '?seed=1234567890'])
    expect(chooseSeed(q, now), q).toEqual({ seed: 20261106, seedKind: 'daily' });
});
