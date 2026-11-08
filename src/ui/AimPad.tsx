// 1밀 단추 (spec 모바일 세로, prototype A): one press = 1 mil, held = one step at once and then every 90 ms after 350 ms.
import { useEffect, useRef } from 'react';
import type { AimControl } from './aim';

const HOLD_MS = 350;
const REPEAT_MS = 90;
const PADS = [
  ['◀', '왼쪽 1밀', 0, -1],
  ['▶', '오른쪽 1밀', 0, 1],
  ['▲', '위 1밀', 1, 1],
  ['▼', '아래 1밀', 1, -1],
] as const;

export function AimPad({ aim }: { aim: AimControl }) {
  const timers = useRef<{ hold?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
  const stop = () => {
    clearTimeout(timers.current.hold);
    clearInterval(timers.current.repeat);
    timers.current = {};
  };
  useEffect(() => stop, []);
  return (
    <span role="group" aria-label="1밀 조준" className="aim-pad">
      {PADS.map(([text, name, axis, dir]) => {
        const step = () => aim.nudge(axis, dir);
        return (
          <button
            key={name}
            type="button"
            aria-label={name}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              stop();
              step();
              timers.current.hold = setTimeout(() => (timers.current.repeat = setInterval(step, REPEAT_MS)), HOLD_MS);
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onContextMenu={(e) => e.preventDefault()}
            // Enter/Space press the button without a pointer: one step (a pointer press has already stepped).
            onClick={(e) => e.detail === 0 && step()}
          >
            {text}
          </button>
        );
      })}
    </span>
  );
}
