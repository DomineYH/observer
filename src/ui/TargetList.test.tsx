import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Sim } from '@sim';
import { angleTo, idAt, mortarAt, run, started } from '../../tests/acceptance/enemy';
import { TargetList } from './TargetList';

const text = (sim: Sim) =>
  renderToStaticMarkup(<TargetList platoons={sim.state.platoons} />)
    .replace(/<\/li>/g, '\n')
    .replace(/<br\/>/g, ' / ')
    .replace(/<[^>]*>/g, '')
    .trim();

test('표적 목록: 찾은 순서로, 아는 만큼만', () => {
  // The mortar section 1 km north, found by eye 2 s in, then watched through the binoculars.
  const sim = started(mortarAt({ x: 320, y: 1320 }));
  expect(text(sim)).toBe('');
  run(sim, 39);
  sim.step([idAt(angleTo(sim, sim.state.platoons[0]!.members[1]!))]);
  expect(text(sim)).toBe('표적 1 미상 / 탐지 · 최초 탐지 00:02 · 마지막 관측 00:02');
  sim.step([{ a: 'bino', v: [1] }, { a: 'cam', v: [0, -26] }]);
  run(sim, 110);
  expect(text(sim)).toBe('표적 1 정지중인 적 박격포(82mm 추정) / 병종 식별 · 최초 탐지 00:02 · 마지막 관측 00:07');
  run(sim, 200);
  expect(text(sim)).toBe('표적 1 정지중인 적 박격포(82mm 추정) 3문 / 적정 확인 · 최초 탐지 00:02 · 마지막 관측 00:17');
});
