// 관측소 위치 보고 (demo lines 941–946, 1015): after the move and the setup, the post's grid — prefilled in 훈련 — with
// its preview and 송신, or going on without reporting it.
import { useState } from 'react';
import type { GridRef, Input, Mode, Point } from '@sim';
import { gridOf } from '@render/mapView';
import { Preview } from './CorrectionForm';
import { POSITION_HINT } from './post';
import { posDraft, POS_SKIP } from './radio/drafts';
import type { RadioNames } from './radio/sentence';

const four = (n: number) => String(n).padStart(4, '0');

interface Props {
  op: Point; // where the post stands: 훈련 fills in its grid
  grid: GridRef;
  names: RadioNames;
  mode: Mode;
  send: (input: Input) => void;
}

export function PositionForm({ op, grid, names, mode, send }: Props) {
  const [at, setAt] = useState(() => {
    const g = gridOf(grid, op);
    return mode === 'training' ? { e: four(g.e), n: four(g.n) } : { e: '', n: '' };
  });
  return (
    <section aria-label="위치 보고">
      <p>관측소 위치 보고</p>
      현 위치 {grid.letters}{' '}
      {(['e', 'n'] as const).map((k) => (
        <label key={k}>
          {k === 'e' ? '동' : '북'}{' '}
          <input inputMode="numeric" maxLength={4} size={4} value={at[k]} onChange={(ev) => setAt({ ...at, [k]: ev.target.value })} />
        </label>
      ))}
      <Preview draft={posDraft(at.e, at.n)} empty="동·북 네 자리씩" names={names} mode={mode} send={send} />
      <button type="button" onClick={() => send(POS_SKIP)}>
        보고하지 않고 계속
      </button>
      <p>{POSITION_HINT[mode]}</p>
    </section>
  );
}
