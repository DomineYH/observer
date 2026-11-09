// 교신 한 마디: the values the simulation announces. Sentences are made outside the simulation (ADR 0004).
// Identifier lists are values so the procedure and the tests can enumerate them.

export const SPEAKERS = ['observer', 'fdc'] as const;
export const ENDINGS = ['over', 'wait', 'none'] as const;
export const RADIO_KINDS = [
  'radio_check',
  'radio_check_reply',
  'call',
  'call_ack',
  'location',
  'description',
  'danger_close_applied',
  'danger_close_adjust_first',
  'danger_close_resend',
  'mto',
  'ready',
  'fire',
  'shot',
  'rounds_complete',
  'correction',
  'repeat',
  'repeat_ack',
  'end_of_mission',
  'shift',
  'move_notice',
  'position_report',
] as const;

export const WARNINGS = ['adjust', 'ffe'] as const;
export const LOCATION_METHODS = ['grid', 'polar'] as const;
export const FUZE_REQUESTS = ['none', 'quick', 'vt'] as const;
export const FUZES = ['quick', 'vt'] as const;
export const CONTROLS = ['ready', 'amc'] as const;
export const LATERAL_DIRS = ['left', 'right'] as const;
export const RANGE_DIRS = ['drop', 'add'] as const;
export const NEXTS = ['adjust', 'ffe'] as const;
export const EFFECTS = ['destroyed', 'neutralized', 'ineffective'] as const;
export const ACTIVITIES = ['attacking', 'moving', 'halted', 'firing'] as const;
export const TARGET_TYPES = ['infantry', 'apc', 'mortar', 'unknown'] as const;
export const TARGET_NAMES = ['infantry', 'recon', 'apc', 'mortar', 'unknown'] as const;
export const UNITS = ['platoon', 'platoon_minus', 'squad', 'men', 'vehicles', 'tubes', 'none'] as const;

/** Integer slot bounds (inclusive) and snap step. A 0 correction is not a value: the pair is absent. */
export const SLOT_RANGES = {
  easting: { min: 0, max: 9999, step: 1 },
  northing: { min: 0, max: 9999, step: 1 },
  azimuth: { min: 0, max: 6399, step: 1 },
  direction: { min: 0, max: 6399, step: 1 },
  distance: { min: 100, max: 15000, step: 10 },
  lateral: { min: 10, max: 800, step: 10 },
  range: { min: 50, max: 1500, step: 50 },
  rounds: { min: 1, max: 5, step: 1 },
  count: { min: 1, max: 99, step: 1 },
  targetNumber: { min: 0, max: 9999, step: 1 },
} as const;

export type Speaker = (typeof SPEAKERS)[number];
export type Ending = (typeof ENDINGS)[number];
export type RadioKind = (typeof RADIO_KINDS)[number];
export type Warning = (typeof WARNINGS)[number];
export type FuzeRequest = (typeof FUZE_REQUESTS)[number];
export type Fuze = (typeof FUZES)[number];
export type Control = (typeof CONTROLS)[number];
export type LateralDir = (typeof LATERAL_DIRS)[number];
export type RangeDir = (typeof RANGE_DIRS)[number];
export type Next = (typeof NEXTS)[number];
export type Effect = (typeof EFFECTS)[number];
export type Activity = (typeof ACTIVITIES)[number];
export type TargetType = (typeof TARGET_TYPES)[number];
export type TargetName = (typeof TARGET_NAMES)[number];
export type Unit = (typeof UNITS)[number];
export type Flag = 0 | 1;

/** 표적성질: unknown has no activity or size; only men·vehicles·tubes carry a count. */
export type Target =
  | { targetType: 'unknown' }
  | { targetType: Exclude<TargetType, 'unknown'>; activity: Activity; unit: Exclude<Unit, 'men' | 'vehicles' | 'tubes'> }
  | { targetType: Exclude<TargetType, 'unknown'>; activity: Activity; unit: 'men' | 'vehicles' | 'tubes'; count: number };

/** 수정량: an axis with value 0 is absent, so left/right never comes with 0. */
export type Corrections = ({ lateralDir?: never; lateral?: never } | { lateralDir: LateralDir; lateral: number }) &
  ({ rangeDir?: never; range?: never } | { rangeDir: RangeDir; range: number });

/** 효과 보고의 표적 이름: only infantry and mortar have a unit name to add. */
export type TargetNameSlots =
  | { targetName: 'infantry' | 'mortar'; named: Flag }
  | { targetName: 'recon' | 'apc' | 'unknown' };

export type RadioBody =
  | { kind: 'radio_check' | 'radio_check_reply' | 'fire' | 'shot' | 'rounds_complete' | 'move_notice' }
  | { kind: 'danger_close_applied' | 'danger_close_adjust_first' | 'danger_close_resend' }
  | { kind: 'call' | 'call_ack'; slots: { warning: Warning } }
  | {
      kind: 'location';
      slots: { method: 'grid'; easting: number; northing: number } | { method: 'polar'; azimuth: number; distance: number };
    }
  | { kind: 'description'; slots: Target & { rounds: number; fuzeRequest: FuzeRequest; control: Control; dangerClose: Flag } }
  | { kind: 'mto'; slots: { fuze: Fuze; rounds: number; control: Control; targetNumber: number } }
  | { kind: 'ready'; slots: { fuze?: Fuze } }
  | { kind: 'correction'; slots: Corrections & { direction?: number; next: Next } }
  | { kind: 'repeat'; slots: TargetNameSlots & { effect: Effect; rounds: number } }
  | { kind: 'repeat_ack'; slots: { rounds: number } }
  | { kind: 'end_of_mission'; slots: TargetNameSlots & { effect: Effect } }
  | {
      kind: 'shift';
      slots: Target & Corrections & { targetNumber: number; direction: number; rounds: number; dangerClose: Flag };
    }
  | { kind: 'position_report'; slots: { easting: number; northing: number } };

/** 교신 한 마디. 끝말 is chosen by the procedure. The observer's callsign and the grid letters are not here. */
export type RadioUtterance = { speaker: Speaker; ending: Ending } & RadioBody;

type SlotsOf<B> = B extends { slots: infer S } ? (S extends unknown ? keyof S : never) : never;
export type SlotName = SlotsOf<RadioBody>;

type SlotsOfKind<K extends RadioKind> = Extract<RadioBody, { kind: K; slots: unknown }>['slots'];
export type LocationSlots = SlotsOfKind<'location'>;
export type DescriptionSlots = SlotsOfKind<'description'>;
export type MtoSlots = SlotsOfKind<'mto'>;
export type CorrectionSlots = SlotsOfKind<'correction'>;
export type ShiftSlots = SlotsOfKind<'shift'>;

export interface RadioEvent {
  type: 'radio';
  tick: number; // the simulation's tick when the step that said it ends
  utterance: RadioUtterance;
}
