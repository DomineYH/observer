import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Mode, Phase } from '@sim';
import { QUALITIES, type Quality } from '@render/projection';
import { clock } from './clock';

export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

const MODE_NAMES: Record<Mode, string> = { training: '훈련', standard: '표준' };
const QUALITY_NAMES: Record<Quality, string> = { medium: '보통', high: '높음', max: '최고' };

interface Props {
  tick: number;
  score: number;
  rounds: number;
  mode: Mode;
  speed: Speed;
  paused: boolean;
  phase: Phase;
  onSpeed: (s: Speed) => void;
  onPause: () => void;
  /** The 머리띠 메뉴 items, in the spec's order. */
  children?: ReactNode;
}

/**
 * 머리띠, one set for every width: 경과 · 점수 · 사용 탄 · 일시정지 · 모드 딱지 · 배속 · 메뉴, then the 머리띠 메뉴. The page's CSS
 * spreads the menu inline on a wide screen and makes it a sheet over the lower tabs on a narrow one. Pause and speed
 * are not inputs, and opening the menu does not pause.
 */
export function HeadBand({ tick, score, rounds, mode, speed, paused, phase, onSpeed, onPause, children }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  // Opened, the focus goes in (no trap: the game keeps running); Esc closes it and the focus goes back to 메뉴.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('button:enabled, input:enabled, select:enabled')?.focus();
    const down = (e: KeyboardEvent) => {
      // Wherever the focus is; but the 랭킹 dialog (opened from the menu) takes its own Esc.
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);
  return (
    <div className="band">
      <header>
        <span className="brand">
          OBSERVER <small>포병 관측·목업</small>
        </span>
        <span className="stat">
          <span className="hb-label">경과 </span>
          <output aria-live="off" aria-label="경과">{clock(tick)}</output>
        </span>
        <span className="stat">
          <span className="hb-label">점수 </span>
          <output aria-live="off" aria-label="점수">{score}</output>
        </span>
        <span className="stat">
          <span className="hb-label">사용 탄 </span>
          <output aria-live="off" aria-label="사용 탄">{rounds}발</output>
        </span>
        <button type="button" aria-pressed={paused} disabled={phase !== 'live'} onClick={onPause}>
          {paused ? '재개' : '일시정지'}
        </button>
        <output aria-live="off" aria-label="모드" className="tag">
          {MODE_NAMES[mode]}
        </output>
        <button type="button" aria-label={`배속 ×${speed}`} onClick={() => onSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}>
          ×{speed}
        </button>
        <button ref={toggle} type="button" className="hb-toggle" aria-pressed={open} aria-controls="hb-menu" onClick={() => setOpen(!open)}>
          메뉴
        </button>
      </header>
      <section ref={menu} id="hb-menu" aria-label="머리띠 메뉴" className="hb-menu" data-open={open || undefined}>
        {children}
      </section>
    </div>
  );
}

/** 모드 전환 (F-14): an input, applied on the next tick, so not while paused or after the end. */
export function ModeSwitch({ mode, paused, phase, onMode }: { mode: Mode; paused: boolean; phase: Phase; onMode: (m: Mode) => void }) {
  const off = paused || phase === 'ended';
  return (
    <span role="group" aria-label="모드 전환">
      {(['training', 'standard'] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} disabled={off} onClick={() => onMode(m)}>
          {MODE_NAMES[m]}
        </button>
      ))}
    </span>
  );
}

/** 화질, the player's choice: it outlives a game. */
export function QualityPicker({ quality, onQuality }: { quality: Quality; onQuality: (q: Quality) => void }) {
  return (
    <span role="group" aria-label="화질">
      {(Object.keys(QUALITIES) as Quality[]).map((q) => (
        <button key={q} type="button" aria-pressed={q === quality} onClick={() => onQuality(q)}>
          {QUALITY_NAMES[q]}
        </button>
      ))}
    </span>
  );
}
