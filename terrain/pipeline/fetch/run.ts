// npm run terrain:fetch — 받기 for every terrain/<id>/config.json, with the real sources. Not a check: the base
// vitest config does not include it, so `npm test` and CI never reach the network.
import { readdirSync } from 'node:fs';
import { test } from 'vitest';
import { readConfig } from '../config';
import { fetchTerrain } from './fetch';
import { realSources } from './sources';

test('terrain:fetch', async () => {
  const sources = realSources();
  const ids = readdirSync('terrain', { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'pipeline').map((d) => d.name);
  for (const id of ids) {
    const dir = `terrain/${id}`;
    const m = await fetchTerrain(dir, readConfig(dir), sources);
    console.log(`${id}: snapshot written (OpenStreetMap ${m.sources.osm.osmBase}, ${JSON.stringify(m.sources.osm.counts)})`);
  }
}, 1_200_000);
