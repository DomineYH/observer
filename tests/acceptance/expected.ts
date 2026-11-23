// 기대값 표 (ADR 0009): one row per piece of content, key → SHA-256 of the piece written as key-sorted JSON. Test-only.
import { createHash } from 'node:crypto';
import type { GunProfile } from '@sim';

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

/** A 포 프로파일 without its 진지 변환 시간: the numbers its version names (#126 기대값 표). */
export const versioned = (g: GunProfile): Omit<GunProfile, 'displacementS'> =>
  Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'displacementS')) as Omit<GunProfile, 'displacementS'>;

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

/** 기대값 표: guns base M3-2, the four guns M3-12; scenario M3-4, combat numbers M3-5 (combat@2: M4-10, the fourteenth value), combat scenario M3-16, combat guns
 * M3-20, `apc-mungyeong` M3-22 (each row written once, by its slice). */
export const EXPECTED: Readonly<Record<string, string>> = {
  'combat@1 guns base': 'a037a7dfaf26abe1265bd5d51447be3bb1fdaef7c4c7a14bcf0d819818fb80b0',
  'combat@1 guns k55': '0604cd3138feed202ef293e062da2f4720f77a05d25ee036a7a01c9cfcdd1f0a',
  'combat@1 guns k9': '38d66d9692ac590000a91b03a88da1c88d51fab2b78f63171f553ecc551a0c6f',
  'combat@1 guns kh178': 'a0eaec5a55dc2f5b2ba523018adc485ff620b9d83509b9f37186a7716e438d21',
  'combat@1 guns kh179': 'a037a7dfaf26abe1265bd5d51447be3bb1fdaef7c4c7a14bcf0d819818fb80b0',
  'combat@1 numbers': '753d3e0dff73ff9500a0e55246bb7cdab972c200053531735b1ce61ccc7a54d2',
  'combat@1 scenario apc-mungyeong': '2e367b6e7279f6e2b4f5941f682de29ff5b28d967690384a4f0793d847acd774',
  'combat@1 scenario base': '2e0d118233d772672e3daa3173bd61fcea1ac8ad4cfeac8c1fb14972094351fc',
  'combat@1 scenario base-mungyeong': '2e0d118233d772672e3daa3173bd61fcea1ac8ad4cfeac8c1fb14972094351fc',
  'combat@2 guns base': 'a037a7dfaf26abe1265bd5d51447be3bb1fdaef7c4c7a14bcf0d819818fb80b0',
  'combat@2 guns k55': '0604cd3138feed202ef293e062da2f4720f77a05d25ee036a7a01c9cfcdd1f0a',
  'combat@2 guns k9': '38d66d9692ac590000a91b03a88da1c88d51fab2b78f63171f553ecc551a0c6f',
  'combat@2 guns kh178': 'a0eaec5a55dc2f5b2ba523018adc485ff620b9d83509b9f37186a7716e438d21',
  'combat@2 guns kh179': 'a037a7dfaf26abe1265bd5d51447be3bb1fdaef7c4c7a14bcf0d819818fb80b0',
  'combat@2 numbers': '16bd52ee48054296afdf7bb963146367f5d5256de64ab36ebc6069337bea7f47',
  'combat@2 scenario apc-mungyeong': '2e367b6e7279f6e2b4f5941f682de29ff5b28d967690384a4f0793d847acd774',
  'combat@2 scenario base': '2e0d118233d772672e3daa3173bd61fcea1ac8ad4cfeac8c1fb14972094351fc',
  'combat@2 scenario base-mungyeong': '2e0d118233d772672e3daa3173bd61fcea1ac8ad4cfeac8c1fb14972094351fc',
  'guns base@1': 'f37f565942e40de42e63b3e03cc318876e8339664291a4b4d6d7c5b452960bc0',
  'guns k55@1': '149bc3251dccb50cfa380f69541b2b77f837cd7ecff517100f52a1623f1caa22',
  'guns k9@1': '0caf54e01276298bd8231c013051a009f6a36e041ae6d8516aa638303fb4fcab',
  'guns kh178@1': '19ed664fa14d2c58a27fde5bf900f8b210aa0f6751a3aa8491ea3772ed6f31d2',
  'guns kh179@1': 'e1aa3058e5f31a62a2e409bae5c472d510720d66a23bc8a17c5f54a150584790',
  'scenario apc-mungyeong@1': '1e26359ed2281882318e95a9ae9b4113689793e43bf573ca25deb30b75c7a9a2',
  'scenario base@1': '75b04621cb342f68cc4da7b201db61651e31307b756a014461a64a83e0260eab',
  'scenario base-mungyeong@2': '19607bdd4ed25f61e614f04ac10fb8bb30bbc74e88afbf56d30271b52f5cdee3',
};
