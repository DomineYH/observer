import { readdirSync, readFileSync } from 'node:fs';
import type { Ref, ReplayData, ReplayResult } from '@sim';

export const GOLDEN_DIR = new URL('./', import.meta.url);

/** 골든 기록: the 지형 해시 header, replay data and its expected result. */
export type Golden = { terrainHash: string; replay: ReplayData } & ReplayResult;

export const readGolden = (file: string): Golden => JSON.parse(readFileSync(new URL(file, GOLDEN_DIR), 'utf8'));
export const goldenFiles = (): string[] => readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json')).sort();

/** The three versions a golden header is made under. */
export type Versions = { simVersion: number; terrain: Ref; scenario: Ref };

export const headerVersions = (d: ReplayData): Versions => ({
  simVersion: d.simVersion,
  terrain: d.terrain ?? { id: 'mock', version: 1 },
  scenario: d.scenario,
});

function sameIds(a: Versions, b: Versions, what: string): void {
  for (const k of ['terrain', 'scenario'] as const) if (a[k].id !== b[k].id) throw new Error(`${what} ${k} ${a[k].id} is not ${b[k].id}`);
}

/** The header a golden is replayed and written with: the script's, at the code's versions (mock terrain stays absent).
 * Throws when a terrain or scenario id differs. */
export function currentHeader(d: ReplayData, now: Versions): ReplayData {
  sameIds(headerVersions(d), now, 'script');
  const h: ReplayData = { ...d, simVersion: now.simVersion, scenario: now.scenario };
  if (now.terrain.id === 'mock') delete h.terrain;
  else h.terrain = now.terrain;
  return h;
}

/** 골든 다시 만들기: write when there is no file, or when some version is bigger on the code side and none smaller.
 * Throws when a terrain or scenario id differs or any version is smaller. */
export function shouldWrite(golden: Versions | null, now: Versions): boolean {
  if (!golden) return true;
  sameIds(golden, now, 'golden');
  const pairs = [
    ['simVersion', golden.simVersion, now.simVersion],
    ['terrain', golden.terrain.version, now.terrain.version],
    ['scenario', golden.scenario.version, now.scenario.version],
  ] as const;
  for (const [k, old, code] of pairs) if (code < old) throw new Error(`golden ${k} version ${old} is newer than code ${code}`);
  return pairs.some(([, old, code]) => code > old);
}
