// 번호 점검 (spec 좋은 테스트): every M1 식별 번호 has at least one test whose name starts with it. A static scan of the
// test sources: `test`/`it`/`describe`/`test.describe` names count, `test.step` names do not (a step is not a test).
import { globSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `F-${String(a + i).padStart(2, '0')}`);
const IDS = [...range(1, 15), 'F-17', ...range(21, 31), 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'];

/** The 식별 번호 the test names in `source` start with. */
function idsIn(source: string): Set<string> {
  const re = /\b(?:test|it|describe)(?:\.describe)?\(\s*['"`]((?:F-\d\d|B\d)(?!\d))/g;
  return new Set([...source.matchAll(re)].map((m) => m[1]!));
}

test('번호 점검: 모든 F와 B에 테스트', () => {
  // The matcher itself: a longer number, a step and a bare call are not names of M1 tests.
  expect([...idsIn("test('B10: x'); test.step('F-21: x'); sim.step('F-01'); fit('B2')")]).toEqual([]);
  expect([...idsIn("test.describe('B7: x'); it(`F-01 x`); describe(\"F-12\", f); test('F-07: 키')")]).toEqual(['B7', 'F-01', 'F-12', 'F-07']);

  // Not this file: its matcher samples name numbers too.
  const files = globSync('{src,tests}/**/*.{test,spec}.{ts,tsx}', { cwd: ROOT }).filter((f) => !f.endsWith('lint/ids.test.ts'));
  expect(files.length).toBeGreaterThan(50);
  const seen = new Set(files.flatMap((f) => [...idsIn(readFileSync(ROOT + f, 'utf8'))]));
  expect(IDS.filter((id) => !seen.has(id)), '테스트가 없는 번호').toEqual([]);
});
