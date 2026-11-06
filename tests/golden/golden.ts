import { readdirSync, readFileSync } from 'node:fs';
import type { ReplayData, ReplayResult } from '@sim';

export const GOLDEN_DIR = new URL('./', import.meta.url);

/** 골든 기록: the 지형 해시 header, replay data and its expected result. */
export type Golden = { terrainHash: string; replay: ReplayData } & ReplayResult;

export const readGolden = (file: string): Golden => JSON.parse(readFileSync(new URL(file, GOLDEN_DIR), 'utf8'));
export const goldenFiles = (): string[] => readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json')).sort();
