import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { validateReplay } from '@sim';
import type { Board, RecordArchive, StoredRun } from '@adapters/index';
import { mockArchive } from '@adapters/mock/records';
import { submissionOf } from '@app/records';
import { dailyCandidates } from '@app/seed';
import { PLACEMENTS } from '@content/lookup';
import { BASE } from '@content/scenarios/base';
import { BASE_MUNGYEONG } from '@content/scenarios/base-mungyeong';
import { init } from '../../tests/acceptance/init';
import { NO_ENEMY, oneMission } from '../../tests/acceptance/session';
import { memoryStorage } from '../../tests/acceptance/storage';
import { clock } from './clock';
import { firstMode, Ranking } from './Ranking';

const text = (el: ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<\/t[dh]>/g, ' | ')
    .replace(/<\/(tr|h2|h3|p|div)>/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
/** The 표준 · `base` board with one 일일 후보, as the mock build opens it. */
const STANDARD_BASE = { mode: 'standard', onMode: () => {}, scenario: 'base', scenarios: [BASE], onScenario: () => {} } as const;
const shown = async (archive: RecordArchive, board: Board, callsign = '참새12') => (
  <Ranking board={board} rows={await archive.board('standard', 'base', board)} mine={await archive.mine()} callsign={callsign} onBoard={() => {}} placements={PLACEMENTS} {...STANDARD_BASE} />
);

test('F-31: 제출한 기록이 랭킹에 보인다 — 랭킹 창', async () => {
  const archive = mockArchive(memoryStorage(), (x) => validateReplay(x).ok);
  const g = oneMission();
  const sub = submissionOf('참새12', g.sim, { ...init(20261106), scenario: NO_ENEMY }, g.session.log);
  await archive.submit(sub);
  await archive.submit({ ...sub, record: { ...sub.record, mode: 'training' } });
  await archive.submit({ ...sub, record: { ...sub.record, seedKind: 'practice' } });
  const r = sub.record;
  const total = text(await shown(archive, 'total'));
  expect(total[0]).toBe('랭킹');
  expect(total).toContain('종합 섬멸 시간 사용 탄 정확도');
  expect(total).toContain('# | 호출부호 | 종합 | 탄 | 초탄 오차 | 일자 |');
  const err = r.firstErrorAvg === null ? '—' : `${r.firstErrorAvg} m`;
  const onBoard = (lines: string[]) => lines.slice(0, lines.findIndex((l) => l.startsWith('내 기록')));
  const mineRow = onBoard(total).filter((l) => l.includes('참새12 |'));
  expect(mineRow).toHaveLength(1); // the training and practice runs are not on it
  expect(mineRow[0]).toMatch(new RegExp(`^\\d+ \\| 참새12 \\| ${r.score}점 \\| ${r.roundsTotal} \\| ${err} \\| \\d\\d-\\d\\d \\|$`));
  expect(total).toContainEqual(expect.stringMatching(/^\d+ \| 두루미 목업 \| 1000점 \| 97 \| 40 m \| 10-11 \|$/)); // a fake row, marked
  expect(text(await shown(archive, 'time'))).toContain('1 | 황조롱이 목업 | 19:08 | 61 | 85 m | 10-21 |');
  const accuracy = text(await shown(archive, 'accuracy'));
  expect(accuracy).toContain('1 | 말똥가리 목업 | 31 m · 보고 56% | 55 | 31 m | 10-11 |');
  expect(r.firstErrorAvg).toBeNull(); // 바로 효력사 has no 초탄 오차
  expect(onBoard(accuracy).join('\n')).not.toContain('참새12 |');
  // 내 기록: every run in this browser, newest first, with its 모드.
  const mine = total.slice(total.indexOf('일시 | 호출부호 | 모드 | 결과 | 시간 | 탄 | 초탄 오차 | 점수 |') + 1);
  const result = r.cleared ? '섬멸' : r.observerLost ? '관측반 손실' : '미완';
  const time = r.clearTick === null ? '—' : clock(r.clearTick);
  expect(mine.map((l) => l.replace(/^\d\d-\d\d \d\d:\d\d \| /, ''))).toEqual(
    ['연습', '훈련', '표준'].map((m) => `참새12 | ${m} | ${result} | ${time} | ${r.roundsTotal} | ${r.firstErrorAvg ?? '—'} | ${r.score} |`),
  );
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장된 문자열은 글자로 보인다', async () => {
  const storage = memoryStorage();
  const archive = mockArchive(storage, (x) => validateReplay(x).ok);
  const g = oneMission();
  const sub = submissionOf('참새12', g.sim, { ...init(20261106), scenario: NO_ENEMY }, g.session.log);
  await archive.submit(sub);
  // Storage edited by hand: a ranked run under a callsign the rules never let through.
  const runs = JSON.parse(storage.getItem('observer.runs')!);
  runs[0].callsign = '<img src=x onerror=alert(1)>';
  storage.setItem('observer.runs', JSON.stringify(runs));
  const html = renderToStaticMarkup(await shown(archive, 'total', '<b>x</b>'));
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<b>');
});

test('랭킹: 내 기록의 모드 칸 — 기록 종류와 기본과 다른 것', () => {
  const g = oneMission();
  const sub = submissionOf('참새12', g.sim, { ...init(20261106), scenario: NO_ENEMY }, g.session.log);
  // A 배치 list made in the test: mock's 기본 시나리오, a second mock 배치 and mungyeong's 기본 시나리오.
  const NIGHT = { ...BASE, scenario: { ...BASE.scenario, id: 'night' }, briefing: { ...BASE.briefing, name: '야간 중대' } };
  const run = (mode: 'standard' | 'combat' | 'training', seedKind: 'daily' | 'practice', scenario = 'base', guns = 'base'): StoredRun => ({
    ...sub,
    record: { ...sub.record, mode, seedKind },
    replay: { ...sub.replay, scenario: { ...sub.replay.scenario, id: scenario }, guns: { ...sub.replay.guns, id: guns } },
    createdAt: '2026-11-07T00:00:00.000Z',
    ranked: false,
  });
  const mine = [
    run('standard', 'daily'),
    run('combat', 'daily'),
    run('training', 'daily'),
    run('standard', 'practice'),
    run('combat', 'practice'),
    run('standard', 'practice', 'base', 'k9'),
    run('standard', 'daily', 'night'),
    run('standard', 'daily', 'base-mungyeong'),
    run('combat', 'practice', 'gone', 'm1'), // an old build's ids: written as they are
  ];
  const lines = text(<Ranking board="total" rows={[]} mine={mine} callsign="참새12" onBoard={() => {}} placements={[BASE, NIGHT, BASE_MUNGYEONG]} {...STANDARD_BASE} />);
  const head = lines.indexOf('일시 | 호출부호 | 모드 | 결과 | 시간 | 탄 | 초탄 오차 | 점수 |');
  expect(head).toBeGreaterThan(0);
  expect(lines.slice(head + 1).map((l) => l.split(' | ')[2])).toEqual([
    '표준',
    '실전',
    '훈련',
    '연습',
    '연습 · 실전',
    '연습 · K9 155mm 자주포',
    '표준 · 야간 중대',
    '표준',
    '연습 · 실전 · gone · m1',
  ]);
});

test('랭킹: 랭킹 창 — 모드와 시나리오를 고르는 자리', async () => {
  const archive = mockArchive(memoryStorage(), (x) => validateReplay(x).ok);
  // A 배치 list made in the test: mock's 기본 시나리오, a daily 배치 from 20261201, a practice-only one and a later one.
  const at = (id: string, name: string, dailyFrom?: number) => ({
    ...BASE,
    scenario: { ...BASE.scenario, id },
    briefing: { ...BASE.briefing, name },
    ...(dailyFrom === undefined ? {} : { dailyFrom }),
  });
  const LIST = [BASE, at('night', '야간 중대', 20261201), at('drill', '연습 중대'), at('later', '나중 중대', 20270101)];
  expect(dailyCandidates(20261130, 'mock', LIST).map((p) => p.scenario.id)).toEqual(['base']);
  expect(dailyCandidates(20261201, 'mock', LIST).map((p) => p.scenario.id)).toEqual(['base', 'night']);
  // The first board: 실전 when the game is 실전, otherwise 표준.
  expect([firstMode('combat'), firstMode('standard'), firstMode('training')]).toEqual(['combat', 'standard', 'standard']);
  const view = async (mode: 'standard' | 'combat', scenario: string, scenarios: typeof LIST) => {
    const el = (
      <Ranking
        board="total"
        rows={await archive.board(mode, scenario, 'total')}
        mine={[]}
        callsign="참새12"
        onBoard={() => {}}
        placements={LIST}
        mode={mode}
        onMode={() => {}}
        scenario={scenario}
        scenarios={scenarios}
        onScenario={() => {}}
      />
    );
    return { lines: text(el), pressed: [...renderToStaticMarkup(el).matchAll(/aria-pressed="true"[^>]*>([^<]*)</g)].map((m) => m[1]) };
  };
  const one = await view('standard', 'base', dailyCandidates(20261130, 'mock', LIST));
  expect(one.lines.slice(0, 5)).toEqual([
    '랭킹',
    '표준 모드·일일 시드 기록만 집계 · 호출부호당 최고 기록 1개 · 목업 표시는 가상의 예시 데이터입니다.',
    '표준 실전',
    '종합 섬멸 시간 사용 탄 정확도',
    '# | 호출부호 | 종합 | 탄 | 초탄 오차 | 일자 |',
  ]);
  expect(one.pressed).toEqual(['표준', '종합']);
  expect(one.lines).toContainEqual(expect.stringMatching(/^\d+ \| 두루미 목업 \| 1000점 \| 97 \| 40 m \| 10-11 \|$/));
  const two = await view('combat', 'night', dailyCandidates(20261201, 'mock', LIST));
  expect(two.lines.slice(0, 6)).toEqual([
    '랭킹',
    '실전 모드·일일 시드 기록만 집계 · 호출부호당 최고 기록 1개',
    '표준 실전',
    '보병 중대 야간 중대',
    '종합 섬멸 시간 사용 탄 정확도',
    '# | 호출부호 | 종합 | 탄 | 초탄 오차 | 일자 |',
  ]);
  expect(two.pressed).toEqual(['실전', '야간 중대', '종합']);
  // 가짜 순위 행 stand on the 표준 board of the 기본 시나리오 only (#183): this one has no run yet and says so.
  expect(two.lines.filter((l) => l.includes('목업 |'))).toEqual([]);
  expect(two.lines).toContain('아직 기록이 없습니다');
  expect(one.lines).not.toContain('아직 기록이 없습니다');
});

test('랭킹: 일자와 일시는 한국 시각 (#208)', () => {
  const g = oneMission();
  const sub = submissionOf('참새12', g.sim, { ...init(20261106), scenario: NO_ENEMY }, g.session.log);
  const createdAt = '2026-11-24T15:30:00.000Z'; // 2026-11-25 00:30 in Korea
  const rows = [{ callsign: '참새12', fake: false, createdAt, record: sub.record }];
  const lines = text(<Ranking board="total" rows={rows} mine={[{ ...sub, createdAt, ranked: true }]} callsign="참새12" onBoard={() => {}} placements={PLACEMENTS} {...STANDARD_BASE} />);
  expect(lines).toContainEqual(expect.stringMatching(/^1 \| 참새12 \| .* \| 11-25 \|$/));
  expect(lines).toContainEqual(expect.stringMatching(/^11-25 00:30 \| 참새12 \| /));
});
