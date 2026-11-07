// 레이저 표시 (demo lines 1066–1072): the last lase's 방위각 · 거리 · 고저, whether it came back from a target, and the
// lases that met something; training adds the measured point's grid.
import type { GridRef, Mode, ReadonlySimState } from '@sim';
import { gridOf } from '@render/mapView';
import { clock } from './clock';

type Lases = ReadonlySimState['lases'];
const az4 = (az: number) => String(Math.round(az / 10) % 6400).padStart(4, '0');

export function LaseReadout({ lases, mode, grid }: { lases: Lases; mode: Mode; grid: GridRef }) {
  const at = (p: { x: number; y: number }) => {
    const g = gridOf(grid, p);
    return mode === 'training' ? ` · ${grid.letters} ${String(g.e).padStart(4, '0')} ${String(g.n).padStart(4, '0')}` : '';
  };
  const last = lases[0];
  if (!last) return null;
  const r = last.range;
  return (
    <div aria-label="레이저 측정">
      <p>
        {r
          ? `레이저: 방위각 ${az4(last.az)} 밀 · 거리 ${r.dist.toLocaleString()} m · 고저 ${r.vm} 밀${r.target ? ' · 표적 반사' : ''}${at(r)}`
          : '레이저: 반사 없음'}
      </p>
      <ul>
        {lases.map((l) =>
          l.range ? (
            <li key={l.tick + ':' + l.az}>
              {clock(l.tick)} · 방위각 {az4(l.az)} · {l.range.dist.toLocaleString()} m{at(l.range)}
              {l.range.target ? ' · 표적' : ''}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
