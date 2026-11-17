// 레이저 표시 (demo lines 1066–1072): the last lase's 방위각 · 거리 · 고저, whether it came back from a target, and the
// lases that met something; training adds the measured point's grid.
import type { GridRef, Mode, ReadonlySimState } from '@sim';
import { gridOf } from '@render/mapView';
import { clock } from './clock';

type Lases = ReadonlySimState['lases'];
const az4 = (az: number) => String(Math.round(az / 10) % 6400).padStart(4, '0');

type LaserState = Pick<ReadonlySimState, 'phase' | 'post' | 'combat'>;

/** 레이저 한도: the lases a combat game has left (its 실전 수치 give `limit`); null outside one. */
export const lasesLeft = (s: Pick<ReadonlySimState, 'combat'>, limit?: number) => (s.combat && limit !== undefined ? limit - s.combat.lasesUsed : null);
/** R sends a lase once the operation is on (the simulation ignores one while the post moves), unless the limit is spent. */
export const laserKey = (s: LaserState, limit?: number) => s.phase === 'live' && lasesLeft(s, limit) !== 0;

export function LaserButton({ state, limit, onLase }: { state: LaserState; limit?: number; onLase: () => void }) {
  const left = lasesLeft(state, limit);
  return (
    <button type="button" disabled={!laserKey(state, limit) || state.post.state !== 'ready'} onClick={onLase}>
      레이저 <kbd>R</kbd>
      {left !== null && ` · 남은 ${left}`}
    </button>
  );
}

export function LaseReadout({ lases, mode, grid, spent = false }: { lases: Lases; mode: Mode; grid: GridRef; spent?: boolean }) {
  const at = (p: { x: number; y: number }) => {
    const g = gridOf(grid, p);
    return mode === 'training' ? ` · ${grid.letters} ${String(g.e).padStart(4, '0')} ${String(g.n).padStart(4, '0')}` : '';
  };
  const last = lases[0];
  if (!last) return null;
  const r = last.range;
  return (
    <div role="group" aria-label="레이저 측정">
      {spent && <p>레이저를 다 썼습니다 — 지도에서 지형을 대조해 위치를 정하십시오</p>}
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
