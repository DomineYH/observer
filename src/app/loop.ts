import { STEP_MS, type Sim } from '@sim';

const STEP_S = STEP_MS / 1000;
const MAX_FRAME_S = 0.1; // longer frames lose the extra real time
const MAX_STEPS = 40; // safety net per frame

/** Fixed-step frame loop (demo lines 1322–1346). Pausing is simply not calling step. Returns a stop function. */
export function startLoop(sim: Sim, onFrame: (now: number) => void): () => void {
  let last = performance.now();
  let acc = 0;
  let id = 0;
  const frame = (now: number) => {
    acc += Math.min(MAX_FRAME_S, (now - last) / 1000);
    last = now;
    let n = 0;
    while (acc >= STEP_S && n < MAX_STEPS) {
      sim.step([]);
      acc -= STEP_S;
      n++;
    }
    if (n >= MAX_STEPS) acc = 0;
    onFrame(now);
    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(id);
}
