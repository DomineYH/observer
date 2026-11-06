// 조준 (demo lines 1326–1327, 1373–1385): the view's live line of sight in mils, moved by keys and dragging, and the
// 조준 입력 it sends: 0.1 mil integers, only once the aim is 1 mil or more from the value sent last.
import type { Input } from '@sim';
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
  /** Moves the aim for an arrow key; false for any other key. */
  key(key: string, shift: boolean, bino: boolean): boolean;
  /** Drag by (dx, dy) CSS pixels on a view `cssWidth` wide: the terrain follows the pointer. */
  drag(dx: number, dy: number, cssWidth: number, bino: boolean): void;
  /** Asks for 쌍안경 the other way from `on`, the simulation's current state. */
  toggleBino(on: boolean): void;
}

/** `initial` is the simulation's aim in 0.1 mils; nothing is sent until the aim moves from it. */
export function createAimControl(initial: { az: number; el: number }, send: (input: Input) => void): AimControl {
  let h = initial.az / 10;
  let p = initial.el / 10;
  let last = initial;
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
    key(key, shift, bino) {
      const arrow = ARROWS.get(key);
      if (!arrow) return false;
      const [axis, dir] = arrow;
      const step = KEY_MIL[bino ? 'bino' : 'eye'][axis] * (shift ? SHIFT[axis] : 1) * dir;
      if (axis === 0) moved(step, 0);
      else moved(0, step);
      return true;
    },
    drag(dx, dy, cssWidth, bino) {
      const k = fovOf(bino) / cssWidth;
      moved(-dx * k, dy * k);
    },
    toggleBino: (on) => send({ a: 'bino', v: [on ? 0 : 1] }),
  };
}
