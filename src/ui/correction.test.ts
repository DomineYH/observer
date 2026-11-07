import { expect, test } from 'vitest';
import type { RadioEvent } from '@sim';
import { CALL_ADJUST, DESC_UNKNOWN, openRadio, send, started, toAdjust, toReady, untilSaid } from '../../tests/acceptance/mission';
import { radioSentence, spoken } from './radio/sentence';
import { corrDraft, deviation, prefillDirection, suggestion, type CorrForm } from './correction';

const OP = { x: 0, y: 0 };
const platoon = (x: number, y: number, state = 'approach' as const) => ({ x, y, state });
const landed = (x: number, y: number) => [{ impacts: [{ x: 500, y: 500, tick: 10 }, { x, y, tick: 90 }] }];
const FORM: CorrForm = { direction: '', lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0', next: 'adjust' };
const SAID = { speaker: 'observer', ending: 'over', kind: 'correction' } as const;
const observer = (events: readonly RadioEvent[]) => events.find((e) => e.utterance.speaker === 'observer')!.utterance;

test('F-07: 훈련 편의와 제안', () => {
  // The last round landed 30 m right and 120 m over a platoon 1 km north of the post (on the observer–target line).
  const dev = deviation({ op: OP, platoons: [platoon(0, 1000)], missions: landed(30, 1120) })!;
  expect(dev.lat).toBeCloseTo(30, 6);
  expect(dev.rng).toBeCloseTo(120, 6);
  expect(suggestion(dev)).toEqual({
    text: '탄착 편의 우 30 m · 사거리 원 120 m → 좌로 30, 줄이기 100',
    form: { lateralDir: 'left', lateral: '30', rangeDir: 'drop', range: '100' },
  });
  // Turned: a platoon due east, the round 40 m short and 26 m left of it as the observer sees it → 우로 30, 늘리기 50.
  const east = deviation({ op: OP, platoons: [platoon(2000, 0)], missions: landed(1960, 26) })!;
  expect(suggestion(east).form).toEqual({ lateralDir: 'right', lateral: '30', rangeDir: 'add', range: '50' });
  // The nearest platoon counts; one not yet on the field ('wait') or over 800 m away does not.
  const near = deviation({ op: OP, platoons: [platoon(0, 1300), platoon(0, 1000)], missions: landed(30, 1120) })!;
  expect(near.rng).toBeCloseTo(120, 6);
  expect(deviation({ op: OP, platoons: [platoon(0, 1000, 'wait' as 'approach')], missions: landed(30, 1120) })).toBeNull();
  expect(deviation({ op: OP, platoons: [platoon(0, 1930)], missions: landed(0, 1120) })).toBeNull();
  expect(suggestion(null)).toEqual({ text: '탄착 부근에 표적 없음', form: null });

  // 방향 starts as the view's azimuth (0.1 mil → mil) in training, empty in standard.
  expect(prefillDirection({ mode: 'training', aim: { az: 12345 } })).toBe('1235');
  expect(prefillDirection({ mode: 'training', aim: { az: 63996 } })).toBe('0');
  expect(prefillDirection({ mode: 'standard', aim: { az: 12345 } })).toBe('');

  // The first correction needs a 방향: without one the composer has nothing to send.
  const sim = started();
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
  toAdjust(sim);
  const mission = () => sim.state.missions.at(-1)!;
  expect(corrDraft({ ...FORM, lateralDir: 'right', lateral: '50' }, mission())).toBeNull();
  expect(corrDraft({ ...FORM, direction: '6400' }, mission())).toBeNull();
  expect(corrDraft({ ...FORM, direction: '800', lateral: '801' }, mission())).toBeNull();
  expect(corrDraft({ ...FORM, direction: '800', range: '1501' }, mission())).toBeNull();
  expect(corrDraft({ ...FORM, direction: '800', lateral: '12.5' }, mission())).toBeNull();
  // The draft's sentence is the one the simulation says for its input (the simulation snaps 14 → 10, 74 → 50).
  const first = corrDraft({ ...FORM, direction: '0800', lateralDir: 'right', lateral: '14', rangeDir: 'add', range: '74' }, mission())!;
  expect(first.input).toEqual({ a: 'corr', v: [800, 'right', 14, 'add', 74, 'adjust'] });
  expect(first.utterance).toEqual({
    ...SAID,
    slots: { direction: 800, lateralDir: 'right', lateral: 10, rangeDir: 'add', range: 50, next: 'adjust' },
  });
  const r1 = send(sim, first.input);
  expect(r1.ok).toBe(true);
  expect(observer(r1.events)).toEqual(first.utterance);
  // Later corrections go along the 방향 already sent: a 방향 in the form is not sent again. Both under → 동제원.
  untilSaid(sim, 'fdc', 'ready');
  toAdjust(sim);
  const later = corrDraft({ ...FORM, direction: '1200', lateralDir: 'left', lateral: '4', rangeDir: 'drop', range: '' }, mission())!;
  expect(later.input).toEqual({ a: 'corr', v: ['left', 4, 'drop', 0, 'adjust'] });
  expect(later.utterance).toEqual({ ...SAID, slots: { next: 'adjust' } });
  const r2 = send(sim, later.input);
  expect(r2.ok).toBe(true);
  expect(observer(r2.events)).toEqual(later.utterance);
});

test('F-07: 수정 뒤 효력사 — 입력기', () => {
  const sim = started();
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
  toAdjust(sim);
  // 다음 효력사: the draft ends ", 효력사", and it is what the simulation takes and says for that input.
  const d = corrDraft({ ...FORM, direction: '0800', lateralDir: 'right', lateral: '50', next: 'ffe' }, sim.state.missions.at(-1)!)!;
  expect(d.input).toEqual({ a: 'corr', v: [800, 'right', 50, 'drop', 0, 'ffe'] });
  expect(spoken(radioSentence(d.utterance, { callsign: '갈매기', gridLetters: 'CH' }))).toBe('방향 공팔공공, 우로 오십, 효력사, 이상.');
  const r = send(sim, d.input);
  expect(r.ok).toBe(true);
  expect(observer(r.events)).toEqual(d.utterance);
  expect(untilSaid(sim, 'fdc', 'ready').at(-1)!.utterance).toMatchObject({ kind: 'ready', slots: { fuze: 'quick' } });
});
