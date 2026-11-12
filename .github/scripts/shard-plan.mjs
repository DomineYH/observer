// Splits the e2e specs into shards of about equal measured time (tests/smoke/durations.json), longest first.
// Usage: node shard-plan.mjs <list.json> <durations.json> <index> <count>  (list.json = playwright --list --reporter=json)
import { readFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Playwright reads the file part of file:line as a regex; /…/ keeps it case-sensitive, escaped and anchored to one path.
const exactFile = (path) => `/(^|\\/)${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$/`;

// One entry per spec: id = file › describe titles › title (no line, no project); arg = exactFile(<testDir>/<file>):<line>.
// Throws when an arg would select more than its spec: two specs on one line, or a spec on a describe line (selects the whole group).
function specsOf(list) {
  const prefix = relative(dirname(list.config.configFile), list.config.rootDir);
  const specs = [];
  const describeLines = new Set();
  const walk = (suite, titles) => {
    for (const s of suite.specs) specs.push({ id: [s.file, ...titles, s.title].join(' › '), arg: `${exactFile(`${prefix}/${s.file}`)}:${s.line}` });
    for (const child of suite.suites ?? []) {
      describeLines.add(`${exactFile(`${prefix}/${child.file}`)}:${child.line}`);
      walk(child, [...titles, child.title]);
    }
  };
  for (const file of list.suites) walk(file, []);
  const ids = new Set();
  const args = new Set();
  for (const s of specs) {
    if (ids.has(s.id)) throw new Error(`shard-plan: duplicate id ${s.id}`);
    if (args.has(s.arg)) throw new Error(`shard-plan: duplicate file:line ${s.arg}`);
    if (describeLines.has(s.arg)) throw new Error(`shard-plan: ${s.id} sits on a describe line (${s.arg})`);
    ids.add(s.id);
    args.add(s.arg);
  }
  return specs;
}

export function planShards(list, durations, count) {
  const specs = specsOf(list);
  const known = specs.filter((s) => s.id in durations).map((s) => durations[s.id]).sort((a, b) => a - b);
  const fallback = known.length ? known[Math.floor(known.length / 2)] : 1;
  const timed = specs.map((s) => ({ ...s, seconds: s.id in durations ? durations[s.id] : fallback }));
  timed.sort((a, b) => b.seconds - a.seconds || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shards = Array.from({ length: count }, () => ({ seconds: 0, tests: [] }));
  for (const t of timed) {
    const least = shards.reduce((best, s, i) => (s.seconds < shards[best].seconds ? i : best), 0);
    shards[least].seconds += t.seconds;
    shards[least].tests.push(t);
  }
  return shards;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [listPath, durationsPath, index, count] = process.argv.slice(2);
  const list = JSON.parse(readFileSync(listPath, 'utf8'));
  if (list.errors.length || !specsOf(list).length) {
    process.stderr.write(`shard-plan: --list reported ${list.errors.length} errors and ${specsOf(list).length} specs\n`);
    process.exit(1);
  }
  const shard = planShards(list, JSON.parse(readFileSync(durationsPath, 'utf8')), Number(count))[Number(index) - 1];
  if (!shard) {
    process.stderr.write(`shard-plan: no shard ${index} of ${count}\n`);
    process.exit(1);
  }
  process.stdout.write(shard.tests.map((t) => t.arg + '\n').join(''));
  process.stderr.write(`shard ${index}/${count}: ${shard.tests.length} tests, planned ${Math.round(shard.seconds)}s\n`);
}
