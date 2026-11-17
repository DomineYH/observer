// npm run golden:update — writes a golden file only when it is missing or shouldWrite says a version moved up, with its
// script's header at the code's versions.
import { existsSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { replay, SIM_VERSION, terrainHash } from '@sim';
import { COMBAT } from '@content/combat';
import { GUNS, PLACEMENTS } from '@content/lookup';
import { currentHeader, GOLDEN_DIR, headerVersions, readGolden, shouldWrite, type Golden, type Versions } from './golden';
import { terrainOf } from './land';
import { SCRIPTS } from './scripts';

// Every golden is decided and built before any is written, so a throw leaves all files as they were.
test('golden:update', async () => {
  const writes: [URL, string][] = [];
  for (const { file, replay: script } of SCRIPTS) {
    const url = new URL(file, GOLDEN_DIR);
    // By id at the code's version, not the script's: ④ and ⑥ pin theirs and currentHeader rewrites them (ADR 0009).
    const scenario = PLACEMENTS.map((p) => p.scenario).find((s) => s.id === script.scenario.id);
    if (!scenario) throw new Error(`${file}: scenario ${script.scenario.id}: unknown id`);
    const guns = GUNS.map((g) => g.profile).find((g) => g.id === script.guns.id);
    if (!guns) throw new Error(`${file}: guns ${script.guns.id}: unknown id`);
    const combat = script.mode === 'combat' ? COMBAT : undefined; // at the code's 실전 자료 판, as the others
    const terrain = await terrainOf(script); // terrain version from the land's data
    const now: Versions = {
      simVersion: SIM_VERSION,
      terrain: { id: terrain.id, version: terrain.version },
      scenario: { id: scenario.id, version: scenario.version },
      guns: { id: guns.id, version: guns.version },
      ...(combat ? { combat: combat.version } : {}),
    };
    const old = existsSync(url) ? headerVersions(readGolden(file).replay) : null;
    if (!shouldWrite(old, now)) {
      console.log(`${file}: skip (versions unchanged)`);
      continue;
    }
    const data = currentHeader(script, now);
    const golden: Golden = { terrainHash: terrainHash(terrain), replay: data, ...replay(data, terrain, scenario, guns, combat) };
    writes.push([url, JSON.stringify(golden, null, 2) + '\n']);
  }
  for (const [url, text] of writes) {
    writeFileSync(url, text);
    console.log(`${url.pathname.split('/').at(-1)}: written for simVersion ${SIM_VERSION}`);
  }
}, 300000); // ③ and ④ replay 48 000 ticks each
