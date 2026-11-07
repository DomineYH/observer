import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import type { Board, RecordArchive } from '@adapters/index';
import { mockArchive } from '@adapters/mock/records';
import { submissionOf } from '@app/records';
import { init } from '../../tests/acceptance/init';
import { NO_ENEMY, oneMission } from '../../tests/acceptance/session';
import { memoryStorage } from '../../tests/acceptance/storage';
import { clock } from './clock';
import { Ranking } from './Ranking';

const text = (el: ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<\/t[dh]>/g, ' | ')
    .replace(/<\/(tr|h2|h3|p|div)>/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
const shown = async (archive: RecordArchive, board: Board, callsign = '참새12') => (
  <Ranking board={board} rows={await archive.board(board)} mine={await archive.mine()} callsign={callsign} onBoard={() => {}} />
);

test('F-31: 제출한 기록이 랭킹에 보인다 — 랭킹 창', async () => {
  const archive = mockArchive(memoryStorage());
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
  const archive = mockArchive(storage);
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
