// Replayer-only page for the engines job: replays every golden record and evaluates the 결정적 수학 bit output
// table in this browser, and prints the results.
import { replay, type ReplayData } from '@sim';
import { atan2, cos, exp, log, sin, tan } from '@sim/math';
import { evaluate } from '../math/bits';

const goldens = import.meta.glob<{ replay: ReplayData }>('../golden/*.json', { eager: true, import: 'default' });
const out = document.createElement('pre');
const math = document.createElement('pre');
math.id = 'math';
try {
  const results: Record<string, unknown> = {};
  for (const [path, golden] of Object.entries(goldens)) results[path.split('/').pop()!] = replay(golden.replay);
  math.textContent = JSON.stringify(evaluate({ exp, log, sin, cos, tan, atan2 }));
  out.id = 'result';
  out.textContent = JSON.stringify(results);
} catch (e) {
  out.id = 'error';
  out.textContent = String(e);
}
document.body.append(out, math);
