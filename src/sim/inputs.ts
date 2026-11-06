// 입력 종류 and their value formats (재생 자료 format 1, spec 입력 기록). The one kind table: the replay format check
// and the simulation's step both use it. Kinds are added by the slices that use them.
import type { Input } from './types';

type Range = readonly [min: number, max: number];

// A Map, so no kind name can reach an inherited object key.
const FORMATS = new Map<string, readonly Range[]>([
  ['cam', [[0, 63999], [-2000, 2000]]], // 조준: 방위 · 고저, 0.1 mil
  ['bino', [[0, 1]]], // 쌍안경: 끔 · 켬
]);

/** A known kind with exactly its values, each an integer in range. Kinds without values carry no `v`. */
export function validInput(a: string, v: unknown): boolean {
  const ranges = FORMATS.get(a);
  if (!ranges) return false;
  if (v === undefined) return ranges.length === 0;
  if (!Array.isArray(v) || ranges.length === 0 || v.length !== ranges.length) return false;
  return ranges.every(([min, max], i) => Number.isInteger(v[i]) && v[i] >= min && v[i] <= max);
}

export const isValid = (input: Input): boolean => validInput(input.a, input.v);
