// 조준 (demo lines 1326–1327, 1373–1385): the view's live line of sight in mils, moved by keys and dragging, and the
// 조준 입력 it sends: 0.1 mil integers, only once the aim is 1 mil or more from the value sent last.
import type { Input, ReadonlySimState } from '@sim';
import { fovOf } from '@render/projection';

// Mils per arrow press: [azimuth, elevation]. Shift multiplies azimuth by 10 and elevation by 5.
const KEY_MIL = { eye: [20, 5], bino: [2, 1] } as const;
const SHIFT = [10, 5] as const;
const EL_MAX = 200;
const ARROWS = new Map<string, readonly [axis: 0 | 1, dir: 1 | -1]>([
  ['ArrowRight', [0, 1]],
  ['ArrowLeft', [0, -1]],
  ['ArrowUp', [1, 1]],
  ['ArrowDown', [1, -1]],
]);

export interface AimControl {
  /** Live aim: azimuth `h` 0 ≤ h < 6400, elevation `p` within ±200, in mils. */
  aim(): { h: number; p: number };
  /** 쌍안경 as intended: the value sent but not yet stepped, otherwise the simulation's. */
  bino(): boolean;
  /** Moves the aim for an arrow key; false for any other key. */
  key(key: string, shift: boolean): boolean;
  /** Drag by (dx, dy) CSS pixels on a view `cssWidth` wide: the terrain follows the pointer. */
  drag(dx: number, dy: number, cssWidth: number): void;
  /** 1밀 단추: exactly 1 mil on one axis from the value sent last, so each press sends one 조준 입력. */
  nudge(axis: 0 | 1, dir: 1 | -1): void;
  /** Asks for 쌍안경 the other way. */
  toggleBino(): void;
  /** 레이저 on the live aim (the R key and the button). */
  lase(): void;
}

/** `state` is the simulation's live state; nothing is sent until the aim moves from its aim (0.1 mils). */
export function createAimControl(state: Pick<ReadonlySimState, 'aim' | 'tick' | 'bino'>, send: (input: Input) => void): AimControl {
  let h = state.aim.az / 10;
  let p = state.aim.el / 10;
  let last = { ...state.aim };
  // Inputs apply on the next tick: until the tick moves on, the bino value sent last is the intended one.
  let sentBino: { on: boolean; tick: number } | null = null;
  const bino = () => (sentBino && sentBino.tick === state.tick ? sentBino.on : state.bino);
  const moved = (dh: number, dp: number) => {
    h = (((h + dh) % 6400) + 6400) % 6400;
    p = Math.min(EL_MAX, Math.max(-EL_MAX, p + dp));
    const az = Math.round(h * 10) % 64000;
    const el = Math.round(p * 10);
    const dAz = Math.abs(az - last.az);
    if (Math.min(dAz, 64000 - dAz) < 10 && Math.abs(el - last.el) < 10) return;
    last = { az, el };
    send({ a: 'cam', v: [az, el] });
  };
  return {
    aim: () => ({ h, p }),
    bino,
    key(key, shift) {
      const arrow = ARROWS.get(key);
      if (!arrow) return false;
      const [axis, dir] = arrow;
      const step = KEY_MIL[bino() ? 'bino' : 'eye'][axis] * (shift ? SHIFT[axis] : 1) * dir;
      if (axis === 0) moved(step, 0);
      else moved(0, step);
      return true;
    },
    drag(dx, dy, cssWidth) {
      const k = fovOf(bino()) / cssWidth;
      moved(-dx * k, dy * k);
    },
    nudge(axis, dir) {
      h = last.az / 10; // an unsent sub-mil drag remainder is dropped
      p = last.el / 10;
      if (axis === 0) moved(dir, 0);
      else moved(0, dir);
    },
    lase() {
      send({ a: 'lase', v: [Math.round(h * 10) % 64000, Math.round(p * 10)] });
    },
    toggleBino() {
      sentBino = { on: !bino(), tick: state.tick };
      send({ a: 'bino', v: [sentBino.on ? 1 : 0] });
    },
  };
}
