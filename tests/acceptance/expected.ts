// 기대값 표 (ADR 0009): one row per piece of content, key → SHA-256 of the piece written as key-sorted JSON. Test-only.
import { createHash } from 'node:crypto';

// Written directly, not rebuilt as objects: JSON.stringify always puts integer-like keys ("2", "10") first.
const sortedJson = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map(sortedJson).join(',')}]`;
  if (typeof x !== 'object' || x === null) return JSON.stringify(x);
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort(); // JSON.stringify drops undefined entries too
  return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedJson(o[k])}`).join(',')}}`;
};

/** SHA-256 of the value written as key-sorted JSON: array order counts, object key order does not. */
export const valueHash = (value: unknown): string => createHash('sha256').update(sortedJson(value)).digest('hex');

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
