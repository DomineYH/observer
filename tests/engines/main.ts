// Replayer-only page for the engines job: replays every golden record in this browser and prints the results.
import { replay, type ReplayData } from '@sim';

const goldens = import.meta.glob<{ replay: ReplayData }>('../golden/*.json', { eager: true, import: 'default' });
const out = document.createElement('pre');
try {
  const results: Record<string, unknown> = {};
  for (const [path, golden] of Object.entries(goldens)) results[path.split('/').pop()!] = replay(golden.replay);
  out.id = 'result';
  out.textContent = JSON.stringify(results);
} catch (e) {
  out.id = 'error';
  out.textContent = String(e);
}
document.body.append(out);
