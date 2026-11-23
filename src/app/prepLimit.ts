// 작전 준비 시간 제한 (#115 Q6·Q9, #130 Q4): 실전 only, 300 s of real time (배속 aside), a screen number kept out of the
// 실전 수치 and the 실전 자료 판. Neither the simulation nor the 재생 자료 knows of it.
import type { Mode, ReadonlySimState } from '@sim';
import { startInput } from '@ui/prep';
import type { Game } from './game';

export const PREP_LIMIT_MS = 300_000; // 설계

/** `stretch` is the 느린 배속's stretch of real time (`stretchOf`), read each time: 1 leaves the 300 s. */
export function prepLimit(now: () => number = Date.now, stretch: () => number = () => 1) {
  let since: number | null = null;
  /** The ms left of 실전's 작전 준비; null when no limit applies (훈련·표준, or after 작전 개시). */
  const left = ({ mode, phase }: Pick<ReadonlySimState, 'mode' | 'phase'>) =>
    mode === 'combat' && phase === 'prep' && since !== null ? Math.max(0, PREP_LIMIT_MS * stretch() - (now() - since)) : null;
  return {
    left,
    /** Counting starts the first time 실전 is chosen and goes on through new games and leaving 실전. */
    chose(m: Mode) {
      if (m === 'combat') since ??= now();
    },
    /** Before each step: once the limit is out, the 작전 개시 button's input (관측소 후보, else the planned post). */
    check(game: Game) {
      if (left(game.sim.state) === 0 && !game.session.queued.some((i) => i.a === 'start')) game.session.send(startInput(game.sim.state, game.session.queued));
    },
  };
}
