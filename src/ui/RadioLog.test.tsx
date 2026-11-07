import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Mode, RadioUtterance } from '@sim';
import { RadioLog } from './RadioLog';

const CORRECTION: RadioUtterance = {
  speaker: 'observer',
  ending: 'over',
  kind: 'correction',
  slots: { direction: 4720, lateralDir: 'right', lateral: 60, rangeDir: 'drop', range: 200, next: 'ffe' },
};
const markup = (mode: Mode) =>
  renderToStaticMarkup(<RadioLog utterances={[CORRECTION]} callsign="갈매기" gridLetters="CH" mode={mode} />);
const text = (html: string) => html.replace(/<[^>]*>/g, '');

test('F-08: 무전 기록의 숫자 병기는 훈련 모드에서만 흐리게 보인다', () => {
  const training = markup('training');
  expect(text(training)).toBe('갈매기 방향 넷칠둘공(4720), 우로 여섯십(60), 줄이기 둘백(200), 효력사, 이상.');
  // Each gloss is its own element with a reduced opacity.
  const glosses = [...training.matchAll(/<span style="opacity:([\d.]+)">\((\d+)\)<\/span>/g)];
  expect(glosses.map((m) => m[2])).toEqual(['4720', '60', '200']);
  for (const [, opacity] of glosses) expect(Number(opacity)).toBeLessThan(1);

  const standard = markup('standard');
  expect(text(standard)).toBe('갈매기 방향 넷칠둘공, 우로 여섯십, 줄이기 둘백, 효력사, 이상.');
  expect(standard).not.toMatch(/opacity/);
});
