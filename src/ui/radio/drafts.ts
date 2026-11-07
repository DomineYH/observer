// 입력기 초안: one form's values as the input to send and the observer's 교신 한 마디 the simulation will say for it, so
// the preview is made from the same utterance as the log line (F-07). Pure.
import type { Activity, Control, Flag, FuzeRequest, Input, RadioUtterance, Target, TargetType, Unit, UnitType, Warning } from '@sim';

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

export function descDraft({ target, ...head }: DescForm): Draft {
  const t = target.targetType === 'unknown' ? [] : [target.activity, target.unit, ...('count' in target ? [target.count] : [])];
  return {
    input: { a: 'desc', v: [head.rounds, head.fuzeRequest, head.control, head.dangerClose, target.targetType, ...t] },
    utterance: { speaker: 'observer', ending: 'over', kind: 'description', slots: { ...head, ...target } },
  };
}

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
