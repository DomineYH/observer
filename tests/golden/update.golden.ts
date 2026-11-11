// npm run golden:update — writes a golden file only when it is missing or shouldWrite says a version moved up, with its
// script's header at the code's versions.
import { existsSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { replay, SIM_VERSION, terrainHash } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { currentHeader, GOLDEN_DIR, headerVersions, readGolden, shouldWrite, type Golden, type Versions } from './golden';
import { SCRIPTS } from './scripts';

// Every golden is decided and built before any is written, so a throw leaves all files as they were.
test('golden:update', () => {
  const writes: [URL, string][] = [];
  for (const { file, replay: script } of SCRIPTS) {
    const url = new URL(file, GOLDEN_DIR);
    const terrain = generateTerrain(script.seed);
    const now: Versions = {
      simVersion: SIM_VERSION,
      terrain: { id: terrain.id, version: terrain.version },
      scenario: { id: BASE_SCENARIO.id, version: BASE_SCENARIO.version },
    };
    const old = existsSync(url) ? headerVersions(readGolden(file).replay) : null;
    if (!shouldWrite(old, now)) {
      console.log(`${file}: skip (versions unchanged)`);
      continue;
    }
    const data = currentHeader(script, now);
    const golden: Golden = { terrainHash: terrainHash(terrain), replay: data, ...replay(data, terrain, BASE_SCENARIO) };
    writes.push([url, JSON.stringify(golden, null, 2) + '\n']);
  }
  for (const [url, text] of writes) {
    writeFileSync(url, text);
    console.log(`${url.pathname.split('/').at(-1)}: written for simVersion ${SIM_VERSION}`);
  }
}, 300000); // ③ and ④ replay 48 000 ticks each
