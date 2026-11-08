import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Mode, ReadonlySimState, Sim } from '@sim';
import { angleTo, idAt, mortarAt, run, started } from '../../tests/acceptance/enemy';
import { TargetList } from './TargetList';

const text = (sim: Sim, mode: Mode = 'standard', platoons: ReadonlySimState['platoons'] = sim.state.platoons) =>
  renderToStaticMarkup(<TargetList platoons={platoons} mode={mode} />)
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

test('F-14: 훈련 전투력', () => {
  // Training adds the unit's real 전투력 once its type is known (demo 1095); standard never shows it.
  const sim = started(mortarAt({ x: 320, y: 1320 }));
  run(sim, 39);
  sim.step([idAt(angleTo(sim, sim.state.platoons[0]!.members[1]!))]);
  expect(text(sim, 'training')).not.toContain('전투력'); // only 탐지
  sim.step([{ a: 'bino', v: [1] }, { a: 'cam', v: [0, -26] }]);
  run(sim, 110);
  expect(text(sim, 'training')).toContain('병종 식별 · 최초 탐지 00:02 · 마지막 관측 00:07 · (훈련: 전투력 100%)');
  expect(text(sim, 'standard')).not.toContain('전투력');
  // A quarter of the section down: 75%.
  const hit = structuredClone(sim.state.platoons) as Sim['state']['platoons'];
  const members = hit[0]!.members as unknown as { alive: boolean }[];
  expect(members).toHaveLength(12);
  for (const m of members.slice(0, 3)) m.alive = false;
  expect(text(sim, 'training', hit)).toContain('(훈련: 전투력 75%)');
});
