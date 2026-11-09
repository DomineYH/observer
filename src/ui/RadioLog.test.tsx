import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Mode, RadioUtterance } from '@sim';
import { openRadio, started } from '../../tests/acceptance/mission';
import { RadioLog, type LogLine } from './RadioLog';

const CORRECTION: RadioUtterance = {
  speaker: 'observer',
  ending: 'over',
  kind: 'correction',
  slots: { direction: 4720, lateralDir: 'right', lateral: 60, rangeDir: 'drop', range: 200, next: 'ffe' },
};
const markup = (mode: Mode) =>
  renderToStaticMarkup(<RadioLog lines={[{ type: 'radio', tick: 0, utterance: CORRECTION }]} callsign="갈매기" gridLetters="CH" mode={mode} />);
const text = (html: string) => html.replace(/<[^>]*>/g, '');

test('F-08: 무전 기록의 숫자 병기는 훈련 모드에서만 흐리게 보인다', () => {
  const training = markup('training');
  expect(text(training)).toBe('00:00 갈매기 방향 넷칠둘공(4720), 우로 여섯십(60), 줄이기 둘백(200), 효력사, 이상.');
  // Each gloss is its own element with a reduced opacity.
  const glosses = [...training.matchAll(/<span style="opacity:([\d.]+)">\((\d+)\)<\/span>/g)];
  expect(glosses.map((m) => m[2])).toEqual(['4720', '60', '200']);
  for (const [, opacity] of glosses) expect(Number(opacity)).toBeLessThan(1);

  const standard = markup('standard');
  expect(text(standard)).toBe('00:00 갈매기 방향 넷칠둘공, 우로 여섯십, 줄이기 둘백, 효력사, 이상.');
  expect(standard).not.toMatch(/opacity/);
});

test('F-08: 무전 기록', () => {
  const sim = started();
  const lines: LogLine[] = [{ type: 'system', tick: 0, text: '작전 개시.' }, ...openRadio(sim)];
  const html = renderToStaticMarkup(<RadioLog lines={lines} callsign="갈매기" gridLetters="CH" mode="standard" />);
  const items = [...html.matchAll(/<li data-speaker="(\w+)" style="color:([^"]+)">(.*?)<\/li>/g)];
  expect(items.map((m) => [m[1], text(m[3]!)])).toEqual([
    ['system', '00:00 작전 개시.'],
    ['fdc', '00:04 기러기 갈매기, 여기는 기러기, 감명 보고, 이상.'],
    ['observer', '00:05 갈매기 기러기, 여기는 갈매기, 감명 양호, 이상.'],
  ]);
  expect(new Set(items.map((m) => m[2])).size).toBe(3);
});
