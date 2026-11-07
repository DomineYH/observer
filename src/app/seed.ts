// 일일 시드와 연습 시드 (F-30, demo lines 186–189). Pure: the caller reads the clock and the address.
import type { SeedKind } from '@sim';

const KST_MS = 9 * 3600e3;
const PRACTICE = /^\d{1,9}$/; // 9 digits keep the seed inside int32

/** 일일 시드 of a KST calendar date, e.g. 2026-11-06 → 20261106. The M6 server reuses this as it is. */
export const dailySeed = (y: number, m: number, d: number): number => y * 10000 + m * 100 + d;

/** The KST calendar date at the instant `ms` (epoch milliseconds). */
export function kstDate(ms: number): { y: number; m: number; d: number } {
  const t = new Date(ms + KST_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** `?seed=` digits make a practice game; otherwise today's daily seed. */
export function chooseSeed(search: string, nowMs: number): { seed: number; seedKind: SeedKind } {
  const q = new URLSearchParams(search).get('seed');
  if (q !== null && PRACTICE.test(q)) return { seed: Number(q), seedKind: 'practice' };
  const { y, m, d } = kstDate(nowMs);
  return { seed: dailySeed(y, m, d), seedKind: 'daily' };
}
