// 기록 보관소 mock (demo lines 1457–1460, 1495–1503; PRD 10.2): this browser's runs plus fake rows, ranked by board.
import type { Effect, GameRecord } from '@sim';
import type { Board, MissionSummary, RankRow, RecordArchive, StoredRun } from '../index';

const fake = (
  callsign: string,
  score: number,
  clearTick: number | null,
  roundsTotal: number,
  firstErrorAvg: number,
  reportAccuracyPct: number,
  missions: number,
  createdAt: string,
): RankRow => ({
  callsign,
  fake: true,
  createdAt,
  record: { score, cleared: clearTick !== null, clearTick, roundsTotal, firstErrorAvg, reportAccuracyPct, missions },
});

/** 가짜 순위 행: other players the mock board shows. B5: no reserved callsign (the demo's 송골매 is now 말똥가리). */
export const FAKE_RUNS: readonly RankRow[] = [
  fake('참매', 967, 35020, 56, 32, 81, 3, '2026-10-09T09:00:00.000Z'),
  fake('부엉이', 604, 25560, 105, 151, 51, 4, '2026-10-05T10:07:00.000Z'),
  fake('말똥가리', 834, null, 55, 31, 56, 5, '2026-10-11T11:14:00.000Z'),
  fake('황조롱이', 1075, 22960, 61, 85, 93, 6, '2026-10-21T12:21:00.000Z'),
  fake('두루미', 1000, 27560, 97, 40, 96, 3, '2026-10-11T13:28:00.000Z'),
  fake('백로', 823, 24880, 106, 111, 84, 4, '2026-10-13T14:35:00.000Z'),
  fake('까치', 830, 31140, 79, 67, 67, 5, '2026-10-09T15:42:00.000Z'),
  fake('제비', 667, 36040, 50, 147, 63, 6, '2026-10-06T16:49:00.000Z'),
  fake('물총새', 846, 29520, 101, 96, 96, 3, '2026-10-24T17:56:00.000Z'),
  fake('올빼미', 621, 33460, 95, 144, 74, 4, '2026-10-04T18:03:00.000Z'),
  fake('왜가리', 556, 36300, 93, 132, 61, 5, '2026-10-23T19:10:00.000Z'),
  fake('종다리', 648, 26840, 107, 122, 54, 6, '2026-10-26T20:17:00.000Z'),
];

const KEY = 'observer.runs';
const KEEP = 20; // runs kept in this browser, newest
const TOP = 20; // rows a board shows

type Row = RankRow['record'];
/** 보드: the sort key (smaller is better after `dir`) and who may be on it (demo BOARDS). */
const BOARDS: Record<Board, { key: (r: Row) => number; ok: (r: Row) => boolean }> = {
  total: { key: (r) => -r.score, ok: () => true },
  time: { key: (r) => r.clearTick!, ok: (r) => r.cleared },
  rounds: { key: (r) => r.roundsTotal, ok: (r) => r.cleared },
  accuracy: { key: (r) => r.firstErrorAvg!, ok: (r) => r.firstErrorAvg !== null && r.missions > 0 },
};

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const countOrNull = (x: unknown) => x === null || count(x);
const flag = (x: unknown) => typeof x === 'boolean';
// Stored values are checked as strings before any lookup: a key lookup would coerce, and `{ toString: null }` throws.
const oneOf = (...xs: string[]) => (x: unknown) => typeof x === 'string' && xs.includes(x);
// Every field a stored 판 기록 must have, and its type; a missing key fails its check.
const RECORD: Record<keyof GameRecord, (x: unknown) => boolean> = {
  ticks: count, seed: count, seedKind: oneOf('daily', 'practice'), cleared: flag, clearTick: countOrNull,
  roundsTotal: count, missions: count, adjustRounds: count, firstErrorAvg: countOrNull, directionErrorAvg: countOrNull,
  reportAccuracyPct: countOrNull, roundsPerUnit: countOrNull, neutralized: count, combatUnits: count, earlyDefeats: count,
  friendlyHits: count, friendlyLosses: count, dangerCloseMissed: count, observerLost: flag, postMoves: count,
  compromised: flag, score: count, mode: oneOf('training', 'standard'),
};
const RECORD_KEYS = Object.keys(RECORD) as (keyof GameRecord)[];
const EFFECTS: Record<Effect, true> = { destroyed: true, neutralized: true, ineffective: true }; // the compiler keeps it whole
// 임무 요약, field by field as RECORD.
const MISSION: Record<keyof MissionSummary, (x: unknown) => boolean> = {
  targetNumber: countOrNull, corrections: count, rounds: count, firstError: countOrNull, directionError: countOrNull,
  rangeCorrections: (x) => Array.isArray(x) && x.every(count),
  report: (x) => x === null || (typeof x === 'string' && Object.hasOwn(EFFECTS, x)),
};
const MISSION_KEYS = Object.keys(MISSION) as (keyof MissionSummary)[];
const fits = <K extends string>(x: unknown, keys: readonly K[], check: Record<K, (v: unknown) => boolean>) =>
  isObject(x) && keys.every((k) => check[k](x[k]));
/** Storage can be edited by hand: only an entry of the stored shape is a run. `isReplay` is the sim's 재생 자료 format
 * check (adapters take sim types only, so the assembly point passes it in). */
const isRun = (r: unknown, isReplay: (x: unknown) => boolean): r is StoredRun =>
  isObject(r) &&
  typeof r.callsign === 'string' &&
  typeof r.createdAt === 'string' &&
  !Number.isNaN(Date.parse(r.createdAt)) &&
  flag(r.ranked) &&
  Array.isArray(r.missions) &&
  r.missions.every((m) => fits(m, MISSION_KEYS, MISSION)) &&
  isReplay(r.replay) &&
  fits(r.record, RECORD_KEYS, RECORD);
/** 랭킹 자격 (PRD 10.2): 표준 모드 and 일일 시드, read off the record itself. */
const rankable = (r: GameRecord) => r.mode === 'standard' && r.seedKind === 'daily';
const byTime = (a: RankRow, z: RankRow) => (a.createdAt < z.createdAt ? -1 : a.createdAt > z.createdAt ? 1 : 0);

export function mockArchive(storage: Pick<Storage, 'getItem' | 'setItem'>, isReplay: (x: unknown) => boolean): RecordArchive {
  // Each run alone: one that fails or throws while checked is dropped without emptying the archive.
  const valid = (r: unknown): r is StoredRun => {
    try {
      return isRun(r, isReplay);
    } catch {
      return false;
    }
  };
  // Oldest first, valid runs only.
  const load = (): StoredRun[] => {
    try {
      const v: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
      return Array.isArray(v) ? v.filter(valid) : [];
    } catch {
      return [];
    }
  };
  const save = (runs: StoredRun[]) => {
    // A full storage drops the oldest runs first; a run that does not fit alone is refused.
    for (let from = 0; from < runs.length; from++) {
      try {
        return storage.setItem(KEY, JSON.stringify(runs.slice(from)));
      } catch {
        // try again without the oldest
      }
    }
    throw new Error('기록을 저장할 공간이 없다');
  };
  return {
    async submit(s) {
      const { record } = s;
      const run: StoredRun = {
        callsign: s.callsign,
        record,
        missions: s.missions,
        replay: s.replay,
        createdAt: new Date().toISOString(), // the archive stamps the time
        ranked: rankable(record),
      };
      save([...load(), run].slice(-KEEP));
      return run;
    },
    async board(b) {
      const { key, ok } = BOARDS[b];
      const mine = load()
        .filter((r) => rankable(r.record)) // not the stored flag: storage can be edited
        .map((r): RankRow => ({ callsign: r.callsign, fake: false, createdAt: r.createdAt, record: r.record }));
      // Each callsign's best run (the earlier of a tie), then best first and, on a tie, the earlier run first.
      const best = new Map<string, RankRow>();
      for (const r of [...FAKE_RUNS, ...mine].filter((r) => ok(r.record)).sort(byTime)) {
        const held = best.get(r.callsign);
        if (!held || key(r.record) < key(held.record)) best.set(r.callsign, r);
      }
      return [...best.values()].sort((a, z) => key(a.record) - key(z.record) || byTime(a, z)).slice(0, TOP);
    },
    mine: async () => load().reverse(),
  };
}
