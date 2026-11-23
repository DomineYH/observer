// 눌러서 말하기 (M4-6): the 가짜 인식기 gives the 들린 글; the forms, driven by the simulation's state, make the inputs.
// The tests have no DOM: a press and a release are the controller's two calls, a filled form is drawn as markup.
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { createSim, type Input, type Mode, type MtoSlots, type RadioEvent, type Sim, type Target } from '@sim';
import type { VoiceInput } from '@adapters/index';
import { silentVoice } from '@adapters/mock/voice';
import { fakeRecogniser } from '@adapters/mock/voiceInput';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { allButtons, buttonsOf, press, recording } from '../../tests/acceptance/buttons';
import { combatInit, START } from '../../tests/acceptance/init';
import { answered, CALL_ADJUST, CALL_FFE, corr, DESC_AMC, DESC_UNKNOWN, ended, LOC, MOVE, openRadio, radioEvents, send, started, toAdjust, toReady, untilImpact } from '../../tests/acceptance/mission';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { corrDraft, shiftDraft } from './correction';
import { reportName } from './effect';
import { openForms } from './openForms';
import { callDraft, descDraft, eomDraft, fireKey, locDraft, polarDraft, posDraft, repeatDraft, shiftOptions, targetOptions, type Draft } from './radio/drafts';
import type { Fill, OpenForm } from './radio/matching';
import { radioSentence, spoken } from './radio/sentence';
import { RadioLog } from './RadioLog';
import { createSound } from './sound';
import { createTalk, talkKey, talkText } from './talk';
import { TalkBar } from './TalkBar';

vi.mock('react/jsx-dev-runtime', async (real) => recording(await real<object>()));
vi.mock('react/jsx-runtime', async (real) => recording(await real<object>()));

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const GRID = flatTerrain().grid;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
const said = (d: Draft) => spoken(radioSentence(d.utterance, NAMES));

/** The forms open in `sim` now, with the 표적성질 choices the 입력기 would list. */
const formsOf = (sim: Sim) => openForms(sim.state.radio.stage, sim.state, { desc: targetOptions(sim.state.platoons), shift: shiftOptions(sim.state.platoons) });

/** One press and release into the forms open in `sim` now: what was filled, what was sent, and the line beside the button. */
async function talkTo(sim: Sim, heard: string[], input: VoiceInput = fakeRecogniser(heard), open = () => true, forms: readonly OpenForm[] = formsOf(sim)) {
  const out = { fills: [] as Fill[], sent: [] as Input[], hushes: [] as boolean[] };
  const talk = createTalk(input, (on) => void out.hushes.push(on));
  talk.press({ forms, names: NAMES, open, fill: (f) => void out.fills.push(f), send: (i) => void out.sent.push(i) });
  const listening = talkText(talk.line);
  await talk.release();
  return { ...out, forms, listening, line: talkText(talk.line) };
}
/** The 입력기 as drawn for `sim`, with what was said (if anything) filled in. */
const composer = (sim: Sim, fill: Fill | null = null, mode: Mode = sim.state.mode, platoons: Parameters<typeof targetOptions>[0] = sim.state.platoons) =>
  renderToStaticMarkup(
    <Composer stage={sim.state.radio.stage} live platoons={platoons} names={NAMES} grid={GRID} mode={mode} send={() => {}} state={sim.state} spoken={fill} />,
  );
/** The filled 입력기 drawn and its `nth` 송신 pressed (a button that cannot be pressed takes none): what the form sent. */
function sendOf(sim: Sim, fill: Fill | null, nth = 0, platoons: Parameters<typeof targetOptions>[0] = sim.state.platoons): Input[] {
  const sent: Input[] = [];
  const draw = () =>
    renderToStaticMarkup(
      <Composer stage={sim.state.radio.stage} live platoons={platoons} names={NAMES} grid={GRID} mode={sim.state.mode} send={(i) => void sent.push(i)} state={sim.state} spoken={fill} />,
    );
  press(buttonsOf(draw, '송신')[nth]);
  return sent;
}
/** The `nth` 보낼 문장 on the screen (the 전이사격 form's is the second, after the 호출's). */
const preview = (html: string, nth = 0) => text([...html.matchAll(/<p role="status" aria-live="off" aria-label="보낼 문장">(.*?)<\/p>/g)][nth]?.[1] ?? '(없음)');
const sendable = (html: string) => [...html.matchAll(/<button type="button"( disabled="")?>송신<\/button>/g)].map((m) => !m[1]);
/** A sentence of the 무전 기록, without its time and speaker. */
const logged = (e: RadioEvent) => text(renderToStaticMarkup(<RadioLog lines={[e]} callsign="갈매기" gridLetters="CH" mode="standard" />)).replace(/^\d\d:\d\d 갈매기 /, '');

// A unit the observer has identified, as the 표적성질 form lists it: the choices are 이동중인 적 장갑차 2대 and 미상 표적.
const SEEN = [{ type: 'apc', activity: 'moving', intel: { stage: 3, size: { unit: 'vehicles', n: 2 } } }] as const;
const APC2: Target = { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 };
const UNKNOWN: Target = { targetType: 'unknown' };
const ZERO = { lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0' } as const;
const TN = 1001; // the first mission's 표적번호

/** A game brought to a form, and the input a player makes there by hand: every 교신 that can be spoken but the readbacks
 * (준비 쏴, which carries no value, has its own test below). */
interface At {
  name: string;
  sim: () => Sim;
  hand: (sim: Sim) => Draft;
  /** As it is said, where that differs from how it is written (a 규모's numerals). */
  say?: string;
  /** What the filled form shows. */
  values: string[];
  platoons?: typeof SEEN;
  /** Which 보낼 문장 and 송신 on the screen are this form's. */
  nth?: number;
}
const AT: At[] = [
  { name: '호출', sim: opened, hand: () => callDraft('ffe'), values: ['<option value="ffe" selected="">효력사</option>'] },
  { name: '표적위치 좌표법', sim: located, hand: () => locDraft(4657, 3115), values: ['value="4657"', 'value="3115"'] },
  { name: '표적위치 극좌표법', sim: located, hand: () => polarDraft(420, 1500), values: ['aria-label="방위각" inputMode="numeric" maxLength="4" size="4" value="0420"', 'value="1500"'] },
  { name: '위치 보고', sim: moved, hand: () => posDraft('4040', '3032')!, values: ['value="4040"', 'value="3032"'] },
  {
    name: '표적성질',
    sim: described,
    platoons: SEEN,
    hand: () => descDraft({ target: APC2, rounds: 2, fuzeRequest: 'vt', control: 'amc', dangerClose: 1 }),
    say: '이동중인 적 장갑차 두 대, 포대 둘발, 접근신관, 지명사, 위험근접, 이상.',
    values: ['selected="">이동중인 적 장갑차 2대</option>', '<option value="2" selected="">2</option>', '<option value="vt" selected="">접근신관</option>', '<option value="amc" selected="">지명사</option>', '<input type="checkbox" checked=""/> 위험근접'],
  },
  {
    name: '수정 (임무의 첫 수정: 방향과 함께)',
    sim: adjusting,
    hand: () => corrDraft({ direction: '1250', lateralDir: 'right', lateral: '120', rangeDir: 'add', range: '400', next: 'adjust' }, { direction: null })!,
    values: ['size="4" value="1250"/> 밀', 'aria-label="좌우 거리" inputMode="numeric" size="4" value="120"', 'aria-label="사거리 거리" inputMode="numeric" size="4" value="400"', '<option value="right" selected="">우로</option>', '<option value="add" selected="">늘리기</option>'],
  },
  {
    name: '수정 (방향을 보낸 뒤: 다음은 효력사)',
    sim: corrected,
    hand: () => corrDraft({ direction: '', ...ZERO, lateral: '50', range: '200', next: 'ffe' }, { direction: 1250 })!,
    values: ['방향 1250 밀 (송신함)', 'aria-label="좌우 거리" inputMode="numeric" size="4" value="50"', 'aria-label="사거리 거리" inputMode="numeric" size="4" value="200"', '<option value="ffe" selected="">효력사</option>'],
  },
  { name: '임무끝', sim: observing, hand: (sim) => eomDraft('destroyed', reportName(sim.state)), values: ['<option value="eom" selected="">임무끝</option>', '<option value="destroyed" selected="">파괴</option>'] },
  {
    name: '재효력사',
    sim: observing,
    hand: (sim) => repeatDraft('ineffective', 3, reportName(sim.state)),
    values: ['<option value="repeat" selected="">재효력사</option>', '<option value="ineffective" selected="">효과 미흡</option>', '<option value="3" selected="">3</option>'],
  },
  {
    // 바로 효력사 sent no 방향: 수정 후 효력사 carries it. The 효과 is the one chosen in the form (무력화, its first).
    name: '수정 후 효력사',
    sim: observing,
    hand: () => corrDraft({ direction: '0800', ...ZERO, lateral: '60', next: 'ffe' }, { direction: null }, 'neutralized')!,
    values: ['<option value="corr" selected="">수정 후 효력사</option>', '<option value="neutralized" selected="">무력화</option>', 'size="4" value="0800"/> 밀', 'aria-label="좌우 거리" inputMode="numeric" size="4" value="60"'],
  },
  {
    name: '전이사격',
    sim: finished,
    nth: 1,
    hand: () => shiftDraft({ direction: '0800', lateralDir: 'left', lateral: '200', rangeDir: 'add', range: '400', target: UNKNOWN, rounds: 4, dangerClose: 1 }, TN)!,
    values: ['size="4" value="0800"/> 밀', 'aria-label="좌우 거리" inputMode="numeric" size="4" value="200"', 'aria-label="사거리 거리" inputMode="numeric" size="4" value="400"', '<option value="4" selected="">4</option>'],
  },
];
function opened(): Sim {
  const sim = started();
  openRadio(sim);
  return sim;
}
function located(): Sim {
  const sim = opened();
  send(sim, CALL_ADJUST);
  answered(sim, 'call');
  return sim;
}
function moved(): Sim {
  const sim = opened();
  sim.step([MOVE(400, 320)]);
  while (sim.state.post.state !== 'ready') sim.step([]);
  return sim;
}
/** The 표적위치 answered: the 표적성질 form. */
function described(): Sim {
  const sim = located();
  send(sim, LOC);
  answered(sim, 'loc');
  return sim;
}
/** The adjusting round landed: the mission's first 수정. */
function adjusting(): Sim {
  const sim = opened();
  toReady(sim);
  toAdjust(sim);
  return sim;
}
/** The first 수정 (방향 1250) sent and its round landed. */
function corrected(): Sim {
  const sim = adjusting();
  send(sim, corr(1250, 'right', 120, 'add', 400, 'adjust'));
  toAdjust(sim);
  return sim;
}
/** 바로 효력사 fired: 효과 관측. */
function observing(): Sim {
  const sim = opened();
  toReady(sim, DESC_UNKNOWN, CALL_FFE);
  for (let k = 0; k < 4000 && sim.state.radio.stage !== 'effect'; k++) sim.step([]);
  return sim;
}
/** A mission ended: at idle the 호출 and the 전이사격 are both open. */
function finished(): Sim {
  const sim = opened();
  ended(sim);
  return sim;
}

test('F-18: 말로 넣은 입력은 입력기가 만든 입력과 같다', async () => {
  const kinds = new Set<string>();
  for (const { name, sim: make, hand: makeHand, say, values, platoons, nth = 0 } of AT) {
    const sim = make();
    const hand = makeHand(sim);
    kinds.add(hand.input.a);
    const forms = platoons ? [{ form: 'desc' as const, options: targetOptions(platoons) }] : formsOf(sim);
    const heard = say ?? said(hand);
    const before = composer(sim, null, undefined, platoons);
    // Said: the form is filled and nothing is sent yet (값이 있는 한 마디는 저절로 나가지 않는다).
    const r = await talkTo(sim, [heard], undefined, undefined, forms);
    expect([r.listening, r.line, r.sent], name).toEqual(['듣는 중', `들린 글: ${heard}`, []]);
    expect(r.fills, name).toHaveLength(1);
    expect(r.hushes, name).toEqual([true, false]);
    // The filled form shows the values, and its 보낼 문장 is the sentence of the input made by hand; 송신 can be pressed.
    const filled = composer(sim, r.fills[0], undefined, platoons);
    for (const v of values) expect(filled, `${name} ${v}`).toContain(v);
    expect(preview(filled, nth), name).toBe(said(hand));
    expect(sendable(filled).at(nth), name).toBe(true);
    // 실전: the values are there, the sentence is not shown.
    const combat = composer(sim, r.fills[0], 'combat', platoons);
    for (const v of values) expect(combat, `${name} 실전 ${v}`).toContain(v);
    expect(preview(combat), name).toBe('(없음)');
    // The form's own 송신 pressed: it sends the input a player makes by hand, and nothing before that press.
    const pressed = sendOf(sim, r.fills[0]!, nth, platoons);
    expect(pressed, name).toEqual([hand.input]);
    // The simulation takes it and says the sentence the form showed.
    const taken = send(sim, pressed[0]!);
    expect(taken.ok, name).toBe(true);
    expect(logged(taken.events[0]!), name).toBe(preview(filled, nth));
    // 못 알아들음: nothing is filled or sent, the form stays as it was, and the line shows what was heard.
    const sim2 = make();
    const missed = await talkTo(sim2, ['기러기 여기는 갈매기 이상'], undefined, undefined, forms);
    expect([missed.fills, missed.sent, missed.line], name).toEqual([[], [], '알아듣지 못했습니다 · 들린 글: 기러기 여기는 갈매기 이상']);
    expect(composer(sim2, null, undefined, platoons), name).toBe(before);
    expect((await talkTo(sim2, [], undefined, undefined, forms)).line, name).toBe('알아듣지 못했습니다');
    // The form was built again before the 들린 글 came: it is dropped.
    const late = await talkTo(sim2, [heard], undefined, () => false, forms);
    expect([late.fills, late.sent, late.line], name).toEqual([[], [], '']);
    // Not filled by speech, the same press sends the form's own first values (or nothing, where they are not complete).
    expect(sendOf(sim2, null, nth, platoons), name).not.toEqual([hand.input]);
  }
  // 범위선의 말로 넣는 입력 열 가지 가운데 복창을 뺀 아홉: these eight here and 준비 쏴 below.
  expect([...kinds, 'fire'].sort()).toEqual(['call', 'corr', 'desc', 'eom', 'fire', 'loc', 'pos', 'repeat', 'shift']);
});

test('F-18: 말로 넣은 입력 — 대기에서 전이는 전이사격 양식을, 호출 문장은 호출 양식을 채우고 다시 말하면 앞의 값이 남지 않는다', async () => {
  const sim = finished();
  expect(formsOf(sim).map((f) => f.form)).toEqual(['call', 'shift']);
  // A call fills the 호출 form and leaves the 전이사격 form at its first values.
  const call = await talkTo(sim, ['기러기, 여기는 갈매기, 효력사, 이상']);
  expect(call.fills).toEqual([{ form: 'call', warning: 'ffe' }]);
  const called = composer(sim, call.fills[0]);
  expect(preview(called, 0)).toBe('기러기, 여기는 갈매기, 효력사, 이상.');
  expect(preview(called, 1)).toBe(preview(composer(sim), 1));
  // 전이 … fills the 전이사격 form and leaves the 호출 form.
  const shift = await talkTo(sim, ['전이, 표적번호 알파브라보 하나공공하나, 방향 하나둘공공, 우로 여섯십, 미상 표적, 포대 둘발, 효력사']);
  const shifted = composer(sim, shift.fills[0]);
  expect(preview(shifted, 0)).toBe(preview(composer(sim), 0));
  expect(preview(shifted, 1)).toBe('전이, 표적번호 알파브라보 하나공공하나, 방향 하나둘공공, 우로 여섯십, 미상 표적, 포대 둘발, 효력사, 이상.');
  // Said again with less: the whole form is the new one, what was not said at its first value (no 수정량, 포대 3발 unsaid is 못 알아들음).
  const again = await talkTo(sim, ['전이, 방향 공팔공공, 미상 표적, 포대 삼발']);
  expect(again.fills).toEqual([{ form: 'shift', values: { direction: '0800', ...ZERO, target: UNKNOWN, rounds: 3, dangerClose: 0 } }]);
  expect(preview(composer(sim, again.fills[0]), 1)).toBe('전이, 표적번호 알파브라보 하나공공하나, 방향 공팔공공, 미상 표적, 포대 삼발, 효력사, 이상.');
  // The same for a 수정: the second one keeps nothing of the first.
  const adjust = corrected();
  const one = await talkTo(adjust, ['우로 하나백둘십, 늘리기 넷백, 효력사']);
  const two = await talkTo(adjust, ['좌로 오십']);
  expect(one.fills).toEqual([{ form: 'corr', values: { direction: '', lateralDir: 'right', lateral: '120', rangeDir: 'add', range: '400', next: 'ffe' }, effect: null }]);
  expect(two.fills).toEqual([{ form: 'corr', values: { direction: '', ...ZERO, lateral: '50', next: 'adjust' }, effect: null }]);
  expect(preview(composer(adjust, two.fills[0]))).toBe('좌로 오십, 이상.');
  // 수정 후 효력사 with the 효과 said before it: that 효과 is the form's.
  const effect = observing();
  const said2 = await talkTo(effect, ['표적 파괴, 방향 공팔공공, 좌로 여섯십, 효력사']);
  const form = composer(effect, said2.fills[0]);
  expect(form).toContain('<option value="destroyed" selected="">파괴</option>');
  expect(send(effect, corr(800, 'left', 60, 'drop', 0, 'ffe', 'destroyed')).ok).toBe(true);
});

test('F-18: 말로 넣은 입력 — 밀린 복창이 있거나 실전에서 걷는 동안에는 말로 채운 수정도 송신되지 않는다', async () => {
  const WALKING = '이동 중에는 수정을 보낼 수 없습니다';
  const HELD = '복창을 먼저 보내십시오';
  const combat = () => {
    const sim = createSim({ ...combatInit(7), scenario: { ...BASE_SCENARIO, units: [] } });
    sim.step([START]);
    openRadio(sim);
    return sim;
  };
  const rb = (sim: Sim, kind: string): Input => {
    const m: MtoSlots = sim.state.missions.at(-1)!.mto!;
    return { a: 'readback', v: kind === 'mto' ? ['mto', m.fuze, m.rounds, m.control, m.targetNumber] : [kind] };
  };
  // 실전, 조정: the round has landed and its readbacks are owed. The 수정 is filled, and its 송신 is held.
  const sim = combat();
  toReady(sim);
  untilImpact(sim);
  radioEvents(sim, 30);
  const fill: Fill = { form: 'corr', values: { direction: '1250', ...ZERO, lateral: '50', next: 'adjust' }, effect: null };
  const held = composer(sim, fill);
  expect(text(held)).toContain(HELD);
  expect(held).toContain('aria-label="좌우 거리" inputMode="numeric" size="4" value="50"');
  expect(sendable(held)).toEqual([false]);
  expect(sendOf(sim, fill)).toEqual([]); // pressed all the same: nothing goes
  // Read back: the same filled form can be sent, and sends the 수정 that was said.
  for (const kind of ['mto', 'shot']) expect(send(sim, rb(sim, kind)).ok, kind).toBe(true);
  expect(sendable(composer(sim, fill))).toEqual([true]);
  expect(sendOf(sim, fill)).toEqual([corr(1250, 'left', 50, 'drop', 0, 'adjust')]);
  // Walking (임무 중 관측소 이동): held again, with the words.
  expect(send(sim, MOVE(440, 440)).ok).toBe(true);
  const walking = composer(sim, fill);
  expect(text(walking)).toContain(WALKING);
  expect(sendable(walking)).toEqual([false]);
  expect(sendOf(sim, fill)).toEqual([]);

  // 효과 관측 while walking: 재효력사 and 수정 후 효력사 said are filled and held; 임무끝 said can be sent.
  const ffe = combat();
  for (const [input, a] of [[CALL_FFE, 'call'], [LOC, 'loc']] as const) {
    send(ffe, input);
    answered(ffe, a);
  }
  send(ffe, DESC_UNKNOWN);
  expect(send(ffe, MOVE(440, 440)).ok).toBe(true);
  for (let k = 0; k < 4000 && !ffe.state.missions.at(-1)!.readback?.mto; k++) ffe.step([]);
  send(ffe, rb(ffe, 'mto'));
  for (let k = 0; k < 4000 && !(ffe.state.radio.stage === 'effect' && ffe.state.missions.at(-1)!.readback?.rounds_complete); k++) ffe.step([]);
  for (const kind of ['shot', 'rounds_complete']) expect(send(ffe, rb(ffe, kind)).ok, kind).toBe(true);
  expect([ffe.state.post.state, ffe.state.radio.stage]).toEqual(['moving', 'effect']);
  const repeat = composer(ffe, { form: 'repeat', effect: 'ineffective', rounds: 2 });
  expect(repeat).toContain('<option value="repeat" selected="">재효력사</option>');
  expect([text(repeat).includes(WALKING), sendable(repeat)]).toEqual([true, [false]]);
  expect(sendOf(ffe, { form: 'repeat', effect: 'ineffective', rounds: 2 })).toEqual([]);
  const after = composer(ffe, { form: 'corr', values: { direction: '0800', ...ZERO, lateral: '60', next: 'ffe' }, effect: null });
  expect(after).toContain('<option value="corr" selected="">수정 후 효력사</option>');
  expect(sendable(after)).toEqual([false]);
  expect(sendOf(ffe, { form: 'corr', values: { direction: '0800', ...ZERO, lateral: '60', next: 'ffe' }, effect: null })).toEqual([]);
  const eom = composer(ffe, { form: 'eom', effect: 'destroyed' });
  expect(eom).toContain('<option value="destroyed" selected="">파괴</option>');
  expect(sendable(eom)).toEqual([true]);
  expect(sendOf(ffe, { form: 'eom', effect: 'destroyed' })).toEqual([{ a: 'eom', v: ['destroyed'] }]);
});

test('F-18: 말로 넣은 입력 — 준비 쏴는 맞으면 바로 나가고 F 키의 입력과 같다', async () => {
  const sim = opened();
  toReady(sim, DESC_AMC);
  expect(formsOf(sim)).toEqual([{ form: 'fire' }]);
  const r = await talkTo(sim, ['준비 쏴']);
  expect([r.fills, r.sent, r.line]).toEqual([[], [fireKey('f')], '들린 글: 준비 쏴']);
  expect(send(sim, r.sent[0]!).ok).toBe(true);
  // Half of it is nothing.
  const sim2 = opened();
  toReady(sim2, DESC_AMC);
  expect((await talkTo(sim2, ['준비'])).sent).toEqual([]);
});

test('F-18: 말로 넣은 입력 — 보낼 교신이 없으면 눌리지 않고, 알아듣는 중에 다시 누르면 앞의 것은 버린다', async () => {
  // Nothing to send: before the radio check, waiting for 기러기, walking to a new post, a round in flight.
  const sim = started();
  expect(formsOf(sim)).toEqual([]);
  expect((await talkTo(sim, ['조정'])).listening).toBe('');
  openRadio(sim);
  send(sim, CALL_ADJUST);
  expect([sim.state.radio.stage, formsOf(sim)]).toEqual(['wait', []]);
  const walking = opened();
  walking.step([MOVE(400, 320)]);
  expect([walking.state.post.state, formsOf(walking)]).toEqual(['moving', []]);
  const flying = opened();
  toReady(flying);
  radioEvents(flying, 5);
  expect(formsOf(flying)).toEqual([]);
  // The button: pressed while listening, not pressable with no form open, absent with 음성 입력 off.
  const idleTalk = { press: () => {}, release: async () => {}, reset: () => {} };
  const bar = (forms: Parameters<typeof TalkBar>[0]['forms'], line: Parameters<typeof TalkBar>[0]['line'] = null) =>
    renderToStaticMarkup(<TalkBar talk={idleTalk} line={line} forms={forms} names={NAMES} formKey="k" openKey={{ current: 'k' }} onFill={() => {}} send={() => {}} />);
  expect(bar([{ form: 'call' }])).toBe('<p><button type="button" aria-pressed="false">눌러서 말하기 <kbd>V</kbd></button> <output aria-label="들린 글"></output></p>');
  expect(bar([])).toContain('<button type="button" disabled="" aria-pressed="false">');
  expect(text(bar([{ form: 'call' }], { state: 'working' }))).toBe('눌러서 말하기 V 알아듣는 중');
  expect(bar([{ form: 'call' }], { state: 'listening' })).toContain('aria-pressed="true"');
  const idle = opened();
  expect(composer(idle)).not.toContain('눌러서 말하기');
  const withBar = renderToStaticMarkup(
    <Composer stage="idle" live platoons={[]} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={idle.state} talk={<TalkBar talk={idleTalk} line={null} forms={[{ form: 'call' }]} names={NAMES} formKey="k" openKey={{ current: 'k' }} onFill={() => {}} send={() => {}} />} />,
  );
  expect(withBar.replace(bar([{ form: 'call' }]), '')).toBe(composer(idle)); // the button and its line are all that is new

  // A 들린 글 still being worked out when the button is pressed again is dropped; the second one fills.
  let finish!: (texts: string[]) => void;
  const slow: VoiceInput = { open: async () => {}, close: () => {}, listen: () => ({ stop: () => new Promise((r) => (finish = r)), cancel: () => {} }) };
  const fills: Fill[] = [];
  const talk = createTalk(slow, () => {});
  const target = { forms: [{ form: 'call' }] as const, names: NAMES, open: () => true, fill: (f: Fill) => void fills.push(f), send: () => {} };
  talk.press(target);
  const first = talk.release();
  const firstDone = finish;
  expect(talkText(talk.line)).toBe('알아듣는 중');
  talk.press(target);
  talk.press(target); // a key repeat while held: one listening
  firstDone(['조정']);
  await first;
  expect([fills, talkText(talk.line)]).toEqual([[], '듣는 중']);
  const second = talk.release();
  finish(['효력사']);
  await second;
  expect([fills, talkText(talk.line)]).toEqual([[{ form: 'call', warning: 'ffe' }], '들린 글: 효력사']);
  // 음성 입력 turned off while held: nothing comes of it.
  talk.press(target);
  talk.reset();
  await talk.release();
  expect([fills.length, talkText(talk.line)]).toEqual([1, '']);
});

test('F-18: 말로 넣은 입력 — 누르면 음성 출력이 멈추고 누르는 동안 온 기러기의 교신은 읽지 않는다', async () => {
  // Every step's events go to a sound with a recording voice, the 음성 setting on.
  const sim = started();
  const voice = silentVoice();
  const sound = createSound(voice, { boom: () => {}, squelch: () => {} }, NAMES);
  sound.set({ voice: true });
  const step = sim.step.bind(sim);
  sim.step = (inputs) => {
    const r = step(inputs);
    sound.hear(r.events, sim.state);
    return r;
  };
  openRadio(sim);
  expect(voice.said.map((v) => v.text)).toEqual(['갈매기, 여기는 기러기, 감명 보고, 이상.']);
  // Held: the voice is stopped once, and 기러기's answer to the call, which comes meanwhile, is not read.
  const talk = createTalk(fakeRecogniser([]), sound.hush);
  talk.press({ forms: [{ form: 'call' }], names: NAMES, open: () => true, fill: () => {}, send: () => {} });
  expect(voice.stops).toBe(1);
  send(sim, CALL_ADJUST);
  expect(answered(sim, 'call').map((e) => e.utterance.kind)).toContain('call_ack'); // it is on the 무전 기록
  expect(voice.said).toHaveLength(1);
  // Let go: the next one is read again.
  await talk.release();
  send(sim, LOC);
  answered(sim, 'loc');
  expect(voice.said).toHaveLength(2);
  expect(voice.stops).toBe(1);
  // With the 음성 setting off, holding stops nothing.
  sound.set({ voice: false });
  const stops = voice.stops;
  sound.hush(true);
  expect(voice.stops).toBe(stops);
});

test('F-18: 말로 넣은 입력 — V와 Enter는 단축키 무시 조건을 따르고 초점이 단추에 있으면 Enter는 그 단추의 것이다', () => {
  const key = (key: string, tagName = 'BODY', mods: Partial<KeyboardEvent> = {}, code = '') =>
    talkKey({ key, code, ctrlKey: false, altKey: false, metaKey: false, target: { tagName } as unknown as EventTarget, ...mods });
  expect([key('v'), key('V'), key('ㅍ', 'BODY', {}, 'KeyV'), key('Enter')]).toEqual(['talk', 'talk', 'talk', 'send']);
  // A focused button keeps its own Enter, and V still talks there.
  expect([key('Enter', 'BUTTON'), key('v', 'BUTTON')]).toEqual([null, 'talk']);
  // Typing in a field, choosing in a list, a modifier held: neither key.
  for (const tag of ['INPUT', 'SELECT', 'TEXTAREA']) expect([key('v', tag), key('Enter', tag)], tag).toEqual([null, null]);
  for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) expect([key('v', 'BODY', { [mod]: true }), key('Enter', 'BODY', { [mod]: true })], mod).toEqual([null, null]);
  for (const other of ['f', 'b', ' ', 'Escape']) expect(key(other), other).toBeNull();
});

test('F-18: 말로 넣은 입력 — 단추를 누른 뒤 양식이 다시 지어지면 들린 글을 버리고, 듣기를 시작하지 못하면 음성 출력을 되돌린다', async () => {
  // The real 눌러서 말하기 button, pressed and let go by its own handlers; the app keeps the key of the form open now.
  const run = async (rebuilt: boolean, heard: string) => {
    const out = { fills: [] as Fill[], sent: [] as Input[], hushes: [] as boolean[] };
    const talk = createTalk(fakeRecogniser([heard]), (on) => void out.hushes.push(on));
    const openKey = { current: 'form-1' };
    const forms: OpenForm[] = heard === '준비 쏴' ? [{ form: 'fire' }] : [{ form: 'call' }];
    const [button] = allButtons(() =>
      renderToStaticMarkup(<TalkBar talk={talk} line={talk.line} forms={forms} names={NAMES} formKey="form-1" openKey={openKey} onFill={(f) => void out.fills.push(f)} send={(i) => void out.sent.push(i)} />),
    );
    (button!.onPointerDown as () => void)();
    if (rebuilt) openKey.current = 'form-2'; // the 교신 단계 moved on while the button was held
    (button!.onPointerUp as () => void)();
    for (let k = 0; k < 5 && talkText(talk.line) === '알아듣는 중'; k++) await new Promise((r) => setTimeout(r));
    return { ...out, line: talkText(talk.line) };
  };
  expect(await run(false, '효력사')).toEqual({ fills: [{ form: 'call', warning: 'ffe' }], sent: [], hushes: [true, false], line: '들린 글: 효력사' });
  expect(await run(true, '효력사')).toEqual({ fills: [], sent: [], hushes: [true, false], line: '' });
  // 준비 쏴 held over a form change is not sent to the form that came after.
  expect((await run(false, '준비 쏴')).sent).toEqual([fireKey('f')]);
  expect(await run(true, '준비 쏴')).toEqual({ fills: [], sent: [], hushes: [true, false], line: '' });

  // The 인식기 cannot start (a word it cannot take): nothing is held, and 기러기's voice is not left stopped.
  const hushes: boolean[] = [];
  const broken: VoiceInput = { open: async () => {}, close: () => {}, listen: () => { throw new TypeError('no grammar'); } };
  const talk = createTalk(broken, (on) => void hushes.push(on));
  talk.press({ forms: [{ form: 'call' }], names: NAMES, open: () => true, fill: () => {}, send: () => {} });
  expect([hushes, talkText(talk.line)]).toEqual([[true, false], '']);
  await talk.release();
  expect(hushes).toEqual([true, false]);
  // Let go by a reset (음성 입력 off, the button gone, the window's keys lost): 기러기 is heard again, and the 들린 글 is dropped.
  const held: boolean[] = [];
  const fills: Fill[] = [];
  const live = createTalk(fakeRecogniser(['효력사']), (on) => void held.push(on));
  live.press({ forms: [{ form: 'call' }], names: NAMES, open: () => true, fill: (f) => void fills.push(f), send: () => {} });
  live.reset();
  await live.release();
  expect([held, fills, talkText(live.line)]).toEqual([[true, false], [], '']);
});
