// The land a golden is replayed on, picked by its header's `terrain`: none → the mock land from the seed (as before),
// one → the committed 지형 파일 unpacked in Node. No existence check: a missing file throws and the golden fails.
// Kept out of golden.ts, which the engines spec loads under Playwright.
import { readFileSync } from 'node:fs';
import type { ReplayData, Scenario, TerrainData } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { contentOf } from '@content/lookup';

export const REAL_TERRAIN_FILE = 'src/adapters/realTerrain/mungyeong/terrain.bin';

/** The land a header names. Another id or 판 than the file's is refused by the replayer, so the one real land needs no lookup. */
export const terrainOf = async (d: ReplayData): Promise<TerrainData> =>
  d.terrain ? unpackTerrain(new Uint8Array(readFileSync(REAL_TERRAIN_FILE))) : generateTerrain(d.seed);

/** The land and the scenario a golden header names (찾기 함수: an unknown id or another version throws). */
export async function landOf(d: ReplayData): Promise<{ terrain: TerrainData; scenario: Scenario }> {
  return { terrain: await terrainOf(d), scenario: contentOf(d).scenario };
}
