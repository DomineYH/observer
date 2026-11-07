import { expect, test } from 'vitest';
import type { GameRecord } from '@sim';
import type { Board, RunRecord, Submission } from '../index';
import { replayData } from '../../../tests/acceptance/init';
import { memoryStorage } from '../../../tests/acceptance/storage';
import { RESERVED } from './account';
import { mockArchive } from './records';

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
const callsigns = async (archive: ReturnType<typeof mockArchive>, b: Board) => (await archive.board(b)).map((r) => r.callsign);

test('B5: 송골매는 예약어 — mock 랭킹에 없다', async () => {
  const archive = mockArchive(memoryStorage());
  for (const b of BOARDS) {
    const names = await callsigns(archive, b);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('송골매');
    for (const n of names) expect(RESERVED.map((r) => r.toLowerCase())).not.toContain(n.toLowerCase());
  }
});

test('F-31: 제출한 기록이 랭킹에 보인다', async () => {
  const storage = memoryStorage();
  const archive = mockArchive(storage);
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
  expect(await callsigns(mockArchive(storage), 'total')).toContain('참새12');
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 호출부호당 최고 기록 하나', async () => {
  const archive = mockArchive(memoryStorage());
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
  const archive = mockArchive(memoryStorage());
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
  const archive = mockArchive(memoryStorage(one * 3));
  for (let i = 0; i < 5; i++) await archive.submit(run(`참새0${i}`));
  const kept = (await archive.mine()).map((r) => r.callsign);
  expect(kept[0]).toBe('참새04');
  expect(kept.length).toBeGreaterThan(1);
  expect(kept.length).toBeLessThan(5);
  expect(kept).toEqual([...kept].sort().reverse()); // the oldest went first
  // A run that does not fit even alone is refused, and nothing kept is lost.
  const tiny = mockArchive(memoryStorage(10));
  await expect(tiny.submit(run('참새'))).rejects.toThrow();
  expect(await tiny.mine()).toEqual([]);
  // The newest 20 are kept.
  const many = mockArchive(memoryStorage());
  for (let i = 0; i < 22; i++) await many.submit(run(`대원${i}`));
  const mine = await many.mine();
  expect(mine.length).toBe(20);
  expect([mine[0]!.callsign, mine[19]!.callsign]).toEqual(['대원21', '대원2']);
});

test('F-30: 랭킹 자격', async () => {
  const archive = mockArchive(memoryStorage());
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
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장소가 깨져 있으면 빈 기록', async () => {
  const storage = memoryStorage();
  storage.setItem('observer.runs', '{broken');
  expect(await mockArchive(storage).mine()).toEqual([]);
  storage.setItem('observer.runs', JSON.stringify([{ callsign: 3 }, null, { callsign: '<b>x</b>', record: { ...RECORD, mode: 'standard' } }]));
  expect((await mockArchive(storage).mine()).map((r) => r.callsign)).toEqual(['<b>x</b>']);
});
