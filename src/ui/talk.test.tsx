// 눌러서 말하기 (M4-6): the 가짜 인식기 gives the 들린 글; the forms, driven by the simulation's state, make the inputs.
// The tests have no DOM: a press and a release are the controller's two calls, a filled form is drawn as markup.
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Input, Mode, RadioEvent, Sim } from '@sim';
import type { VoiceInput } from '@adapters/index';
import { silentVoice } from '@adapters/mock/voice';
import { fakeRecogniser } from '@adapters/mock/voiceInput';
import { answered, CALL_ADJUST, DESC_AMC, LOC, MOVE, openRadio, radioEvents, send, started, toReady } from '../../tests/acceptance/mission';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { openForms } from './openForms';
import { callDraft, fireKey, locDraft, polarDraft, posDraft, type Draft } from './radio/drafts';
import type { Fill } from './radio/matching';
import { radioSentence, spoken } from './radio/sentence';
import { RadioLog } from './RadioLog';
import { createSound } from './sound';
import { createTalk, talkKey, talkText } from './talk';
import { TalkBar } from './TalkBar';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const GRID = flatTerrain().grid;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
const said = (d: Draft) => spoken(radioSentence(d.utterance, NAMES));

/** One press and release into the forms open in `sim` now: what was filled, what was sent, and the line beside the button. */
async function talkTo(sim: Sim, heard: string[], input: VoiceInput = fakeRecogniser(heard), open = () => true) {
  const out = { fills: [] as Fill[], sent: [] as Input[], hushes: [] as boolean[] };
  const talk = createTalk(input, (on) => void out.hushes.push(on));
  const forms = openForms(sim.state.radio.stage, sim.state);
  talk.press({ forms, names: NAMES, open, fill: (f) => void out.fills.push(f), send: (i) => void out.sent.push(i) });
  const listening = talkText(talk.line);
  await talk.release();
  return { ...out, forms, listening, line: talkText(talk.line) };
}
/** The 입력기 as drawn for `sim`, with what was said (if anything) filled in. */
const composer = (sim: Sim, fill: Fill | null = null, mode: Mode = sim.state.mode) =>
  renderToStaticMarkup(
    <Composer stage={sim.state.radio.stage} live platoons={sim.state.platoons} names={NAMES} grid={GRID} mode={mode} send={() => {}} state={sim.state} spoken={fill} />,
  );
const preview = (html: string) => text(html.match(/<p role="status" aria-live="off" aria-label="보낼 문장">(.*?)<\/p>/)?.[1] ?? '(없음)');
const sendable = (html: string) => [...html.matchAll(/<button type="button"( disabled="")?>송신<\/button>/g)].map((m) => !m[1]);
/** A sentence of the 무전 기록, without its time and speaker. */
const logged = (e: RadioEvent) => text(renderToStaticMarkup(<RadioLog lines={[e]} callsign="갈매기" gridLetters="CH" mode="standard" />)).replace(/^\d\d:\d\d 갈매기 /, '');

/** A game brought to each form of this slice, and the input a player makes there by hand. */
const AT: { name: string; sim: () => Sim; hand: Draft; values: string[] }[] = [
  { name: '호출', sim: opened, hand: callDraft('ffe'), values: ['<option value="ffe" selected="">효력사</option>'] },
  { name: '표적위치 좌표법', sim: located, hand: locDraft(4657, 3115), values: ['value="4657"', 'value="3115"'] },
  { name: '표적위치 극좌표법', sim: located, hand: polarDraft(420, 1500), values: ['aria-label="방위각" inputMode="numeric" maxLength="4" size="4" value="0420"', 'value="1500"'] },
  { name: '위치 보고', sim: moved, hand: posDraft('4040', '3032')!, values: ['value="4040"', 'value="3032"'] },
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

test('F-18: 말로 넣은 입력은 입력기가 만든 입력과 같다', async () => {
  for (const { name, sim: make, hand, values } of AT) {
    const sim = make();
    const before = composer(sim);
    // Said: the form is filled and nothing is sent yet (값이 있는 한 마디는 저절로 나가지 않는다).
    const r = await talkTo(sim, [said(hand)]);
    expect([r.listening, r.line, r.sent], name).toEqual(['듣는 중', `들린 글: ${said(hand)}`, []]);
    expect(r.fills, name).toHaveLength(1);
    expect(r.hushes, name).toEqual([true, false]);
    // The filled form shows the values, and its 보낼 문장 is the sentence of the input made by hand; 송신 can be pressed.
    const filled = composer(sim, r.fills[0]);
    for (const v of values) expect(filled, `${name} ${v}`).toContain(v);
    expect(preview(filled), name).toBe(said(hand));
    expect(sendable(filled).at(0), name).toBe(true);
    // 실전: the values are there, the sentence is not shown.
    const combat = composer(sim, r.fills[0], 'combat');
    for (const v of values) expect(combat, `${name} 실전 ${v}`).toContain(v);
    expect(preview(combat), name).toBe('(없음)');
    // Sent by hand, the simulation says that same sentence: the spoken form sends the same input (F-07 holds the 보낼 문장).
    const taken = send(sim, hand.input);
    expect(taken.ok, name).toBe(true);
    expect(logged(taken.events[0]!), name).toBe(preview(filled));
    // 못 알아들음: nothing is filled or sent, the form stays as it was, and the line shows what was heard.
    const sim2 = make();
    const missed = await talkTo(sim2, ['기러기 여기는 갈매기 이상']);
    expect([missed.fills, missed.sent, missed.line], name).toEqual([[], [], '알아듣지 못했습니다 · 들린 글: 기러기 여기는 갈매기 이상']);
    expect(composer(sim2), name).toBe(before);
    expect((await talkTo(sim2, [])).line, name).toBe('알아듣지 못했습니다');
    // The form was built again before the 들린 글 came: it is dropped.
    const late = await talkTo(sim2, [said(hand)], undefined, () => false);
    expect([late.fills, late.sent, late.line], name).toEqual([[], [], '']);
  }
});

test('F-18: 말로 넣은 입력 — 준비 쏴는 맞으면 바로 나가고 F 키의 입력과 같다', async () => {
  const sim = opened();
  toReady(sim, DESC_AMC);
  expect(openForms(sim.state.radio.stage, sim.state)).toEqual([{ form: 'fire' }]);
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
  expect(openForms(sim.state.radio.stage, sim.state)).toEqual([]);
  expect((await talkTo(sim, ['조정'])).listening).toBe('');
  openRadio(sim);
  send(sim, CALL_ADJUST);
  expect([sim.state.radio.stage, openForms(sim.state.radio.stage, sim.state)]).toEqual(['wait', []]);
  const walking = opened();
  walking.step([MOVE(400, 320)]);
  expect([walking.state.post.state, openForms(walking.state.radio.stage, walking.state)]).toEqual(['moving', []]);
  const flying = opened();
  toReady(flying);
  radioEvents(flying, 5);
  expect(openForms(flying.state.radio.stage, flying.state)).toEqual([]);
  // The button: pressed while listening, not pressable with no form open, absent with 음성 입력 off.
  const bar = (forms: Parameters<typeof TalkBar>[0]['forms'], line: Parameters<typeof TalkBar>[0]['line'] = null) =>
    renderToStaticMarkup(<TalkBar talk={{ press: () => {}, release: async () => {} }} line={line} forms={forms} names={NAMES} formKey="k" onFill={() => {}} send={() => {}} />);
  expect(bar([{ form: 'call' }])).toBe('<p><button type="button" aria-pressed="false">눌러서 말하기 <kbd>V</kbd></button> <output aria-label="들린 글"></output></p>');
  expect(bar([])).toContain('<button type="button" disabled="" aria-pressed="false">');
  expect(text(bar([{ form: 'call' }], { state: 'working' }))).toBe('눌러서 말하기 V 알아듣는 중');
  expect(bar([{ form: 'call' }], { state: 'listening' })).toContain('aria-pressed="true"');
  const idle = opened();
  expect(composer(idle)).not.toContain('눌러서 말하기');
  const withBar = renderToStaticMarkup(
    <Composer stage="idle" live platoons={[]} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={idle.state} talk={<TalkBar talk={{ press: () => {}, release: async () => {} }} line={null} forms={[{ form: 'call' }]} names={NAMES} formKey="k" onFill={() => {}} send={() => {}} />} />,
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
