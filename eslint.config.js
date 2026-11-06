// Built-in rules and typescript-eslint only (spec: no other plugins). Not type-aware, so the lint self-check can lint virtual files.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const DETERMINISM = '결정성 (ADR 0005): 시뮬레이션에서 금지';
const NONDETERMINISTIC_MATH = [
  'random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot',
];
const IMPURE_GLOBALS = [
  'Date', 'performance', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask', 'window', 'document', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'self', 'globalThis', 'crypto', 'fetch', 'process', 'speechSynthesis', 'Intl',
];

const determinism = {
  'no-restricted-properties': ['error', ...NONDETERMINISTIC_MATH.map((property) => ({ object: 'Math', property, message: `${DETERMINISM} (결정적 수학을 쓴다)` }))],
  'no-restricted-globals': ['error', ...IMPURE_GLOBALS.map((name) => ({ name, message: `${DETERMINISM} (화면·시계·외부 상태)` }))],
  'no-restricted-syntax': [
    'error',
    { selector: "BinaryExpression[operator='**']", message: `${DETERMINISM} (거듭제곱 연산자)` },
    { selector: "AssignmentExpression[operator='**=']", message: `${DETERMINISM} (거듭제곱 연산자)` },
    { selector: 'ForInStatement', message: `${DETERMINISM} (키 순회 반복문)` },
  ],
};

// Module dependency limits (spec 모듈 table). Every module also gets the alias rule, because a later
// config object replaces a rule's options instead of merging them.
const ban = (regex, message, allowTypeImports = false) => ({ regex, message, allowTypeImports });
const VIA_ALIAS = ban('^(\\.\\./)+(sim|content|adapters|render|ui|app)(/|$)', '다른 모듈은 별칭(@sim 등)으로 가져온다');
const SIM_TYPES_ONLY = ban('^@sim(/|$)', '이 모듈은 sim의 타입만 쓴다 (import type)', true);
const ONLY_SIM = ban('^(?!\\.|@sim(/|$))', '이 모듈은 sim의 타입에만 의존한다');
const imports = (...patterns) => ({ '@typescript-eslint/no-restricted-imports': ['error', { patterns: [VIA_ALIAS, ...patterns] }] });

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { files: ['src/**'], rules: imports() },
  {
    files: ['src/sim/**'],
    rules: { ...determinism, ...imports(ban('^(?!\\.)', 'sim은 자기 자신에만 의존한다')) },
  },
  { files: ['src/content/**', 'src/adapters/**'], rules: imports(SIM_TYPES_ONLY, ONLY_SIM) },
  {
    // The mock terrain generator replays on the server: same bans as sim, and it may use sim's deterministic math.
    files: ['src/adapters/mock/terrain/**'],
    rules: { ...determinism, ...imports(ban('^@sim(?!/math$)(/|$)', 'sim에서는 결정적 수학만 값으로 쓴다', true), ONLY_SIM) },
  },
  { files: ['src/render/**'], rules: imports(ban('^@(content|adapters|ui|app)(/|$)', 'render는 sim에만 의존한다')) },
  {
    files: ['src/ui/**'],
    rules: imports(
      SIM_TYPES_ONLY,
      ban('^@app(/|$)', 'ui는 조립 지점에 의존하지 않는다'),
      ban('^@adapters/mock(/|$)', 'ui는 어댑터 인터페이스만 쓰고 구체 어댑터는 주입받는다'),
    ),
  },
  // Unit tests next to the source may import the test runner and fixtures; the determinism bans still apply.
  { files: ['src/**/*.test.{ts,tsx}'], rules: imports() },
  { files: ['**/*.js'], languageOptions: { globals: { URL: 'readonly' } } },
);
