import { expect, test } from 'vitest';
import { validateReplay, type GameRecord } from '@sim';
import { submissionOf } from '@app/records';
import type { Board, RunRecord, Submission } from '../index';
import { replayData } from '../../../tests/acceptance/init';
import { memoryStorage } from '../../../tests/acceptance/storage';
import { NO_ENEMY, oneMission } from '../../../tests/acceptance/session';
import { init } from '../../../tests/acceptance/init';
import { RESERVED } from './account';
import { mockArchive } from './records';

/** The sim's own format check, as the app passes it in. */
const isReplay = (x: unknown) => validateReplay(x).ok;
const BOARDS: Board[] = ['total', 'time', 'rounds', 'accuracy'];
const RECORD: GameRecord = {
  ticks: 30000, seed: 20261106, seedKind: 'daily', cleared: true, clearTick: 20000, roundsTotal: 30, missions: 3,
  adjustRounds: 4, firstErrorAvg: 20, directionErrorAvg: 5, reportAccuracyPct: 100, roundsPerUnit: 7.5, neutralized: 4,
  combatUnits: 4, earlyDefeats: 1, friendlyHits: 0, friendlyLosses: 0, dangerCloseMissed: 0, observerLost: false,
  postMoves: 0, compromised: false, score: 2000,
};
const run = (callsign: string, record: Partial<RunRecord> = {}): Submission => ({
  callsign,
  record: { ...RECORD, mode: 'standard', ...record },
  missions: [],
  replay: replayData([]),
});
/** A run as the archive keeps it, with its own time. */
const stored = (callsign: string, record: Partial<RunRecord>, createdAt: string, ranked = true) => ({ ...run(callsign, record), createdAt, ranked });
const seeded = (runs: unknown[]) => {
  const storage = memoryStorage();
  storage.setItem('observer.runs', JSON.stringify(runs));
  return mockArchive(storage, isReplay);
};
const callsigns = async (archive: ReturnType<typeof mockArchive>, b: Board) => (await archive.board(b)).map((r) => r.callsign);

test('B5: 송골매는 예약어 — mock 랭킹에 없다', async () => {
  const archive = mockArchive(memoryStorage(), isReplay);
  for (const b of BOARDS) {
    const names = await callsigns(archive, b);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('송골매');
    for (const n of names) expect(RESERVED.map((r) => r.toLowerCase())).not.toContain(n.toLowerCase());
  }
});

test('F-31: 제출한 기록이 랭킹에 보인다', async () => {
  const storage = memoryStorage();
  const archive = mockArchive(storage, isReplay);
  const before = new Date().toISOString();
  const stored = await archive.submit(run('참새12'));
  const after = new Date().toISOString();
  expect(stored.ranked).toBe(true);
  expect(stored.createdAt >= before && stored.createdAt <= after).toBe(true);
  const total = await archive.board('total');
  expect(total[0]).toMatchObject({ callsign: '참새12', fake: false, createdAt: stored.createdAt, record: { score: 2000 } });
  expect(total.filter((r) => r.fake).length).toBe(total.length - 1);
  for (const b of BOARDS) expect(await callsigns(archive, b)).toContain('참새12');
  expect(await archive.mine()).toEqual([stored]);
  // Kept in this browser: a new archive over the same storage still has it.
  expect(await callsigns(mockArchive(storage, isReplay), 'total')).toContain('참새12');
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 호출부호당 최고 기록 하나', async () => {
  const archive = mockArchive(memoryStorage(), isReplay);
  await archive.submit(run('참새12', { score: 1500, clearTick: 19000, roundsTotal: 40, firstErrorAvg: 30 }));
  await archive.submit(run('참새12', { score: 1900, clearTick: 25000, roundsTotal: 20, firstErrorAvg: 10 }));
  const mine = async (b: Board) => (await archive.board(b)).filter((r) => r.callsign === '참새12').map((r) => r.record);
  expect(await mine('total')).toEqual([expect.objectContaining({ score: 1900 })]);
  expect(await mine('time')).toEqual([expect.objectContaining({ clearTick: 19000 })]);
  expect(await mine('rounds')).toEqual([expect.objectContaining({ roundsTotal: 20 })]);
  expect(await mine('accuracy')).toEqual([expect.objectContaining({ firstErrorAvg: 10 })]);
  // Sorted best first: score high to low, the others low to high.
  const keys = async (b: Board, k: (r: Awaited<ReturnType<typeof archive.board>>[number]['record']) => number | null) =>
    (await archive.board(b)).map((r) => k(r.record));
  const sorted = (xs: (number | null)[], dir: number) => xs.every((x, i) => i === 0 || (x! - xs[i - 1]!) * dir >= 0);
  expect(sorted(await keys('total', (r) => r.score), -1)).toBe(true);
  expect(sorted(await keys('time', (r) => r.clearTick), 1)).toBe(true);
  expect(sorted(await keys('rounds', (r) => r.roundsTotal), 1)).toBe(true);
  expect(sorted(await keys('accuracy', (r) => r.firstErrorAvg), 1)).toBe(true);
  // A tie goes to the earlier record: 참매 (fake, 967 points, October) stays above a later 967.
  await archive.submit(run('참새34', { score: 967 }));
  const total = await callsigns(archive, 'total');
  expect(total.indexOf('참매')).toBe(total.indexOf('참새34') - 1);
  // The same callsign's tie shows its earlier record.
  const first = await archive.submit(run('참새56', { score: 1700 }));
  await new Promise((r) => setTimeout(r, 2));
  await archive.submit(run('참새56', { score: 1700 }));
  expect((await archive.board('total')).find((r) => r.callsign === '참새56')!.createdAt).toBe(first.createdAt);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 보드별 자격', async () => {
  const archive = mockArchive(memoryStorage(), isReplay);
  await archive.submit(run('미섬멸', { cleared: false, clearTick: null, score: 5000 }));
  await archive.submit(run('무사격', { missions: 0, firstErrorAvg: null, score: 4000 }));
  expect((await callsigns(archive, 'total')).slice(0, 2)).toEqual(['미섬멸', '무사격']);
  expect(await callsigns(archive, 'time')).not.toContain('미섬멸');
  expect(await callsigns(archive, 'rounds')).not.toContain('미섬멸');
  expect(await callsigns(archive, 'accuracy')).toContain('미섬멸');
  expect(await callsigns(archive, 'accuracy')).not.toContain('무사격');
  expect(await callsigns(archive, 'time')).toContain('무사격');
  // At most 20 rows a board.
  for (let i = 0; i < 20; i++) await archive.submit(run(`대원${i}`));
  expect((await archive.board('total')).length).toBe(20);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장 공간이 차면 오래된 기록부터 지운다', async () => {
  const one = JSON.stringify([{ ...run('참새00'), createdAt: new Date().toISOString(), ranked: true }]).length;
  const archive = mockArchive(memoryStorage(one * 3), isReplay);
  for (let i = 0; i < 5; i++) await archive.submit(run(`참새0${i}`));
  const kept = (await archive.mine()).map((r) => r.callsign);
  expect(kept[0]).toBe('참새04');
  expect(kept.length).toBeGreaterThan(1);
  expect(kept.length).toBeLessThan(5);
  expect(kept).toEqual([...kept].sort().reverse()); // the oldest went first
  // A run that does not fit even alone is refused, and nothing kept is lost.
  const tiny = mockArchive(memoryStorage(10), isReplay);
  await expect(tiny.submit(run('참새'))).rejects.toThrow();
  expect(await tiny.mine()).toEqual([]);
  // The newest 20 are kept.
  const many = mockArchive(memoryStorage(), isReplay);
  for (let i = 0; i < 22; i++) await many.submit(run(`대원${i}`));
  const mine = await many.mine();
  expect(mine.length).toBe(20);
  expect([mine[0]!.callsign, mine[19]!.callsign]).toEqual(['대원21', '대원2']);
});

test('F-30: 랭킹 자격', async () => {
  const archive = mockArchive(memoryStorage(), isReplay);
  const training = await archive.submit(run('훈련병', { mode: 'training', score: 9000 }));
  const practice = await archive.submit(run('연습생', { seedKind: 'practice', score: 9000 }));
  expect([training.ranked, practice.ranked]).toEqual([false, false]);
  expect((await archive.mine()).map((r) => r.callsign)).toEqual(['연습생', '훈련병']);
  for (const b of BOARDS) {
    expect(await callsigns(archive, b)).not.toContain('훈련병');
    expect(await callsigns(archive, b)).not.toContain('연습생');
  }
  // A caller's flag is not trusted.
  const forged = await archive.submit({ ...run('위조', { mode: 'training' }), ranked: true } as Submission);
  expect(forged.ranked).toBe(false);
  expect(await callsigns(archive, 'total')).not.toContain('위조');
  // Nor a stored one: the board reads the record's 모드 and 시드 종류.
  const edited = seeded([
    stored('훈련병', { mode: 'training' }, '2026-11-01T00:00:00.000Z', true),
    stored('연습생', { seedKind: 'practice' }, '2026-11-01T00:00:00.000Z', true),
    stored('표준병', {}, '2026-11-01T00:00:00.000Z', false),
  ]);
  for (const b of BOARDS) expect((await edited.board(b)).filter((r) => !r.fake).map((r) => r.callsign)).toEqual(['표준병']);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 동점은 그 기록을 먼저 낸 쪽이 위', async () => {
  // A's best (2000) came after B's (2000): B is above, whenever A's first, weaker run was.
  const archive = seeded([
    stored('에이', { score: 1000 }, '2026-01-01T00:00:00.000Z'),
    stored('비이', { score: 2000 }, '2026-01-02T00:00:00.000Z'),
    stored('에이', { score: 2000 }, '2026-01-03T00:00:00.000Z'),
  ]);
  expect((await callsigns(archive, 'total')).slice(0, 2)).toEqual(['비이', '에이']);
  const time = seeded([
    stored('에이', { clearTick: 30000 }, '2026-01-01T00:00:00.000Z'),
    stored('비이', { clearTick: 15000 }, '2026-01-02T00:00:00.000Z'),
    stored('에이', { clearTick: 15000 }, '2026-01-03T00:00:00.000Z'),
  ]);
  expect((await callsigns(time, 'time')).slice(0, 2)).toEqual(['비이', '에이']);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장소가 깨져 있으면 빈 기록', async () => {
  const storage = memoryStorage();
  storage.setItem('observer.runs', '{broken');
  expect(await mockArchive(storage, isReplay).mine()).toEqual([]);
  storage.setItem('observer.runs', JSON.stringify({ callsign: 'x' }));
  expect(await mockArchive(storage, isReplay).mine()).toEqual([]);
});

const MISSION = { targetNumber: 1001, corrections: 1, rounds: 19, firstError: 73, directionError: null, rangeCorrections: [60], report: 'ineffective' };

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장된 기록의 모양이 틀리면 버린다', async () => {
  const good = { ...stored('<b>x</b>', {}, '2026-11-01T09:00:00.000Z'), missions: [MISSION, { ...MISSION, targetNumber: null, report: null, rangeCorrections: [] }] };
  const { record } = good;
  const bad: unknown[] = [
    { callsign: 'x', record: {} },
    null,
    3,
    'run',
    [],
    { ...good, callsign: 3 },
    { ...good, createdAt: undefined },
    { ...good, createdAt: 'yesterday' },
    { ...good, ranked: 'yes' },
    { ...good, missions: {} },
    { ...good, replay: null },
    { ...good, record: { ...record, score: '5000' } },
    { ...good, record: { ...record, score: null } }, // NaN and Infinity come back from JSON as null
    { ...good, record: { ...record, clearTick: 'soon' } },
    { ...good, record: { ...record, cleared: 1 } },
    { ...good, record: { ...record, mode: 'expert' } },
    { ...good, record: { ...record, seedKind: 'custom' } },
    { ...good, record: { ...record, firstErrorAvg: undefined } },
    { ...good, record: Object.fromEntries(Object.entries(record).filter(([k]) => k !== 'roundsTotal')) },
    // 임무 요약 and 재생 자료 are checked too, not only that they are there.
    { ...good, missions: [null] },
    { ...good, missions: [{ ...MISSION, corrections: '1' }] },
    { ...good, missions: [{ ...MISSION, firstError: undefined }] },
    { ...good, missions: [{ ...MISSION, rangeCorrections: [60, 'x'] }] },
    { ...good, missions: [{ ...MISSION, rangeCorrections: 60 }] },
    { ...good, missions: [{ ...MISSION, report: 'great' }] },
    { ...good, missions: [MISSION, { ...MISSION, targetNumber: '1001' }] },
    { ...good, replay: {} },
    { ...good, replay: { ...good.replay, format: 2 } },
    { ...good, replay: { ...good.replay, seedKind: 'custom' } },
    { ...good, replay: { ...good.replay, inputs: [{ t: 0, a: 'start', v: ['x'] }] } },
  ];
  const archive = seeded([...bad, good]);
  expect(await archive.mine()).toEqual([good]);
  for (const b of BOARDS) expect((await archive.board(b)).filter((r) => !r.fake).map((r) => r.callsign)).toEqual(['<b>x</b>']);
  // A new submission keeps the valid runs and drops the rest from storage.
  await archive.submit(run('참새12'));
  expect((await archive.mine()).map((r) => r.callsign)).toEqual(['참새12', '<b>x</b>']);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 시뮬레이션에서 온 기록은 저장하고 다시 읽어도 그대로', async () => {
  const g = oneMission();
  const submission = submissionOf('참새12', g.sim, { ...init(20261106), scenario: NO_ENEMY }, g.session.log);
  expect(submission.missions).toHaveLength(1);
  expect(submission.replay.inputs.length).toBeGreaterThan(1);
  const storage = memoryStorage();
  const kept = await mockArchive(storage, isReplay).submit(submission);
  // Read back from storage by a new archive: the same run, replay and 임무 요약 included.
  expect(await mockArchive(storage, isReplay).mine()).toEqual([kept]);
  expect(validateReplay((await mockArchive(storage, isReplay).mine())[0]!.replay).ok).toBe(true);
  // The next save keeps it as it was.
  await mockArchive(storage, isReplay).submit(run('참새34'));
  expect((await mockArchive(storage, isReplay).mine())[1]).toEqual(kept);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 문자열이 아닌 보고는 버리고 이웃 기록은 남긴다', async () => {
  const good = { ...stored('참새56', {}, '2026-11-01T09:00:00.000Z'), missions: [MISSION] };
  // `["destroyed"]` passes as "destroyed" if coerced to a key; `{ toString: null }` throws if coerced.
  for (const report of [['destroyed'], { toString: null }]) {
    const storage = memoryStorage();
    const bad = { ...stored('참새78', {}, '2026-11-02T09:00:00.000Z'), missions: [{ ...MISSION, report }] };
    storage.setItem('observer.runs', JSON.stringify([good, bad]));
    const archive = mockArchive(storage, isReplay);
    expect(await archive.mine()).toEqual([good]);
    await archive.submit(run('참새12'));
    expect((JSON.parse(storage.getItem('observer.runs')!) as { callsign: string }[]).map((r) => r.callsign)).toEqual(['참새56', '참새12']);
  }
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 검사 중에 던지는 기록은 그것만 버린다', async () => {
  const good = stored('참새56', {}, '2026-11-01T09:00:00.000Z');
  const odd = { ...stored('참새78', {}, '2026-11-02T09:00:00.000Z'), replay: replayData([], 10, 1) };
  const storage = memoryStorage();
  storage.setItem('observer.runs', JSON.stringify([good, odd]));
  const throwsOnOdd = (x: unknown) => {
    if ((x as { seed: unknown }).seed === 1) throw new TypeError('hostile entry');
    return isReplay(x);
  };
  const archive = mockArchive(storage, throwsOnOdd);
  expect(await archive.mine()).toEqual([good]);
  await archive.submit(run('참새12'));
  expect((JSON.parse(storage.getItem('observer.runs')!) as { callsign: string }[]).map((r) => r.callsign)).toEqual(['참새56', '참새12']);
});
