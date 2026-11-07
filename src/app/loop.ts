import { STEP_MS } from '@sim';

const MAX_FRAME_MS = 100; // longer frames lose the extra real time
const MAX_STEPS = 40; // safety net per frame

/** How many ticks this frame runs (demo lines 1336–1338): `acc` carries the real time not yet stepped. */
export function frameSteps(acc: { ms: number }, dtMs: number): number {
  acc.ms += Math.max(0, Math.min(MAX_FRAME_MS, dtMs)); // the first frame can be stamped before the loop started
  let n = 0;
  while (acc.ms >= STEP_MS && n < MAX_STEPS) {
    acc.ms -= STEP_MS;
    n++;
  }
  if (n >= MAX_STEPS) acc.ms = 0;
  return n;
}

/** Fixed-step frame loop. Pausing is simply not calling step. Returns a stop function. */
export function startLoop(step: () => void, onFrame: (now: number) => void): () => void {
  let last = performance.now();
  const acc = { ms: 0 };
  let id = 0;
  const frame = (now: number) => {
    for (let n = frameSteps(acc, now - last); n > 0; n--) step();
    last = now;
    onFrame(now);
    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(id);
}
