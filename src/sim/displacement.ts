// 포대의 진지 변환 (F-20, #123 규칙 3), in a combat game only: the battery remembers its first round at a position; once
// the 체류 한도 has passed since, it displaces as soon as no fire whose 사격준비 끝 is out is still being fired, and for
// 진지 변환 시간 × 배율 no 사격준비 끝 comes. Everything else is taken as ever. No draw; the battery's place, its sheaf
// and the missions' bias stay, and no gun is lost.
import { secTicks, type Ctx } from './procedure';
import { schedule } from './queue';
import type { SimState } from './types';

/** A fire whose 사격준비 끝 is out: 준비 쏴 awaited or the round about to go, or a 효력사 before 마감탄 떳다. */
const firing = (s: SimState) => s.radio.stage === 'ready' || s.queue.some((q) => q.act === 'shot' || q.act === 'rounds_complete');

/** Before the tick's due acts: the 진지 변환 is over, and the stay counts again from the next first round. */
export function displacementEnds(s: SimState, ctx: Ctx): void {
  const b = s.battery;
  if (!b || b.until < 0 || s.tick < b.until) return;
  b.until = -1;
  b.firstShot = -1;
  ctx.say({ speaker: 'fdc', ending: 'none', kind: 'displaced' });
}

/** After the tick's due acts: past the 체류 한도 with nothing being fired, the 진지 변환 starts. */
export function displacementStarts(s: SimState, ctx: Ctx): void {
  const b = s.battery;
  const n = ctx.combat;
  if (!b || !n || b.until >= 0 || b.firstShot < 0 || s.tick - b.firstShot < secTicks(n.stayLimitS) || firing(s)) return;
  b.until = s.tick + secTicks(ctx.guns.displacementS * n.displacementFactor);
  ctx.say({ speaker: 'fdc', ending: 'wait', kind: 'displacing' });
}

/** A 사격준비 끝 due while displacing waits for the end of it (it runs after 진지 변환 끝 that tick); true if held. */
export function holdReady(s: SimState): boolean {
  const b = s.battery;
  if (!b || b.until < 0) return false;
  schedule(s, b.until, 'ready');
  return true;
}
