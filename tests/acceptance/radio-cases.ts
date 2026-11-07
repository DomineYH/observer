// Slot cases for the F-08 sentence tests: every enum combination per kind, integers at boundary values.
import {
  ACTIVITIES,
  CONTROLS,
  EFFECTS,
  FUZE_REQUESTS,
  FUZES,
  LATERAL_DIRS,
  NEXTS,
  RANGE_DIRS,
  SLOT_RANGES,
  WARNINGS,
} from '@sim';
import type { RadioKind, RadioUtterance } from '@sim';

type IntSlot = keyof typeof SLOT_RANGES;
type Slots = Record<string, string | number>;
/** One slot axis: its alternatives, given the value of its integer slot (if it has one). */
interface Axis {
  int?: IntSlot;
  options: (n: number) => Slots[];
}

const REPRESENTATIVE: Record<IntSlot, number> = {
  easting: 4720,
  northing: 1830,
  azimuth: 4720,
  direction: 4720,
  distance: 2500,
  lateral: 60,
  range: 200,
  rounds: 3,
  count: 7,
  targetNumber: 1001,
};

/** Minimum, maximum, 0 when in range, and a representative value. */
function boundaries(slot: IntSlot): number[] {
  const { min, max } = SLOT_RANGES[slot];
  return [...new Set([min, max, ...(min <= 0 ? [0] : []), REPRESENTATIVE[slot]])];
}

const en = (slot: string, values: readonly (string | number)[], optional = false): Axis => ({
  options: () => [...(optional ? [{}] : []), ...values.map((v) => ({ [slot]: v }))],
});
const int = (slot: IntSlot, optional = false): Axis => ({ int: slot, options: (n) => [...(optional ? [{}] : []), { [slot]: n }] });
const pair = (dirSlot: string, dirs: readonly string[], slot: IntSlot): Axis => ({
  int: slot,
  options: (n) => [{}, ...dirs.map((d) => ({ [dirSlot]: d, [slot]: n }))],
});
const TARGET: Axis = {
  int: 'count',
  options: (n) => [
    { targetType: 'unknown' },
    ...(['infantry', 'apc', 'mortar'] as const).flatMap((targetType) =>
      ACTIVITIES.flatMap((activity) => [
        ...(['platoon', 'platoon_minus', 'squad', 'none'] as const).map((unit) => ({ targetType, activity, unit })),
        ...(['men', 'vehicles', 'tubes'] as const).map((unit) => ({ targetType, activity, unit, count: n })),
      ]),
    ),
  ],
};
const NAME: Axis = {
  options: () => [
    ...(['infantry', 'mortar'] as const).flatMap((targetName) => [0, 1].map((named) => ({ targetName, named }))),
    ...(['recon', 'apc', 'unknown'] as const).map((targetName) => ({ targetName })),
  ],
};
const CORRECTIONS = [pair('lateralDir', LATERAL_DIRS, 'lateral'), pair('rangeDir', RANGE_DIRS, 'range')];
const FLAG = [0, 1] as const;

/** Alternative slot shapes per kind; a kind without slots has one empty shape. */
const SHAPES: Record<RadioKind, Axis[][]> = {
  radio_check: [[]],
  radio_check_reply: [[]],
  call: [[en('warning', WARNINGS)]],
  call_ack: [[en('warning', WARNINGS)]],
  location: [
    [en('method', ['grid']), int('easting'), int('northing')],
    [en('method', ['polar']), int('azimuth'), int('distance')],
  ],
  description: [[TARGET, int('rounds'), en('fuzeRequest', FUZE_REQUESTS), en('control', CONTROLS), en('dangerClose', FLAG)]],
  danger_close_applied: [[]],
  danger_close_adjust_first: [[]],
  danger_close_resend: [[]],
  mto: [[en('fuze', FUZES), int('rounds'), en('control', CONTROLS), int('targetNumber')]],
  ready: [[en('fuze', FUZES, true)]],
  fire: [[]],
  shot: [[]],
  rounds_complete: [[]],
  correction: [[int('direction', true), ...CORRECTIONS, en('next', NEXTS)]],
  repeat: [[NAME, en('effect', EFFECTS), int('rounds')]],
  repeat_ack: [[int('rounds')]],
  end_of_mission: [[NAME, en('effect', EFFECTS)]],
  shift: [[int('targetNumber'), int('direction'), ...CORRECTIONS, TARGET, int('rounds'), en('dangerClose', FLAG)]],
  move_notice: [[]],
  position_report: [[int('easting'), int('northing')]],
};

/** Full product of the axes, with the integer of axis `vary` at each boundary value and every other integer representative. */
function expand(axes: Axis[], vary: number): Slots[] {
  let out: Slots[] = [{}];
  axes.forEach((axis, j) => {
    const ns = axis.int === undefined ? [0] : j === vary ? boundaries(axis.int) : [REPRESENTATIVE[axis.int]];
    const options = ns.flatMap((n) => axis.options(n));
    out = out.flatMap((base) => options.map((o) => ({ ...base, ...o })));
  });
  return out;
}

/** Every slot case of a kind: the enum product, then each integer slot through its boundary values. */
export function slotCases(kind: RadioKind): Slots[] {
  return SHAPES[kind].flatMap((axes) => [expand(axes, -1), ...axes.map((a, j) => (a.int ? expand(axes, j) : []))].flat());
}

/** Builds an utterance from a generated case. The generator follows the slot types, which a plain record cannot show. */
export const utterance = (u: Pick<RadioUtterance, 'speaker' | 'ending'>, kind: RadioKind, slots: Slots): RadioUtterance =>
  ({ ...u, kind, ...(SHAPES[kind][0]?.length ? { slots } : {}) }) as RadioUtterance;

const o = { speaker: 'observer', ending: 'over' } as const;
const fdcOver = { speaker: 'fdc', ending: 'over' } as const;
const fdcWait = { speaker: 'fdc', ending: 'wait' } as const;
const obsWait = { speaker: 'observer', ending: 'wait' } as const;
const fdcNone = { speaker: 'fdc', ending: 'none' } as const;
const obsNone = { speaker: 'observer', ending: 'none' } as const;
const PLATOON = { targetType: 'infantry', activity: 'attacking', unit: 'platoon' } as const;

/** The fixed list for the wording snapshot: PRD 4.3 flow first, then every pattern and optional element. */
export const SNAPSHOT_CASES: RadioUtterance[] = [
  // PRD 4.3 (spec-corrected)
  { ...fdcOver, kind: 'radio_check' },
  { ...o, kind: 'radio_check_reply' },
  { ...o, kind: 'call', slots: { warning: 'adjust' } },
  { ...fdcOver, kind: 'call_ack', slots: { warning: 'adjust' } },
  { ...o, kind: 'location', slots: { method: 'grid', easting: 2345, northing: 6789 } },
  { ...fdcOver, kind: 'location', slots: { method: 'grid', easting: 2345, northing: 6789 } },
  { ...o, kind: 'description', slots: { ...PLATOON, rounds: 3, fuzeRequest: 'none', control: 'amc', dangerClose: 0 } },
  { ...fdcWait, kind: 'description', slots: { ...PLATOON, rounds: 3, fuzeRequest: 'none', control: 'amc', dangerClose: 0 } },
  { ...fdcWait, kind: 'mto', slots: { fuze: 'vt', rounds: 1, control: 'amc', targetNumber: 1001 } },
  { ...fdcNone, kind: 'ready', slots: {} },
  { ...obsNone, kind: 'fire' },
  { ...fdcOver, kind: 'shot' },
  { ...obsWait, kind: 'shot' },
  { ...o, kind: 'correction', slots: { direction: 4720, lateralDir: 'right', lateral: 60, rangeDir: 'drop', range: 200, next: 'ffe' } },
  { ...fdcWait, kind: 'correction', slots: { direction: 4720, lateralDir: 'right', lateral: 60, rangeDir: 'drop', range: 200, next: 'ffe' } },
  { ...fdcNone, kind: 'ready', slots: { fuze: 'vt' } },
  { ...fdcOver, kind: 'rounds_complete' },
  { ...obsWait, kind: 'rounds_complete' },
  { ...o, kind: 'repeat', slots: { targetName: 'infantry', named: 1, effect: 'neutralized', rounds: 2 } },
  { ...fdcWait, kind: 'repeat_ack', slots: { rounds: 2 } },
  { ...obsNone, kind: 'end_of_mission', slots: { targetName: 'infantry', named: 1, effect: 'destroyed' } },
  {
    ...o,
    kind: 'shift',
    slots: {
      targetNumber: 1001,
      direction: 4720,
      lateralDir: 'right',
      lateral: 200,
      rangeDir: 'drop',
      range: 100,
      targetType: 'apc',
      activity: 'moving',
      unit: 'vehicles',
      count: 2,
      rounds: 3,
      dangerClose: 0,
    },
  },
  { ...fdcWait, kind: 'mto', slots: { fuze: 'quick', rounds: 3, control: 'ready', targetNumber: 1002 } },
  { ...o, kind: 'description', slots: { ...PLATOON, rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 1 } },
  { ...fdcOver, kind: 'danger_close_adjust_first' },
  { ...o, kind: 'correction', slots: { direction: 4720, lateralDir: 'left', lateral: 200, rangeDir: 'drop', range: 50, next: 'ffe' } },
  { ...fdcOver, kind: 'danger_close_resend' },
  // The rest of every pattern and optional element
  { ...fdcOver, kind: 'danger_close_applied' },
  { ...o, kind: 'call', slots: { warning: 'ffe' } },
  { ...o, kind: 'location', slots: { method: 'polar', azimuth: 320, distance: 2500 } },
  { ...o, kind: 'description', slots: { targetType: 'unknown', rounds: 5, fuzeRequest: 'quick', control: 'ready', dangerClose: 0 } },
  {
    ...o,
    kind: 'description',
    slots: { targetType: 'mortar', activity: 'firing', unit: 'tubes', count: 3, rounds: 2, fuzeRequest: 'vt', control: 'amc', dangerClose: 1 },
  },
  { ...o, kind: 'description', slots: { targetType: 'mortar', activity: 'halted', unit: 'none', rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } },
  { ...o, kind: 'description', slots: { targetType: 'infantry', activity: 'moving', unit: 'platoon_minus', rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } },
  { ...o, kind: 'description', slots: { targetType: 'infantry', activity: 'halted', unit: 'squad', rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } },
  { ...o, kind: 'description', slots: { targetType: 'infantry', activity: 'attacking', unit: 'men', count: 4, rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } },
  { ...o, kind: 'correction', slots: { lateralDir: 'left', lateral: 30, rangeDir: 'add', range: 1500, next: 'adjust' } },
  { ...o, kind: 'correction', slots: { lateralDir: 'right', lateral: 800, next: 'adjust' } },
  { ...o, kind: 'correction', slots: { rangeDir: 'drop', range: 400, next: 'ffe' } },
  { ...o, kind: 'correction', slots: { next: 'adjust' } },
  { ...o, kind: 'correction', slots: { direction: 0, next: 'adjust' } },
  { ...o, kind: 'repeat', slots: { targetName: 'mortar', named: 0, effect: 'ineffective', rounds: 1 } },
  { ...obsNone, kind: 'end_of_mission', slots: { targetName: 'recon', effect: 'neutralized' } },
  { ...obsNone, kind: 'end_of_mission', slots: { targetName: 'apc', effect: 'ineffective' } },
  { ...obsNone, kind: 'end_of_mission', slots: { targetName: 'unknown', effect: 'destroyed' } },
  { ...obsNone, kind: 'end_of_mission', slots: { targetName: 'infantry', named: 0, effect: 'neutralized' } },
  { ...obsNone, kind: 'end_of_mission', slots: { targetName: 'mortar', named: 1, effect: 'destroyed' } },
  { ...o, kind: 'shift', slots: { targetNumber: 1003, direction: 6399, targetType: 'unknown', rounds: 1, dangerClose: 1 } },
  {
    ...fdcWait,
    kind: 'shift',
    slots: { targetNumber: 0, direction: 1600, lateralDir: 'left', lateral: 10, targetType: 'infantry', activity: 'attacking', unit: 'squad', rounds: 5, dangerClose: 1 },
  },
  { ...o, kind: 'move_notice' },
  { ...fdcOver, kind: 'move_notice' },
  { ...o, kind: 'position_report', slots: { easting: 4123, northing: 3050 } },
  { ...fdcOver, kind: 'position_report', slots: { easting: 4123, northing: 3050 } },
];
