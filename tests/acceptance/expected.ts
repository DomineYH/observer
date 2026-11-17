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

/** 기대값 표: guns written by M3-2; scenario M3-4, combat numbers M3-5, combat scenario M3-16 (each row written once, by its slice). */
export const EXPECTED: Readonly<Record<string, string>> = {
  'combat@1 numbers': '753d3e0dff73ff9500a0e55246bb7cdab972c200053531735b1ce61ccc7a54d2',
  'combat@1 scenario base': '2e0d118233d772672e3daa3173bd61fcea1ac8ad4cfeac8c1fb14972094351fc',
  'combat@1 scenario base-mungyeong': '2e0d118233d772672e3daa3173bd61fcea1ac8ad4cfeac8c1fb14972094351fc',
  'guns base@1': 'f37f565942e40de42e63b3e03cc318876e8339664291a4b4d6d7c5b452960bc0',
  'scenario base@1': '75b04621cb342f68cc4da7b201db61651e31307b756a014461a64a83e0260eab',
  'scenario base-mungyeong@2': '19607bdd4ed25f61e614f04ac10fb8bb30bbc74e88afbf56d30271b52f5cdee3',
};
