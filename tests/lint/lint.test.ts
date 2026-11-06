import { describe, expect, test } from 'vitest';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('../..', import.meta.url).pathname });

/** Rule ids reported for `code` as if it lived at `filePath`. */
async function rulesFor(filePath: string, code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((m) => m.ruleId);
}

const BANNED: [string, string][] = [
  ['Math.random()', 'no-restricted-properties'],
  ['Math.sin(1)', 'no-restricted-properties'],
  ['Math.cos(1)', 'no-restricted-properties'],
  ['Math.tan(1)', 'no-restricted-properties'],
  ['Math.atan2(1, 2)', 'no-restricted-properties'],
  ['Math.exp(1)', 'no-restricted-properties'],
  ['Math.log(2)', 'no-restricted-properties'],
  ['Math.pow(2, 3)', 'no-restricted-properties'],
  ['Math.hypot(3, 4)', 'no-restricted-properties'],
  ['Date.now()', 'no-restricted-globals'],
  ['new Date()', 'no-restricted-globals'],
  ['performance.now()', 'no-restricted-globals'],
  ['setTimeout(() => 0, 1)', 'no-restricted-globals'],
  ['requestAnimationFrame(() => 0)', 'no-restricted-globals'],
  ['window.innerWidth', 'no-restricted-globals'],
  ['document.title', 'no-restricted-globals'],
  ['navigator.language', 'no-restricted-globals'],
  ['globalThis.x', 'no-restricted-globals'],
  ['2 ** 3', 'no-restricted-syntax'],
  ['let x = 2; x **= 2', 'no-restricted-syntax'],
  ['for (const k in {}) k', 'no-restricted-syntax'],
];

describe('린트', () => {
  test('린트: 금지 규칙 자기 검사', async () => {
    for (const [code, rule] of BANNED) {
      expect(await rulesFor('src/sim/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      // The mock terrain generator follows the same bans.
      expect(await rulesFor('src/adapters/mock/terrain/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      // Outside the simulation the same code is allowed.
      expect(await rulesFor('src/app/__probe__.ts', `export {}; ${code};`), code).not.toContain(rule);
    }
    const allowed = 'export const f = (a: number) => Math.imul(a, 3) + Math.sqrt(a) + Math.floor(a) + Math.fround(a) + Math.PI;';
    expect(await rulesFor('src/sim/__probe__.ts', allowed)).toEqual([]);
  });

  test('린트: 모듈 의존 자기 검사', async () => {
    const forbidden: [string, string][] = [
      ['src/sim/__probe__.ts', "import { x } from '@content/scenario';"],
      ['src/sim/__probe__.ts', "import { useState } from 'react';"],
      ['src/sim/__probe__.ts', "import { x } from '../app/main';"],
      ['src/sim/radio/__probe__.ts', "import { x } from '../../ui/x';"],
      ['src/content/__probe__.ts', "import { createSim } from '@sim';"],
      ['src/content/__probe__.ts', "import { x } from '@ui/x';"],
      ['src/adapters/__probe__.ts', "import { x } from '@render/x';"],
      ['src/adapters/__probe__.ts', "import { x } from '@sim/math';"],
      ['src/render/__probe__.ts', "import { x } from '@ui/x';"],
      ['src/render/__probe__.ts', "import { x } from '@content/x';"],
      ['src/ui/__probe__.ts', "import { x } from '@app/main';"],
      ['src/ui/__probe__.ts', "import { x } from '@adapters/mock/account';"],
      ['src/ui/__probe__.ts', "import { createSim } from '@sim';"],
      ['src/ui/__probe__.ts', "import { x } from '../render/x';"],
    ];
    for (const [file, code] of forbidden) {
      expect(await rulesFor(file, code), `${file}: ${code}`).toContain('@typescript-eslint/no-restricted-imports');
    }
    const allowed: [string, string][] = [
      ['src/sim/__probe__.ts', "import { next } from './rng'; export { next };"],
      ['src/sim/radio/__probe__.ts', "import { next } from '../rng'; export { next };"],
      ['src/content/__probe__.ts', "import type { Scenario } from '@sim'; export type { Scenario };"],
      ['src/adapters/mock/terrain/__probe__.ts', "import { x } from '@sim/math'; export { x };"],
      ['src/render/__probe__.ts', "import { createSim } from '@sim'; export { createSim };"],
      ['src/ui/__probe__.ts', "import type { Sim } from '@sim'; import { x } from '@render/x'; import { y } from '@content/y'; import type { Account } from '@adapters/account'; export { x, y }; export type { Sim, Account };"],
      ['src/app/__probe__.ts', "import { a } from '@adapters/mock/account'; import { b } from '@ui/b'; import { c } from '@sim'; export { a, b, c };"],
    ];
    for (const [file, code] of allowed) expect(await rulesFor(file, code), `${file}: ${code}`).toEqual([]);
  });
});
