// .github/scripts/ci-time.mjs: the CI 시간 gate reads tool-reported durations from `gh run view --log` text.
import { expect, test } from 'vitest';

type Times = { test: number; engines: number; e2e: number; sum: number };
type CiTime = { runTimes: (log: string) => Times | null; median: (values: number[]) => number; summarize: (runs: Times[]) => Times | null };

const load = async () => (await import(new URL('../../.github/scripts/ci-time.mjs', import.meta.url).href)) as CiTime;

const line = (job: string, text: string) => `${job}\tUNKNOWN STEP\t2026-11-23T08:14:26.4335876Z ${text}`;
// The Duration line as gh prints it (escape shown as ^[) and as a terminal would carry it (raw escape).
const VITEST = [
  line('test', '^[[2m Test Files ^[[22m ^[[1m^[[32m88 passed^[[39m^[[22m^[[90m (88)^[[39m'),
  line('test', '^[[2m   Duration ^[[22m 62.85s^[[2m (tests 93%, import 5%, transform 2%)^[[22m'),
];
const VITEST_RAW = [line('test', '\u001b[2m   Duration \u001b[22m 1.05m\u001b[2m (tests 93%)\u001b[22m')];
const run = (test: number, engines: number, e2e: number): Times => ({ test, engines, e2e, sum: test + engines + e2e });

test('CI 시간: 기록 글에서 vitest의 Duration과 Playwright의 passed (…)를 뽑고 e2e는 조각을 더한다', async () => {
  const { runTimes } = await load();
  const log = [
    ...VITEST,
    line('engines', '  42 passed (1.8m)'),
    line('e2e-shard (11)', '  7 passed (45.2s)'),
    line('e2e-shard (2)', '  5 passed (3.2m)'),
    line('e2e-shard (12)', 'shard 12/12: no tests planned'),
    line('lint', '  9 passed (9.9m)'),
  ].join('\n');
  const times = runTimes(log)!;
  expect(times.test).toBeCloseTo(62.85);
  expect(times.engines).toBeCloseTo(108);
  expect(times.e2e).toBeCloseTo(45.2 + 192);
  expect(times.sum).toBeCloseTo(62.85 + 108 + 45.2 + 192);
  expect(runTimes([...VITEST_RAW, line('engines', '  1 passed (900ms)'), line('e2e-shard (1)', '  1 passed (1.5h)')].join('\n'))).toEqual({ test: 63, engines: 0.9, e2e: 5400, sum: 5463.9 });
});

test('CI 시간: 세 작업 가운데 하나라도 시간을 적지 않은 실행은 쓰지 않는다', async () => {
  const { runTimes } = await load();
  expect(runTimes([...VITEST, line('engines', '  42 passed (1.8m)')].join('\n'))).toBeNull();
  expect(runTimes([line('engines', '  42 passed (1.8m)'), line('e2e-shard (1)', '  1 passed (3.6m)')].join('\n'))).toBeNull();
});

test('CI 시간: 가운데 값은 다섯·네·세 개에서 나오고 두 개면 재지 않는다', async () => {
  const { median, summarize } = await load();
  expect(median([5, 1, 4, 2, 3])).toBe(3);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(median([30, 10, 20])).toBe(20);
  const five = [run(60, 100, 2000), run(62, 110, 2300), run(61, 90, 2100), run(70, 120, 1900), run(59, 105, 2200)];
  expect(summarize(five)).toEqual({ test: 61, engines: 105, e2e: 2100, sum: 2251 });
  expect(summarize(five.slice(0, 4))).toEqual({ test: 61.5, engines: 105, e2e: 2050, sum: 2205.5 });
  expect(summarize(five.slice(0, 3))).toEqual({ test: 61, engines: 100, e2e: 2100, sum: 2251 });
  expect(summarize(five.slice(0, 2))).toBeNull();
});
