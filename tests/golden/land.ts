// The land a golden is replayed on, picked by its header's `terrain`: none → the mock land from the seed (as before),
// one → the committed 지형 파일 unpacked in Node. No existence check: a missing file throws and the golden fails.
// Kept out of golden.ts, which the engines spec loads under Playwright.
import { readFileSync } from 'node:fs';
import type { ReplayData, Scenario, TerrainData } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { BASE_SCENARIO } from '@content/scenario';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';

export const REAL_TERRAIN_FILE = 'src/adapters/realTerrain/mungyeong/terrain.bin';

/** Another id or 판 than the file's is refused by the replayer, so the one real land needs no lookup. */
export async function landOf(d: ReplayData): Promise<{ terrain: TerrainData; scenario: Scenario }> {
  if (!d.terrain) return { terrain: generateTerrain(d.seed), scenario: BASE_SCENARIO };
  return { terrain: await unpackTerrain(new Uint8Array(readFileSync(REAL_TERRAIN_FILE))), scenario: MUNGYEONG_PLACEMENT.scenario };
}
