// CI 시간 (M4 관문 +60초): the time the test tools report, not job wall-clock. Per run: test (vitest Duration) +
// engines (Playwright "N passed (…)") + e2e (sum over shards). Median over the latest five successful main runs.
// Usage: node .github/scripts/ci-time.mjs   (needs gh; not a required check, never runs in CI)
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const UNIT_SECONDS = { ms: 0.001, s: 1, m: 60, h: 3600 };
const AMOUNT = '([\\d.]+)(ms|s|m|h)\\b';
const VITEST = new RegExp(`Duration\\s+${AMOUNT}`);
const PLAYWRIGHT = new RegExp(`\\d+ passed \\(${AMOUNT}\\)`);
// Colour codes: gh prints the escape as the two characters ^[ in a saved log. The raw escape is built from its char code (no-control-regex).
const ANSI = new RegExp(`(?:${String.fromCharCode(27)}|\\^\\[)\\[[\\d;]*m`, 'g');

const secondsIn = (line, pattern) => {
  const m = pattern.exec(line);
  return m ? Number(m[1]) * UNIT_SECONDS[m[2]] : null;
};

/** The three tool-reported times of one run's log (`gh run view --log`: job name, tab, step, tab, text), or null when a job reported none. */
export function runTimes(log) {
  const found = { test: [], engines: [], e2e: [] };
  for (const raw of log.split('\n')) {
    const job = raw.slice(0, raw.indexOf('\t'));
    const line = raw.replace(ANSI, '');
    if (job === 'test') found.test.push(secondsIn(line, VITEST));
    else if (job === 'engines') found.engines.push(secondsIn(line, PLAYWRIGHT));
    else if (job.startsWith('e2e-shard')) found.e2e.push(secondsIn(line, PLAYWRIGHT));
  }
  const sum = (key) => found[key].filter((s) => s !== null);
  const [test, engines, e2e] = [sum('test'), sum('engines'), sum('e2e')];
  if (!test.length || !engines.length || !e2e.length) return null;
  const total = (xs) => xs.reduce((a, b) => a + b, 0);
  return { test: total(test), engines: total(engines), e2e: total(e2e), sum: total(test) + total(engines) + total(e2e) };
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Medians of the three values and of the sum, or null under three runs (재지 않는다). */
export function summarize(runs) {
  if (runs.length < 3) return null;
  return Object.fromEntries(['test', 'engines', 'e2e', 'sum'].map((key) => [key, median(runs.map((r) => r[key]))]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  const listed = JSON.parse(gh('run', 'list', '--branch', 'main', '--workflow', 'ci', '--status', 'success', '--limit', '30', '--json', 'databaseId,number,headSha'));
  const runs = [];
  for (const run of listed) {
    if (runs.length === 5) break;
    const times = runTimes(gh('run', 'view', String(run.databaseId), '--log'));
    if (times) runs.push({ ...run, ...times });
  }
  const row = (label, t) => `${label}\t${t.test.toFixed(1)}\t${t.engines.toFixed(1)}\t${t.e2e.toFixed(1)}\t${t.sum.toFixed(1)}\n`;
  process.stdout.write('run\ttest\tengines\te2e\tsum (seconds)\n');
  for (const r of runs) process.stdout.write(row(`#${r.number} ${r.headSha.slice(0, 7)}`, r));
  const summary = summarize(runs);
  if (!summary) {
    process.stderr.write(`ci-time: 재지 않는다 (세 작업이 모두 돈 성공 실행 ${runs.length}개, 셋보다 적다)\n`);
    process.exit(1);
  }
  process.stdout.write(row(`가운데 값 (${runs.length}개)`, summary));
}
