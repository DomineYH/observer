// 입력기 초안: one form's values as the input to send and the observer's 교신 한 마디 the simulation will say for it, so
// the preview is made from the same utterance as the log line (F-07). Pure.
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import type { Activity, Control, Effect, Flag, FuzeRequest, Input, RadioUtterance, Target, TargetNameSlots, TargetType, Unit, UnitType, Warning } from '@sim';

const W = RADIO_GRAMMAR.tables;

export interface Draft {
  input: Input;
  utterance: RadioUtterance;
}

export interface DescForm {
  rounds: number;
  fuzeRequest: FuzeRequest;
  control: Control;
  dangerClose: Flag;
  target: Target;
}

export const callDraft = (warning: Warning): Draft => ({
  input: { a: 'call', v: [warning] },
  utterance: { speaker: 'observer', ending: 'over', kind: 'call', slots: { warning } },
});

export const locDraft = (easting: number, northing: number): Draft => ({
  input: { a: 'loc', v: ['grid', easting, northing] },
  utterance: { speaker: 'observer', ending: 'over', kind: 'location', slots: { method: 'grid', easting, northing } },
});

/** 극좌표법: 방위각 mils and 거리 m as typed; the simulation (and so the sentence) takes 거리 to the nearest 10 m. */
export const polarDraft = (azimuth: number, distance: number): Draft => ({
  input: { a: 'loc', v: ['polar', azimuth, distance] },
  utterance: { speaker: 'observer', ending: 'over', kind: 'location', slots: { method: 'polar', azimuth, distance: Math.round(distance / 10) * 10 } },
});

/** A target as input values (the tail of `desc` and `shift`). */
export const targetValues = (t: Target): (string | number)[] =>
  t.targetType === 'unknown' ? [t.targetType] : [t.targetType, t.activity, t.unit, ...('count' in t ? [t.count] : [])];

/** A 표적성질 choice as the form lists it. */
export const targetLabel = (t: Target) =>
  t.targetType === 'unknown'
    ? W.targetType.unknown.text
    : `${W.activity[t.activity].text}인 적 ${W.targetType[t.targetType].text}${t.unit === 'none' ? '' : ` ${'count' in t ? t.count : ''}${W.unit[t.unit].text}`}`;

export function descDraft({ target, ...head }: DescForm): Draft {
  return {
    input: { a: 'desc', v: [head.rounds, head.fuzeRequest, head.control, head.dangerClose, ...targetValues(target)] },
    utterance: { speaker: 'observer', ending: 'over', kind: 'description', slots: { ...head, ...target } },
  };
}

/** 임무끝 with the 효과 seen; `name` is the unit's name as the ui reads it (effect.ts reportName). */
export const eomDraft = (effect: Effect, name: TargetNameSlots): Draft => ({
  input: { a: 'eom', v: [effect] },
  utterance: { speaker: 'observer', ending: 'none', kind: 'end_of_mission', slots: { ...name, effect } },
});

/** 재효력사, 동제원, 포대 `rounds`발 with the 효과 seen. */
export const repeatDraft = (effect: Effect, rounds: number, name: TargetNameSlots): Draft => ({
  input: { a: 'repeat', v: [effect, rounds] },
  utterance: { speaker: 'observer', ending: 'over', kind: 'repeat', slots: { ...name, effect, rounds } },
});

/** 발사 (준비 쏴): the "준비 쏴" button and the F key send this same input. */
export const FIRE: Input = { a: 'fire' };
export const fireKey = (key: string): Input | null => (key === 'f' || key === 'F' ? FIRE : null);

const TYPE: Record<UnitType, Exclude<TargetType, 'unknown'>> = { inf: 'infantry', recon: 'infantry', apc: 'apc', mortar: 'mortar' };
const COUNTED: readonly Unit[] = ['men', 'vehicles', 'tubes'];

interface Seen {
  type: UnitType;
  activity: Activity;
  intel: { stage: number; size: { unit: Unit; n: number } | null };
}

/** 표적성질 choices: only what has been observed (병종 from stage 2, 규모 from stage 3); 미상 표적 is always last. */
export function targetOptions(platoons: readonly Seen[]): Target[] {
  const out = new Map<string, Target>();
  for (const { type, activity, intel } of platoons) {
    if (intel.stage < 2) continue;
    const size = intel.size;
    const t: Target = !size
      ? { targetType: TYPE[type], activity, unit: 'none' }
      : COUNTED.includes(size.unit)
        ? { targetType: TYPE[type], activity, unit: size.unit as 'men', count: size.n }
        : { targetType: TYPE[type], activity, unit: size.unit as 'platoon' };
    out.set(JSON.stringify(t), t);
  }
  return [...out.values(), { targetType: 'unknown' }];
}

const GRID4 = /^\d{4}$/;
/** 위치 보고: 동·북 as typed, four digits each, else nothing to send. */
export function posDraft(e: string, n: string): Draft | null {
  if (!GRID4.test(e) || !GRID4.test(n)) return null;
  const slots = { easting: Number(e), northing: Number(n) };
  return { input: { a: 'pos', v: [slots.easting, slots.northing] }, utterance: { speaker: 'observer', ending: 'over', kind: 'position_report', slots } };
}
export const POS_SKIP: Input = { a: 'pos_skip' };
