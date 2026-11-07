// 예약 이벤트 큐: what the simulation will do at a later tick. Kept in the state (hashed), oldest first within a tick.
import type { SimState } from './types';

/** Append only: the state hash carries each act as its index here. */
export const ACTS = ['radio_check', 'check_reply', 'call_ack', 'loc_readback', 'desc_readback', 'mto', 'ready',
  'shot', 'shot_readback', 'impact', 'adjust_open', 'corr_readback'] as const;
export type Act = (typeof ACTS)[number];

export interface Scheduled {
  at: number; // tick it runs at
  act: Act;
}

/** Queues `act` for tick `at`, after everything already due by then (same tick: first scheduled, first run). */
export function schedule(s: SimState, at: number, act: Act): void {
  let i = s.queue.length;
  while (i > 0 && s.queue[i - 1]!.at > at) i--;
  s.queue.splice(i, 0, { at, act });
}

/** Takes the next act due by now, or undefined. */
export const takeDue = (s: SimState): Act | undefined => (s.queue[0] && s.queue[0].at <= s.tick ? s.queue.shift()!.act : undefined);
