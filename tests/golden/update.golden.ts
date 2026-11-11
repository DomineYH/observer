// npm run golden:update — writes a golden file only when it is missing or shouldWrite says a version moved up.
import { existsSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { replay, SIM_VERSION, terrainHash } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { GOLDEN_DIR, headerVersions, readGolden, shouldWrite, type Golden, type Versions } from './golden';
import { SCRIPTS } from './scripts';

for (const { file, replay: data } of SCRIPTS) {
  test(`golden:update ${file}`, () => {
    const url = new URL(file, GOLDEN_DIR);
    const terrain = generateTerrain(data.seed);
    const now: Versions = {
      simVersion: SIM_VERSION,
      terrain: { id: terrain.id, version: terrain.version },
      scenario: { id: BASE_SCENARIO.id, version: BASE_SCENARIO.version },
    };
    const old = existsSync(url) ? headerVersions(readGolden(file).replay) : null;
    if (!shouldWrite(old, now)) {
      console.log(`${file}: skip (versions unchanged)`);
      return;
    }
    const golden: Golden = { terrainHash: terrainHash(terrain), replay: data, ...replay(data, terrain, BASE_SCENARIO) };
    writeFileSync(url, JSON.stringify(golden, null, 2) + '\n');
    console.log(`${file}: written for simVersion ${SIM_VERSION}`);
  }, 120000); // ③ replays 48 000 ticks
}
