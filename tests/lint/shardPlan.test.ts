// .github/scripts/shard-plan.mjs: e2e shards balanced by measured duration (tests/smoke/durations.json).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

type Spec = { title: string; file: string; line: number; tests: { projectName: string }[] };
type Suite = { title: string; file: string; line: number; specs: Spec[]; suites?: Suite[] };
type List = { config: { rootDir: string; configFile: string }; suites: Suite[]; errors: unknown[] };
type Shard = { seconds: number; tests: { id: string; arg: string; seconds: number }[] };
type PlanShards = (list: List, durations: Record<string, number>, count: number) => Shard[];

const ROOT = new URL('../../', import.meta.url).pathname;
const load = async () =>
  (await import(new URL('../../.github/scripts/shard-plan.mjs', import.meta.url).href)) as { planShards: PlanShards };

const spec = (file: string, line: number, title: string, project = 'chromium'): Spec => ({ title, file, line, tests: [{ projectName: project }] });
const fileSuite = (file: string, specs: Spec[], suites: Suite[] = []): Suite => ({ title: file, file, line: 0, specs, suites });
const listOf = (suites: Suite[]): List => ({ config: { rootDir: '/repo/tests/smoke', configFile: '/repo/playwright.e2e.config.ts' }, suites, errors: [] });
const ids = (plan: Shard[]) => plan.flatMap((s) => s.tests.map((t) => t.id));

// About 20 specs: one inside a describe, one on the real project, one with no duration.
const SYNTH = listOf([
  fileSuite('a.spec.ts', Array.from({ length: 9 }, (_, i) => spec('a.spec.ts', 10 * (i + 1), `a${i}`)), [
    { title: '묶음', file: 'a.spec.ts', line: 200, specs: [spec('a.spec.ts', 203, '안쪽')] },
  ]),
  fileSuite('b.spec.ts', Array.from({ length: 8 }, (_, i) => spec('b.spec.ts', 5 * (i + 1), `b${i}`))),
  fileSuite('real.spec.ts', [spec('real.spec.ts', 12, '스모크: real 빌드', 'real')]),
  fileSuite('c.spec.ts', [spec('c.spec.ts', 3, '모름')]),
]);
const SYNTH_DUR: Record<string, number> = { 'a.spec.ts › 묶음 › 안쪽': 50, 'real.spec.ts › 스모크: real 빌드': 1, 'gone.spec.ts › 낡은 키': 999 };
for (let i = 0; i < 9; i++) SYNTH_DUR[`a.spec.ts › a${i}`] = 3 * i + 1;
for (let i = 0; i < 8; i++) SYNTH_DUR[`b.spec.ts › b${i}`] = 7 * i + 2;
const SYNTH_IDS = [
  ...Array.from({ length: 9 }, (_, i) => `a.spec.ts › a${i}`),
  'a.spec.ts › 묶음 › 안쪽',
  ...Array.from({ length: 8 }, (_, i) => `b.spec.ts › b${i}`),
  'real.spec.ts › 스모크: real 빌드',
  'c.spec.ts › 모름',
];

test('every listed spec lands in exactly one shard, as tests/smoke/<file>:<line>', async () => {
  const { planShards } = await load();
  for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 30]) {
    const plan = planShards(SYNTH, SYNTH_DUR, count);
    expect(plan).toHaveLength(count);
    expect(ids(plan).sort()).toEqual([...SYNTH_IDS].sort());
  }
  const args = planShards(SYNTH, SYNTH_DUR, 1)[0]!.tests.map((t) => t.arg);
  expect(args).toContain('tests/smoke/a.spec.ts:203');
  expect(args).toContain('tests/smoke/real.spec.ts:12');
  expect(args.every((a) => /^tests\/smoke\/[a-z.]+:\d+$/.test(a))).toBe(true);
});

test('the plan does not depend on suite or duration-key order', async () => {
  const { planShards } = await load();
  const reordered = listOf([...SYNTH.suites].reverse().map((s) => ({ ...s, specs: [...s.specs].reverse() })));
  const durReordered = Object.fromEntries(Object.entries(SYNTH_DUR).reverse());
  const plan = planShards(SYNTH, SYNTH_DUR, 4);
  expect(planShards(SYNTH, SYNTH_DUR, 4)).toEqual(plan);
  expect(planShards(reordered, durReordered, 4)).toEqual(plan);
});

test('a spec with no duration is planned at the median of the known ones', async () => {
  const { planShards } = await load();
  const list = listOf([fileSuite('m.spec.ts', ['a', 'b', 'c', 'd'].map((t, i) => spec('m.spec.ts', i + 1, t)))]);
  const plan = planShards(list, { 'm.spec.ts › a': 10, 'm.spec.ts › b': 20, 'm.spec.ts › c': 30 }, 2);
  expect(plan.map((s) => s.seconds)).toEqual([40, 40]);
  expect(plan.map((s) => s.tests.map((t) => t.id))).toEqual([
    ['m.spec.ts › c', 'm.spec.ts › a'],
    ['m.spec.ts › b', 'm.spec.ts › d'],
  ]);
});

test('longest first, each to the least loaded shard', async () => {
  const { planShards } = await load();
  const list = listOf([fileSuite('l.spec.ts', [8, 7, 6, 5, 4].map((s) => spec('l.spec.ts', s, `t${s}`)))]);
  const plan = planShards(list, Object.fromEntries([8, 7, 6, 5, 4].map((s) => [`l.spec.ts › t${s}`, s])), 2);
  expect(plan.map((s) => s.tests.map((t) => t.seconds))).toEqual([[8, 5, 4], [7, 6]]);
  expect(plan.map((s) => s.seconds)).toEqual([17, 13]);
});

test('ambiguous run arguments throw', async () => {
  const { planShards } = await load();
  const twice = listOf([fileSuite('d.spec.ts', [spec('d.spec.ts', 1, 'x'), spec('d.spec.ts', 2, 'x')])]);
  expect(() => planShards(twice, {}, 2)).toThrow(/duplicate id/);
  const sameLine = listOf([fileSuite('d.spec.ts', [spec('d.spec.ts', 1, 'x'), spec('d.spec.ts', 1, 'y')])]);
  expect(() => planShards(sameLine, {}, 2)).toThrow(/duplicate file:line/);
  const onDescribe = listOf([fileSuite('d.spec.ts', [spec('d.spec.ts', 5, 'x')], [{ title: 'g', file: 'd.spec.ts', line: 5, specs: [spec('d.spec.ts', 6, 'y')] }])]);
  expect(() => planShards(onDescribe, {}, 2)).toThrow(/describe line/);
});

test('real --list: 8 shards cover every spec once, and durations.json knows nearly all of them', { timeout: 60_000 }, async () => {
  const { planShards } = await load();
  const out = execFileSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.e2e.config.ts', '--list', '--reporter=json'], { cwd: ROOT, maxBuffer: 16 << 20 });
  const list = JSON.parse(out.toString()) as List;
  const durations = JSON.parse(readFileSync(`${ROOT}tests/smoke/durations.json`, 'utf8')) as Record<string, number>;
  const listed = planShards(list, durations, 1)[0]!.tests.map((t) => t.id);
  expect(listed.length).toBeGreaterThan(0);
  expect(ids(planShards(list, durations, 8)).sort()).toEqual([...listed].sort());
  const missing = listed.filter((id) => !(id in durations));
  expect(missing.length <= listed.length * 0.1, `no duration for: ${missing.join(', ')}`).toBe(true);
});
