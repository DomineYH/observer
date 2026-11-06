// 작전 개시 from the panel. Pure, so the intended post can be tested without a browser.
import type { Input, ReadonlySimState } from '@sim';

/** `start` at the intended post, read when 작전 개시 is pressed: the last `pick` sent but not yet stepped, otherwise
 * the post in `live`, the simulation's live state (not the panel's snapshot, which lags up to 100 ms).
 * An invalid pick still queued goes into `start` too; the simulation ignores both and the game stays in prep until
 * the next 작전 개시, which uses the post. Intended: the ui does not copy the simulation's edge rule. */
export function startInput(live: Pick<ReadonlySimState, 'op'>, queued: readonly Input[]): Input {
  const pick = queued.findLast((i) => i.a === 'pick');
  return { a: 'start', v: pick?.v ? [...pick.v] : [live.op.x, live.op.y] };
}
