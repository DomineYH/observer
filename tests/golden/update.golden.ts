// npm run golden:update — writes a golden file only when it is missing or this code's SIM_VERSION is newer.
import { existsSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { replay, SIM_VERSION, terrainHash } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { GOLDEN_DIR, readGolden, type Golden } from './golden';
import { SCRIPTS } from './scripts';

for (const { file, replay: data } of SCRIPTS) {
  test(`golden:update ${file}`, () => {
    const url = new URL(file, GOLDEN_DIR);
    if (existsSync(url)) {
      const old = readGolden(file).replay.simVersion;
      if (SIM_VERSION < old) throw new Error(`${file}: golden simVersion ${old} is newer than code ${SIM_VERSION}`);
      if (SIM_VERSION === old) {
        console.log(`${file}: skip (simVersion ${old} unchanged)`);
        return;
      }
    }
    const terrain = generateTerrain(data.seed);
    const golden: Golden = { terrainHash: terrainHash(terrain), replay: data, ...replay(data, terrain, BASE_SCENARIO) };
    writeFileSync(url, JSON.stringify(golden, null, 2) + '\n');
    console.log(`${file}: written for simVersion ${SIM_VERSION}`);
  });
}
