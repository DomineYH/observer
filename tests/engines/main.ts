// Replayer-only page for the engines job: generates each golden record's terrain, replays the record, evaluates the
// 결정적 수학 bit output table in this browser, and prints the results.
import { replay, terrainHash, type ReplayData } from '@sim';
import { atan2, cos, exp, log, sin, tan } from '@sim/math';
import { generateTerrain } from '@adapters/mock/terrain';
import { evaluate } from '../math/bits';

const goldens = import.meta.glob<{ replay: ReplayData }>('../golden/*.json', { eager: true, import: 'default' });
const out = document.createElement('pre');
const math = document.createElement('pre');
const terrain = document.createElement('pre');
math.id = 'math';
terrain.id = 'terrain';
try {
  const results: Record<string, unknown> = {};
  const hashes: Record<string, string> = {};
  for (const [path, golden] of Object.entries(goldens)) {
    const file = path.split('/').pop()!;
    const t = generateTerrain(golden.replay.seed);
    hashes[file] = terrainHash(t);
    results[file] = replay(golden.replay, t);
  }
  math.textContent = JSON.stringify(evaluate({ exp, log, sin, cos, tan, atan2 }));
  terrain.textContent = JSON.stringify(hashes);
  out.id = 'result';
  out.textContent = JSON.stringify(results);
} catch (e) {
  out.id = 'error';
  out.textContent = String(e);
}
document.body.append(out, math, terrain);
