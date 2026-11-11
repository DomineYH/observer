// npm run terrain:build — 가공 for every terrain/<id>/config.json, from the committed 원자료 스냅샷 (no network).
// Not a check: the base vitest config does not include it; the acceptance test 가공: 다시 만들어 견주기 is the check.
import { readdirSync } from 'node:fs';
import { test } from 'vitest';
import { readConfig } from '../config';
import { readSnapshot } from '../snapshot';
import { buildAndWrite } from './build';

test('terrain:build', async () => {
  const ids = readdirSync('terrain', { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'pipeline').map((d) => d.name);
  for (const id of ids) {
    const dir = `terrain/${id}`;
    const config = readConfig(dir);
    const { file, log } = await buildAndWrite({ data: dir, source: `src/adapters/realTerrain/${id}` }, id, config, readSnapshot(`${dir}/snapshot`, config.frame.n));
    console.log(`${id}: 판 ${config.version}, ${file.length} bytes (body ${log.size.body}), shares ${JSON.stringify(log.cover.final)}`);
  }
}, 120_000);
