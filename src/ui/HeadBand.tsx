import type { Mode, Phase } from '@sim';
import { clock } from './clock';

export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

interface Props {
  tick: number;
  score: number;
  rounds: number;
  mode: Mode;
  speed: Speed;
  paused: boolean;
  phase: Phase;
  onMode: (m: Mode) => void;
  onSpeed: (s: Speed) => void;
  onPause: () => void;
}

/** 머리띠 (wide layout): 경과 · 점수 · 사용 탄, then 모드, 배속 and 일시정지. Pause and speed are not inputs. */
export function HeadBand({ tick, score, rounds, mode, speed, paused, phase, onMode, onSpeed, onPause }: Props) {
  // A mode switch goes in on the next tick, and a paused game has none.
  const modeOff = paused || phase === 'ended';
  return (
    <p>
      경과 <output aria-label="경과">{clock(tick)}</output> · 점수 <output aria-label="점수">{score}</output> · 사용 탄{' '}
      <output aria-label="사용 탄">{rounds}발</output>{' '}
      <span role="group" aria-label="모드">
        {(['training', 'standard'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} disabled={modeOff} onClick={() => onMode(m)}>
            {m === 'training' ? '훈련' : '표준'}
          </button>
        ))}
      </span>{' '}
      <span role="group" aria-label="배속">
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} onClick={() => onSpeed(s)}>
            ×{s}
          </button>
        ))}
      </span>{' '}
      <button type="button" aria-pressed={paused} disabled={phase !== 'live'} onClick={onPause}>
        {paused ? '재개' : '일시정지'}
      </button>
    </p>
  );
}
