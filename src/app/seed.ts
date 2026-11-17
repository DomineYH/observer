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

/** What picking a 배치 reads of one: its scenario id, its 전장 and, if it has one, its 일일 시작일 (YYYYMMDD). */
type Laid = { scenario: { id: string }; terrain: { id: string }; dailyFrom?: number };

/** 일수: the days from 1970-01-01 to a YYYYMMDD date (20261201 → 20788). */
const dayNumber = (date: number): number => Date.UTC(Math.trunc(date / 10000), (Math.trunc(date / 100) % 100) - 1, date % 100) / 86400e3;

/** 일일 후보 of a YYYYMMDD date on a 전장: its 기본 시나리오 (its first 배치) and its 배치 whose 일일 시작일 is on or before the
 * date, in list order. */
export const dailyCandidates = <P extends Laid>(date: number, field: string, placements: readonly P[]): P[] =>
  placements.filter((p) => p.terrain.id === field).filter((p, i) => i === 0 || (p.dailyFrom !== undefined && p.dailyFrom <= date));

/** 일일 시나리오 (ADR 0020) of a YYYYMMDD date on a 전장: of its 일일 후보, the one at 일수 mod their count. Any mode. The M6
 * server reuses this as it is. */
export function dailyScenario<P extends Laid>(date: number, field: string, placements: readonly P[]): P {
  const candidates = dailyCandidates(date, field, placements);
  return candidates[dayNumber(date) % candidates.length]!;
}

/** The game's 배치: a daily seed's 일일 시나리오, or the practice seed's `?scenario=` when it names a 배치 on this 전장 and the
 * 기본 시나리오 otherwise (silently). */
export function placementFor<P extends Laid>(search: string, seed: number, seedKind: SeedKind, field: string, placements: readonly P[]): P {
  if (seedKind === 'daily') return dailyScenario(seed, field, placements);
  const id = new URLSearchParams(search).get('scenario');
  const laid = placements.filter((p) => p.terrain.id === field);
  return laid.find((p) => p.scenario.id === id) ?? laid[0]!;
}
