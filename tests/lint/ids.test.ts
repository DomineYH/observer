// 번호 점검 (spec 좋은 테스트): every M1 식별 번호 has at least one test whose name starts with it. A static scan of the
// test sources, parsed: `test`/`it`/`describe`/`test.describe` names count, `test.step` names do not (a step is not a
// test), and nothing in comments or other strings does.
import { globSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { declaredNames } from './testNames';

const ROOT = new URL('../..', import.meta.url).pathname;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `F-${String(a + i).padStart(2, '0')}`);
const IDS = [...range(1, 15), 'F-17', ...range(21, 31), 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'];

/** The 식별 번호 the tests declared in `source` start with: a number ends at a non-word character (B1 is not B10). */
function idsIn(source: string, fileName?: string): Set<string> {
  return new Set(declaredNames(source, fileName).flatMap((name) => name.match(/^(F-\d\d|B\d)(?!\w)/)?.[1] ?? []));
}

test('번호 점검: 모든 F와 B에 테스트', () => {
  // The matcher itself: comments, other objects' calls, steps, longer numbers and words are not names of M1 tests.
  const none = [
    "test('B10: x'); test.step('F-21: x'); sim.step('F-01'); fit('B2')",
    "// test('B7: x')",
    "/* describe('B3: x') */ const s = \"test('B4: x')\";",
    "helper.test('F-01: x'); a.describe('F-02: x')",
    "test('B1extra'); test(`F-0${1}: x`)",
  ];
  for (const source of none) expect([...idsIn(source)], source).toEqual([]);
  expect([...idsIn("test.describe('B7: x'); it(`F-01 x`); describe(\"F-12\", f); test('F-07: 키')")]).toEqual(['B7', 'F-01', 'F-12', 'F-07']);
  expect([...idsIn("const v = <div />; test('B5: x', () => {});", 'x.test.tsx')]).toEqual(['B5']);

  const files = globSync('{src,tests}/**/*.{test,spec}.{ts,tsx}', { cwd: ROOT });
  expect(files.length).toBeGreaterThan(50);
  const seen = new Set(files.flatMap((f) => [...idsIn(readFileSync(ROOT + f, 'utf8'), f)]));
  expect(IDS.filter((id) => !seen.has(id)), '테스트가 없는 번호').toEqual([]);
});
