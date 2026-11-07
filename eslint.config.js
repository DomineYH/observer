// Built-in rules and typescript-eslint only (spec: no other plugins). Not type-aware, so the lint self-check can lint virtual files.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const DETERMINISM = '결정성 (ADR 0005): 시뮬레이션에서 금지';
// Math is an allowlist: exactly rounded or integer operations only (the rest come from 결정적 수학).
const DETERMINISTIC_MATH = ['imul', 'sqrt', 'fround', 'floor', 'ceil', 'round', 'trunc', 'abs', 'min', 'max', 'sign', 'clz32', 'PI'];
const IMPURE_GLOBALS = [
  'Date', 'performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask', 'window', 'document', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'self', 'globalThis', 'crypto', 'fetch', 'process', 'speechSynthesis', 'Intl',
];

const determinism = {
  'no-restricted-globals': ['error', ...IMPURE_GLOBALS.map((name) => ({ name, message: `${DETERMINISM} (화면·시계·외부 상태)` }))],
  'no-restricted-syntax': [
    'error',
    {
      selector: `MemberExpression[object.name='Math']:not([property.name=/^(${DETERMINISTIC_MATH.join('|')})$/])`,
      message: `${DETERMINISM} (Math는 ${DETERMINISTIC_MATH.join('·')}만. 나머지는 결정적 수학을 쓴다)`,
    },
    { selector: "BinaryExpression[operator='**']", message: `${DETERMINISM} (거듭제곱 연산자)` },
    { selector: "AssignmentExpression[operator='**=']", message: `${DETERMINISM} (거듭제곱 연산자)` },
    { selector: 'ForInStatement', message: `${DETERMINISM} (키 순회 반복문)` },
    {
      // Key lists come out in insertion order; only their length is order-free.
      selector:
        "CallExpression[callee.object.name=/^(Object|Reflect)$/][callee.property.name=/^(keys|values|entries|getOwnPropertyNames|getOwnPropertySymbols|ownKeys)$/]:not(MemberExpression[property.name='length'] > CallExpression.object)",
      message: `${DETERMINISM} (키 순서 순회. 정해진 순서의 배열을 쓴다)`,
    },
    {
      // Aliases and destructuring would slip past the member checks.
      selector: 'Identifier[name=/^(Math|Object|Reflect)$/]:not(MemberExpression > Identifier.object)',
      message: `${DETERMINISM} (Math·Object·Reflect는 멤버로만 쓴다)`,
    },
    {
      selector: 'MemberExpression[object.name=/^(Math|Object|Reflect)$/][computed=true]',
      message: `${DETERMINISM} (Math·Object·Reflect의 계산된 멤버)`,
    },
  ],
};

// Module dependency limits (spec 모듈 table). A later config object replaces a rule's options instead of
// merging them, so each object carries the full pattern list.
const ban = (regex, message, allowTypeImports = false) => ({ regex, message, allowTypeImports });
const NORMALISED = [
  ban('^(?=\\.)(?!(?:\\./|(?:\\.\\./)+)[^./][^/]*(?:/[^./][^/]*)*$)', '상대 경로는 정규화해서 쓴다 (./x 또는 ../x)'),
  ban('^[^.].*/\\.\\.?(?:/|$)', '경로에 . 또는 .. 마디를 넣지 않는다'),
];
// A matching allowTypeImports pattern exempts a type import from every pattern, so it must not match dot segments.
const NO_DOTS = '(?!.*/\\.\\.?(?:/|$))';
const SIM_TYPES_ONLY = ban(`^@sim${NO_DOTS}(/|$)`, '이 모듈은 sim의 타입만 쓴다 (import type)', true);
const ONLY_SIM = ban('^(?!\\.|@sim(/|$))', '이 모듈은 sim의 타입에만 의존한다');
const imports = (...patterns) => ({ '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...NORMALISED, ...patterns] }] });

// One config object per directory depth below the module root: a relative import may climb at most to that root.
// ponytail: files deeper than MAX_DEPTH may not climb at all; raise MAX_DEPTH if a module ever nests deeper.
const MAX_DEPTH = 3;
const LEAVES_MODULE = '모듈 밖은 별칭(@sim 등)으로 가져온다';
function moduleImports(root, patterns, sub = '') {
  const subDepth = sub ? sub.split('/').length : 0;
  const objects = [];
  for (let d = subDepth; d <= MAX_DEPTH; d++) {
    const glob = `${root}/${sub ? sub + '/' : ''}${'*/'.repeat(d - subDepth)}*`;
    objects.push({ files: [glob], rules: imports(...patterns, ban(`^(?:\\.\\./){${d + 1}}`, LEAVES_MODULE)) });
  }
  const deeper = `${root}/${sub ? sub + '/' : ''}${'*/'.repeat(MAX_DEPTH + 1 - subDepth)}**`;
  objects.push({ files: [deeper], rules: imports(...patterns, ban('^\\.\\./', LEAVES_MODULE)) });
  return objects;
}

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  ...moduleImports('src/sim', [ban('^(?!\\.)', 'sim은 자기 자신에만 의존한다')]),
  ...moduleImports('src/content', [SIM_TYPES_ONLY, ONLY_SIM]),
  ...moduleImports('src/adapters', [SIM_TYPES_ONLY, ONLY_SIM]),
  // The mock terrain generator replays on the server: it may use sim's deterministic math as values.
  ...moduleImports('src/adapters', [ban(`^@sim${NO_DOTS}(?!/math$)(/|$)`, 'sim에서는 결정적 수학만 값으로 쓴다', true), ONLY_SIM], 'mock/terrain'),
  ...moduleImports('src/render', [ban('^(?!\\.|@sim(/|$))', 'render는 sim에만 의존한다')]),
  ...moduleImports('src/ui', [
    SIM_TYPES_ONLY,
    ban('^@app(/|$)', 'ui는 조립 지점에 의존하지 않는다'),
    ban('^@adapters/mock(/|$)', 'ui는 어댑터 인터페이스만 쓰고 구체 어댑터는 주입받는다'),
  ]),
  ...moduleImports('src/app', []),
  // Determinism bans: the simulation and the mock terrain generator (same rules, ADR 0002).
  { files: ['src/sim/**', 'src/adapters/mock/terrain/**'], rules: determinism },
  // Unit tests next to the source may import the test runner and fixtures; the determinism bans still apply.
  { files: ['src/**/*.test.{ts,tsx}'], rules: imports() },
  { files: ['**/*.js'], languageOptions: { globals: { URL: 'readonly' } } },
);
