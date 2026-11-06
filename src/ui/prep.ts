// 작전 개시 from the panel. Pure, so the intended post can be tested without a browser.
import type { Input, Point } from '@sim';

/** `start` at the intended post: the last `pick` sent but not yet stepped (the panel's state can lag behind it),
 * otherwise the simulation's post. */
export function startInput(op: Point, queued: readonly Input[]): Input {
  const pick = queued.findLast((i) => i.a === 'pick');
  return { a: 'start', v: pick?.v ? [...pick.v] : [op.x, op.y] };
}
