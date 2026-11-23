// 실전의 복창 화면 (#120, #121): what the screen works out from the 무전 기록 and the simulation's 밀린 복창. Pure.
import type { Fuze, Input, MtoSlots, RadioEvent, Readbacks } from '@sim';

/** How long a 기러기 교신 to read back stays written in the 무전 기록: real time, the screen's number (`설계`, #120 Q2). */
export const SHOWN_MS = 4000;
/** 기러기's three transmissions that ask a readback, and the 정정 that stands for the 사격지휘통보. */
const ASKS: Record<string, string> = { mto: 'mto', shot: 'shot', rounds_complete: 'rounds_complete', mto_correction: 'mto' };

type Timed = RadioEvent & { at?: number };
type Line = Timed | { type: 'system' };

const slotsOf = (u: Timed['utterance']) => ('slots' in u ? (u.slots as Partial<MtoSlots>) : {});
const sameMto = (a: Timed['utterance'], b: Timed['utterance']) =>
  (['fuze', 'rounds', 'control', 'targetNumber'] as const).every((k) => slotsOf(a)[k] === slotsOf(b)[k]);

/** The lines covered at real time `now` (실전 only): a 기러기 교신 to read back, `SHOWN_MS` after it came in, until the
 * observer reads it back right (a later readback of its kind, with the same four values for a 사격지휘통보). */
export function hiddenLines(lines: readonly Line[], now: number, shownMs = SHOWN_MS): Set<number> {
  const out = new Set<number>();
  lines.forEach((l, i) => {
    if (l.type !== 'radio' || l.utterance.speaker !== 'fdc' || l.at === undefined || now - l.at < shownMs) return;
    const kind = ASKS[l.utterance.kind];
    if (!kind) return;
    const back = lines.slice(i + 1).some((b) => b.type === 'radio' && b.utterance.speaker === 'observer' && b.utterance.kind === kind && (kind !== 'mto' || sameMto(b.utterance, l.utterance)));
    if (!back) out.add(i);
  });
  return out;
}

export type Owed = 'mto' | 'shot' | 'rounds_complete';
/** The owed readbacks, first come first: in a mission 기러기 says 사격지휘통보, then 하나발 떳다, then 마감탄 떳다. */
export const owedOf = (r: Readbacks | null): Owed[] => (r ? (['mto', 'shot', 'rounds_complete'] as const).filter((k) => r[k]) : []);

/** The 사격지휘통보 readback as put in the box: the 신관 tapped, the 발수 and 표적번호 typed, 지명사 ticked. */
export interface Entry {
  fuze: Fuze | null;
  rounds: string;
  amc: boolean;
  tn: string;
}

/** The `readback` input for the asked readback; null while the 사격지휘통보 is not filled in (발수 1–5, 표적번호 four digits). */
export function readbackInput(asked: Owed, e: Entry): Input | null {
  if (asked !== 'mto') return { a: 'readback', v: [asked] };
  if (!e.fuze || !/^[1-5]$/.test(e.rounds) || !/^\d{4}$/.test(e.tn)) return null;
  return { a: 'readback', v: ['mto', e.fuze, Number(e.rounds), e.amc ? 'amc' : 'ready', Number(e.tn)] };
}

/** 틀린 칸: the names of the fields where a sent 사격지휘통보 readback differs from the right one. */
export const wrongFields = (sent: MtoSlots, right: MtoSlots): string[] =>
  ([['신관', 'fuze'], ['발수', 'rounds'], ['지명사', 'control'], ['표적번호', 'targetNumber']] as const).filter(([, k]) => sent[k] !== right[k]).map(([name]) => name);
