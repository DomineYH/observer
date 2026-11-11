import { describe, expect, test } from 'vitest';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('../..', import.meta.url).pathname });

/** Rule ids reported for `code` as if it lived at `filePath`. */
async function rulesFor(filePath: string, code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((m) => m.ruleId);
}

const BANNED: [string, string][] = [
  ['Math.random()', 'no-restricted-syntax'],
  ['Math.sin(1)', 'no-restricted-syntax'],
  ['Math.cos(1)', 'no-restricted-syntax'],
  ['Math.tan(1)', 'no-restricted-syntax'],
  ['Math.atan2(1, 2)', 'no-restricted-syntax'],
  ['Math.exp(1)', 'no-restricted-syntax'],
  ['Math.log(2)', 'no-restricted-syntax'],
  ['Math.pow(2, 3)', 'no-restricted-syntax'],
  ['Math.hypot(3, 4)', 'no-restricted-syntax'],
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
  // Key-order iteration, not only for...in.
  ['const x = { a: 1 }; for (const k of Object.keys(x)) k', 'no-restricted-syntax'],
  ['Object.values({ a: 1 }).reduce((s, v) => s + v, 0)', 'no-restricted-syntax'],
  ['const e = [...Object.entries({})]; e', 'no-restricted-syntax'],
  ['Object.getOwnPropertyNames({}).forEach(() => 0)', 'no-restricted-syntax'],
  ['Reflect.ownKeys({}).map(String)', 'no-restricted-syntax'],
  ['const O = Object; O.keys({})', 'no-restricted-syntax'],
  // Math through an alias, destructuring or a computed member.
  ['const m = Math; m.random()', 'no-restricted-syntax'],
  ['const { random } = Math; random()', 'no-restricted-syntax'],
  ["const k = 'random'; Math[k]()", 'no-restricted-syntax'],
  // Math is an allowlist: any member outside it is banned, including ones that hand out Math itself.
  ['const m = Math.valueOf() as unknown as { random(): number }; m.random()', 'no-restricted-syntax'],
  ['Math.hypot(1, 2)', 'no-restricted-syntax'],
];

describe('린트', () => {
  test('린트: 금지 규칙 자기 검사', async () => {
    for (const [code, rule] of BANNED) {
      expect(await rulesFor('src/sim/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      // The mock terrain generator follows the same bans.
      expect(await rulesFor('src/adapters/mock/terrain/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      // So does the 지형 파일 code it shares the cell hash with.
      expect(await rulesFor('src/adapters/terrainFile/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      // Outside the simulation the same code is allowed.
      expect(await rulesFor('src/app/__probe__.ts', `export {}; ${code};`), code).not.toContain(rule);
    }
    const allowed = [
      'export const f = (a: number) => Math.imul(a, 3) + Math.sqrt(a) + Math.floor(a) + Math.fround(a) + Math.PI;',
      'export const g = (a: number) => Math.ceil(a) + Math.round(a) + Math.trunc(a) + Math.abs(a) + Math.min(a, 1) + Math.max(a, 1) + Math.sign(a) + Math.clz32(a);',
      // Counting keys does not depend on their order.
      'export const n = (x: object) => Object.keys(x).length + (Object.hasOwn(x, "a") ? 1 : 0);',
    ];
    for (const code of allowed) expect(await rulesFor('src/sim/__probe__.ts', code), code).toEqual([]);
  }, 30000);

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
      // Non-normalised or deep relative paths that leave the module.
      ['src/sim/__probe__.ts', "import { x } from '.././content/scenario';"],
      ['src/sim/__probe__.ts', "import { x } from '../../src/content/scenario';"],
      ['src/sim/__probe__.ts', "import { x } from './sub/../../content/scenario';"],
      ['src/sim/sub/__probe__.ts', "import { x } from '../../content/scenario';"],
      ['src/sim/sub/deep/__probe__.ts', "import { x } from '../../../app/main';"],
      ['src/ui/sub/__probe__.ts', "import { x } from '../../app/main';"],
      ['src/ui/__probe__.ts', "import type { X } from '@sim/../app/main';"],
      // render depends on sim only; content and adapters on sim types only.
      ['src/render/__probe__.ts', "import { readFile } from 'node:fs';"],
      ['src/render/__probe__.ts', "import { useState } from 'react';"],
      ['src/content/__probe__.ts', "import { useState } from 'react';"],
      ['src/adapters/__probe__.ts', "import { readFile } from 'node:fs';"],
      ['src/adapters/mock/terrain/__probe__.ts', "import { next } from '@sim/rng';"],
    ];
    for (const [file, code] of forbidden) {
      expect(await rulesFor(file, code), `${file}: ${code}`).toContain('@typescript-eslint/no-restricted-imports');
    }
    const allowed: [string, string][] = [
      ['src/sim/__probe__.ts', "import { next } from './rng'; export { next };"],
      ['src/sim/radio/__probe__.ts', "import { next } from '../rng'; export { next };"],
      ['src/content/__probe__.ts', "import type { Scenario } from '@sim'; export type { Scenario };"],
      ['src/adapters/mock/terrain/__probe__.ts', "import { x } from '@sim/math'; export { x };"],
      ['src/render/__probe__.ts', "import { createSim } from '@sim'; import type { Sim } from '@sim'; import { y } from './y'; export { createSim, y }; export type { Sim };"],
      ['src/render/sub/__probe__.ts', "import { y } from '../y'; export { y };"],
      ['src/sim/sub/deep/__probe__.ts', "import { next } from '../../rng'; export { next };"],
      ['src/ui/__probe__.ts', "import type { Sim } from '@sim'; import { x } from '@render/x'; import { y } from '@content/y'; import type { Account } from '@adapters/account'; import { useState } from 'react'; export { x, y, useState }; export type { Sim, Account };"],
      ['src/app/__probe__.ts', "import { a } from '@adapters/mock/account'; import { b } from '@ui/b'; import { c } from '@sim'; export { a, b, c };"],
    ];
    for (const [file, code] of allowed) expect(await rulesFor(file, code), `${file}: ${code}`).toEqual([]);
  });

  test('린트: 앱 소스는 지형 가공 폴더를 가져오지 않는다', async () => {
    const PACK = 'terrain/pipeline/rules/pack';
    const forbidden: [string, string][] = [
      ...['sim', 'content', 'adapters', 'render', 'ui', 'app'].map((m): [string, string] => [`src/${m}/__probe__.ts`, `import { packTerrain } from '../../${PACK}';`]),
      ['src/ui/__probe__.ts', `import type { X } from '../../${PACK}';`],
      ...['app', 'ui'].flatMap((m) =>
        [PACK, `@${PACK}`, `/${PACK}`].map((path): [string, string] => [`src/${m}/__probe__.ts`, `import { packTerrain } from '${path}';`]),
      ),
    ];
    for (const [file, code] of forbidden) {
      expect(await rulesFor(file, code), `${file}: ${code}`).toContain('@typescript-eslint/no-restricted-imports');
    }
    // The processing side reuses the app's 풀기, 지형 해시 and 피복 목록 instead of a second copy.
    const reuse = "import { COVER, terrainHash } from '@sim'; import { unpackTerrain } from '@adapters/terrainFile/unpack'; export { COVER, terrainHash, unpackTerrain };";
    expect(await rulesFor('terrain/pipeline/rules/__probe__.ts', reuse)).toEqual([]);
  });

  test('린트: 가공 규칙 코드의 결정성 묶음', async () => {
    for (const [code, rule] of BANNED) {
      expect(await rulesFor('terrain/pipeline/rules/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      expect(await rulesFor('terrain/pipeline/rules/sub/__probe__.ts', `export {}; ${code};`), code).toContain(rule);
      // The fetch stage beside the rules needs network, clocks and trigonometry.
      expect(await rulesFor('terrain/pipeline/__probe__.ts', `export {}; ${code};`), code).not.toContain(rule);
    }
  }, 30000);

  test('린트: 지형 가공 폴더는 시나리오를 가져오지 않는다', async () => {
    const forbidden: [string, string][] = [
      ['terrain/pipeline/rules/__probe__.ts', "import { BASE_SCENARIO } from '@content/scenario';"],
      ['terrain/pipeline/rules/__probe__.ts', "import { BASE_SCENARIO } from '../../../src/content/scenario';"],
      ['terrain/pipeline/__probe__.ts', "import type { X } from '../../src/content/scenario';"],
      ['terrain/__probe__.ts', "import { BASE_SCENARIO } from '@content';"],
    ];
    for (const [file, code] of forbidden) {
      expect(await rulesFor(file, code), `${file}: ${code}`).toContain('@typescript-eslint/no-restricted-imports');
    }
  });

  test('F-31: 저장된 문자열은 글자로 보인다 — 화면에 HTML을 직접 넣지 않는다', async () => {
    const raw = [
      'export const X = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;',
      'export const f = (el: HTMLElement) => { el.innerHTML = "x"; };',
      'export const f = (el: HTMLElement) => { el.outerHTML = "x"; };',
      'export const f = (el: HTMLElement) => el.insertAdjacentHTML("beforeend", "x");',
    ];
    for (const code of raw)
      for (const file of ['src/ui/__probe__.tsx', 'src/app/__probe__.tsx']) expect(await rulesFor(file, code), `${file}: ${code}`).toContain('no-restricted-syntax');
    expect(await rulesFor('src/ui/__probe__.tsx', 'export const X = ({ s }: { s: string }) => <b>{s}</b>;')).toEqual([]);
  });
});
