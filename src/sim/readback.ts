// 실전의 복창 (ADR 0018, #121): the player reads back 기러기's 사격지휘통보, 하나발 떳다 and 마감탄 떳다; the simulation
// judges it. No draw, no score, no deadline: a wrong 사격지휘통보 readback brings 기러기's 정정 after a fixed delay.
import { secTicks, type Ctx } from './procedure';
import { schedule } from './queue';
import type { Control, Fuze } from './radio';
import type { SimState } from './types';

/** Applies `readback` if the mission owes it and no 정정 of it is on the way; false means ignored. `v` is valid. */
export function applyReadback(s: SimState, ctx: Ctx, v: readonly (number | string)[]): boolean {
  const m = s.missions.at(-1);
  const r = m?.readback; // null outside a combat game: always ignored there
  const kind = v[0] as 'mto' | 'shot' | 'rounds_complete';
  if (!r || !r[kind] || (kind === 'mto' && r.correcting)) return false;
  if (kind !== 'mto') {
    ctx.say({ speaker: 'observer', ending: 'wait', kind });
    r[kind] = false;
    return true;
  }
  const [, fuze, rounds, control, targetNumber] = v as [string, Fuze, number, Control, number];
  ctx.say({ speaker: 'observer', ending: 'wait', kind: 'mto', slots: { fuze, rounds, control, targetNumber } }); // as put in
  const mto = m!.mto!;
  if (fuze === mto.fuze && rounds === mto.rounds && control === mto.control && targetNumber === mto.targetNumber) r.mto = false;
  else {
    r.correcting = true; // still owed
    schedule(s, s.tick + secTicks(ctx.combat!.correctionDelayS), 'mto_correction');
  }
  return true;
}

/** 기러기's 정정: "정정" and the right 사격지휘통보; the readback is taken again from now. */
export function runCorrection(s: SimState, ctx: Ctx): void {
  const m = s.missions.at(-1)!;
  ctx.say({ speaker: 'fdc', ending: 'wait', kind: 'mto_correction', slots: { ...m.mto! } });
  m.readback!.correcting = false;
}
