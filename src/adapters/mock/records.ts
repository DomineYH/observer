// 기록 보관소 mock (demo lines 1457–1460, 1495–1503; PRD 10.2): this browser's runs plus fake rows, ranked by board.
import type { Board, RankRow, RecordArchive, StoredRun } from '../index';

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

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

export function mockArchive(storage: Pick<Storage, 'getItem' | 'setItem'>): RecordArchive {
  // Oldest first. Storage can be edited by hand: keep only entries that look like runs.
  const load = (): StoredRun[] => {
    try {
      const v: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((r): r is StoredRun => isObject(r) && typeof r.callsign === 'string' && isObject(r.record)) : [];
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
        ranked: record.mode === 'standard' && record.seedKind === 'daily', // 랭킹 자격 (PRD 10.2)
      };
      save([...load(), run].slice(-KEEP));
      return run;
    },
    async board(b) {
      const { key, ok } = BOARDS[b];
      const mine = load()
        .filter((r) => r.ranked === true)
        .map((r): RankRow => ({ callsign: r.callsign, fake: false, createdAt: r.createdAt, record: r.record }));
      // Earlier first, so a stable sort puts the earlier of a tie on top.
      const rows = [...FAKE_RUNS, ...mine].filter((r) => ok(r.record)).sort((a, z) => (a.createdAt < z.createdAt ? -1 : a.createdAt > z.createdAt ? 1 : 0));
      const best = new Map<string, RankRow>();
      for (const r of rows) {
        const held = best.get(r.callsign);
        if (!held || key(r.record) < key(held.record)) best.set(r.callsign, r);
      }
      return [...best.values()].sort((a, z) => key(a.record) - key(z.record)).slice(0, TOP); // stable: ties stay earlier first
    },
    mine: async () => load().reverse(),
  };
}
