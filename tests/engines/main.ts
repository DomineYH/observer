// Replayer-only page for the engines job: generates each mock golden record's terrain, evaluates the 결정적 수학 bit
// output table in this browser, replays the golden record named by `?golden=<file>` (only that one: ③ alone runs 48 000
// ticks), and prints the results. A golden that names a terrain is fetched and unpacked with the app's own 지형 원천, on
// its own page only.
import { replay, terrainHash, type ReplayData } from '@sim';
import { atan2, cos, exp, log, sin, tan } from '@sim/math';
import { generateTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { placementOf, terrainSourceOf } from '@app/backend';
import { evaluate } from '../math/bits';

const goldens = import.meta.glob<{ replay: ReplayData }>('../golden/*.json', { eager: true, import: 'default' });
const out = document.createElement('pre');
const math = document.createElement('pre');
const terrain = document.createElement('pre');
math.id = 'math';
terrain.id = 'terrain';
try {
  const only = new URLSearchParams(location.search).get('golden');
  const results: Record<string, unknown> = {};
  const hashes: Record<string, string> = {};
  const terrains = new Map<number, ReturnType<typeof generateTerrain>>(); // one per seed
  for (const [path, golden] of Object.entries(goldens)) {
    const file = path.split('/').pop()!;
    const seed = golden.replay.seed;
    const real = golden.replay.terrain; // the one real land: the replayer refuses another id or 판
    if (real && file !== only) continue;
    if (!real && !terrains.has(seed)) terrains.set(seed, generateTerrain(seed));
    const t = real ? await terrainSourceOf('real').load(seed) : terrains.get(seed)!;
    hashes[file] = terrainHash(t);
    if (file === only) results[file] = replay(golden.replay, t, real ? placementOf('real').scenario : BASE_SCENARIO);
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
