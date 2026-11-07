import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Mode } from '@sim';
import { angleTo, mortarAt, started } from '../../tests/acceptance/enemy';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { LaseReadout } from './Laser';

const GRID = flatTerrain().grid;
const text = (html: string) => html.replace(/<\/(li|p)>/g, '\n').replace(/<[^>]*>/g, '').trim();

test('F-05: 레이저 측정 — 표시', () => {
  // A lase at the crew of a mortar section 700 m north, then one into the sky: what the readout shows of each.
  const sim = started(mortarAt({ x: 320, y: 1020 }));
  const man = sim.state.platoons[0]!.members.find((m) => m.kind === 'man' && m.vis)!;
  const at = angleTo(sim, man);
  const shown = (mode: Mode) => text(renderToStaticMarkup(<LaseReadout lases={sim.state.lases} mode={mode} grid={GRID} />));
  expect(shown('standard')).toBe('');

  sim.step([{ a: 'lase', v: [Math.round(at.az), Math.round(at.el)] }]);
  const r = sim.state.lases[0]!.range!;
  const az = String(Math.round(Math.round(at.az) / 10) % 6400).padStart(4, '0'); // from the 0.1 mils sent
  // (x, y) on the flat terrain's grid: 동 4000 + ⌊x / 10⌋, 북 3000 + ⌊y / 10⌋.
  const grid = `CH ${4000 + Math.floor(r.x / 10)} ${3000 + Math.floor(r.y / 10)}`;
  const line = `레이저: 방위각 ${az} 밀 · 거리 ${r.dist.toLocaleString()} m · 고저 ${r.vm} 밀 · 표적 반사`;
  expect(shown('standard').split('\n')[0]).toBe(line);
  expect(shown('training').split('\n')[0]).toBe(`${line} · ${grid}`); // training: the point's grid, worked out
  expect(shown('standard')).toContain(`00:00 · 방위각 ${az} · ${r.dist.toLocaleString()} m · 표적`);

  sim.step([{ a: 'lase', v: [32000, 50] }]);
  expect(shown('standard').split('\n')[0]).toBe('레이저: 반사 없음');
  expect(shown('standard').split('\n')).toHaveLength(2); // the list keeps the lases that met something
});
