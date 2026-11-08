// The correction forms' preview against the simulation (final review): the ui snaps, drops zeros and bounds the fields
// on its own (it may import only the simulation's types), so at every boundary the input and the sentence it previews
// must be what the simulation accepts and says. Public interface only: create, step, events, read-only state.
import { describe, expect, test } from 'vitest';
import type { Input, RadioEvent, Sim, SimEvent } from '@sim';
import { corrDraft, shiftDraft, type CorrForm, type ShiftForm } from '@ui/correction';
import { CALL_ADJUST, CALL_FFE, DESC_UNKNOWN, LOC_CLEAR, LOC_NEAR, answered, desc, ended, openRadio, send, started, toAdjust, toReady, untilTaken } from './mission';

const said = (events: readonly SimEvent[]) => events.filter((e): e is RadioEvent => e.type === 'radio').find((e) => e.utterance.speaker === 'observer')?.utterance;

/** Every field boundary: the text, the number it means (an empty field is 0), and the meters said for it (null: left out). */
const LATERAL: readonly [text: string, sent: number, as: number | null][] = [
  ['', 0, null],
  ['0', 0, null],
  ['4', 4, null],
  ['5', 5, 10],
  ['14', 14, 10],
  ['15', 15, 20],
  ['104', 104, 100],
  ['105', 105, 110],
  ['794', 794, 790],
  ['795', 795, 800],
  ['799', 799, 800],
  ['800', 800, 800],
  ['801', 801, null],
  ['-1', -1, null],
  ['1.5', 1.5, null],
  ['8x', NaN, null],
];
const RANGE: readonly [text: string, sent: number, as: number | null][] = [
  ['', 0, null],
  ['0', 0, null],
  ['24', 24, null],
  ['25', 25, 50],
  ['74', 74, 50],
  ['75', 75, 100],
  ['124', 124, 100],
  ['125', 125, 150],
  ['1474', 1474, 1450],
  ['1475', 1475, 1500],
  ['1499', 1499, 1500],
  ['1500', 1500, 1500],
  ['1501', 1501, null],
  ['-50', -50, null],
  ['12.5', 12.5, null],
];
const refused = (sent: number, limit: number) => !Number.isInteger(sent) || sent < 0 || sent > limit;

const FORM: CorrForm = { direction: '', lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0', next: 'adjust' };
const SHIFT_FORM: ShiftForm = { direction: '0800', lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0', target: { targetType: 'unknown' }, rounds: 3, dangerClose: 0 };

/** A correction's values from a form's numbers: 방향 first when there is one, 효과 last. */
const corrValues = (lat: number, rng: number, direction: number | null, next: 'adjust' | 'ffe', effect?: string) => ({
  a: 'corr',
  v: [...(direction === null ? [] : [direction]), 'left', lat, 'drop', rng, next, ...(effect ? [effect] : [])],
}) as Input;

/** The draft is what the simulation takes and says; with no draft, the same numbers are what it refuses. */
function agree(sim: Sim, draft: ReturnType<typeof corrDraft>, wouldBe: Input): void {
  const r = sim.step([draft ? draft.input : wouldBe]);
  expect(r.accepted).toEqual([draft !== null]);
  if (draft) expect(said(r.events)).toEqual(draft.utterance);
}

/** Each path to a correction: the fresh simulation at that step, and how its form and its input look. */
const PATHS = [
  {
    name: '첫 수정',
    at: () => {
      const sim = started();
      openRadio(sim);
      toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
      toAdjust(sim);
      return sim;
    },
    form: { direction: '0800' },
    effect: undefined,
    direction: 800,
    next: 'adjust',
  },
  {
    name: '다음 수정',
    at: () => {
      const sim = started();
      openRadio(sim);
      toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
      toAdjust(sim);
      expect(send(sim, corrValues(0, 100, 800, 'adjust')).ok).toBe(true);
      toAdjust(sim);
      return sim;
    },
    form: {},
    effect: undefined,
    direction: null,
    next: 'adjust',
  },
  {
    name: '수정 후 효력사',
    at: () => {
      // The tick the 효과 form opens is the tick its input is first taken, on a twin.
      const twin = started();
      openRadio(twin);
      toReady(twin, DESC_UNKNOWN, CALL_FFE);
      untilTaken(twin, corrValues(0, 0, 800, 'ffe', 'neutralized'));
      const sim = started();
      openRadio(sim);
      toReady(sim, DESC_UNKNOWN, CALL_FFE);
      while (sim.state.tick < twin.state.tick - 1) sim.step([]);
      return sim;
    },
    form: { direction: '0800', next: 'ffe' },
    effect: 'neutralized',
    direction: 800,
    next: 'ffe',
  },
  {
    name: '위험근접 수정',
    at: () => {
      const sim = started();
      openRadio(sim);
      for (const input of [CALL_ADJUST, LOC_NEAR, desc(3, 'none', 'ready', 1, 'unknown')]) {
        expect(send(sim, input).ok).toBe(true);
        answered(sim, input.a as 'call' | 'loc' | 'desc');
      }
      toAdjust(sim);
      return sim;
    },
    form: { direction: '0800' },
    effect: undefined,
    direction: 800,
    next: 'adjust',
  },
] as const;

describe('F-07: 수정 미리보기는 시뮬레이션과 경계마다 같다', () => {
  for (const p of PATHS) {
    const draftOf = (sim: Sim, f: Partial<CorrForm>) => corrDraft({ ...FORM, ...p.form, ...f } as CorrForm, sim.state.missions.at(-1)!, p.effect);
    const wouldBe = (lat: number, rng: number) => corrValues(lat, rng, p.direction, p.next, p.effect);

    test.each(LATERAL)(`${p.name} 좌우 %j`, (text, sent, as) => {
      const sim = p.at();
      const d = draftOf(sim, { lateral: text });
      expect(d === null).toBe(refused(sent, 800));
      if (d) expect((d.utterance as { slots: { lateral?: number } }).slots.lateral ?? null).toBe(as);
      agree(sim, d, wouldBe(sent, 0));
    });

    test.each(RANGE)(`${p.name} 사거리 %j`, (text, sent, as) => {
      const sim = p.at();
      const d = draftOf(sim, { range: text });
      expect(d === null).toBe(refused(sent, 1500));
      if (d) expect((d.utterance as { slots: { range?: number } }).slots.range ?? null).toBe(as);
      agree(sim, d, wouldBe(0, sent));
    });

    test(`${p.name}: 두 축이 모두 0으로 스냅되면 둘 다 빠진다 (동제원)`, () => {
      const sim = p.at();
      const d = draftOf(sim, { lateral: '4', range: '24' })!;
      const slots = (d.utterance as { slots: object }).slots;
      expect(slots).not.toHaveProperty('lateral');
      expect(slots).not.toHaveProperty('range');
      agree(sim, d, wouldBe(4, 24));
    });
  }

  test.each([
    ['0', 0],
    ['6399', 6399],
    ['6400', 6400],
    ['8x', NaN],
    ['', null],
  ] as const)('첫 수정 방향 %j', (text, sent) => {
    const sim = PATHS[0].at();
    const d = corrDraft({ ...FORM, direction: text }, sim.state.missions.at(-1)!);
    expect(d !== null).toBe(sent === 0 || sent === 6399);
    // An empty field sends no 방향, and the first correction needs one.
    agree(sim, d, corrValues(0, 0, sent, 'adjust'));
  });
});

describe('F-07: 전이 미리보기는 시뮬레이션과 경계마다 같다', () => {
  const at = () => {
    const sim = started();
    openRadio(sim);
    ended(sim, CALL_FFE, LOC_CLEAR);
    return sim;
  };
  const wouldBe = (lat: number, rng: number, dc: 0 | 1): Input => ({ a: 'shift', v: [800, 'left', lat, 'drop', rng, 3, dc, 'unknown'] });
  for (const dc of [0, 1] as const) {
    const draftOf = (sim: Sim, f: Partial<ShiftForm>) => shiftDraft({ ...SHIFT_FORM, dangerClose: dc, ...f }, sim.state.missions.at(-1)!.mto!.targetNumber);

    test.each(LATERAL)(`위험근접 ${dc} 좌우 %j`, (text, sent, as) => {
      const sim = at();
      const d = draftOf(sim, { lateral: text });
      expect(d === null).toBe(refused(sent, 800));
      if (d) expect((d.utterance as { slots: { lateral?: number } }).slots.lateral ?? null).toBe(as);
      agree(sim, d, wouldBe(sent, 0, dc));
    });

    test.each(RANGE)(`위험근접 ${dc} 사거리 %j`, (text, sent, as) => {
      const sim = at();
      const d = draftOf(sim, { range: text });
      expect(d === null).toBe(refused(sent, 1500));
      if (d) expect((d.utterance as { slots: { range?: number } }).slots.range ?? null).toBe(as);
      agree(sim, d, wouldBe(0, sent, dc));
    });
  }
});
