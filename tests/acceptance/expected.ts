// 기대값 표 (ADR 0009): one row per piece of content, key → SHA-256 of the piece written as key-sorted JSON. Test-only.
import { createHash } from 'node:crypto';

const sorted = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(sorted)
    : typeof x === 'object' && x !== null
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted((x as Record<string, unknown>)[k])]))
      : x;

/** SHA-256 of the value written as key-sorted JSON: array order counts, object key order does not. */
export const valueHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');

export type Mismatch = { key: string; problem: 'changed' | 'missing' | 'extra'; row?: string; actual?: string };

/** rows: the table (key → hash). pieces: key → value of every piece of content the repository has now. */
export function mismatches(rows: Readonly<Record<string, string>>, pieces: Readonly<Record<string, unknown>>): Mismatch[] {
  const out: Mismatch[] = [];
  for (const key of [...new Set([...Object.keys(rows), ...Object.keys(pieces)])].sort()) {
    const row = rows[key];
    if (!Object.hasOwn(pieces, key)) out.push({ key, problem: 'extra', row });
    else {
      const actual = valueHash(pieces[key]); // on a red test, the hash the slice writing this row copies
      if (row === undefined) out.push({ key, problem: 'missing', actual });
      else if (row !== actual) out.push({ key, problem: 'changed', row, actual });
    }
  }
  return out;
}

/** 기대값 표. No rows yet: guns M3-2, scenario M3-4, combat M3-5 (each row written once, by its slice). */
export const EXPECTED: Readonly<Record<string, string>> = {};
