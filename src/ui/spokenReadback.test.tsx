// 실전의 말로 하는 복창 (M4-8, #181): what is said fills the 복창 상자, and the box makes the `readback` input as before.
// The simulation is driven through its public interface; a press and a release are the 눌러서 말하기 controller's calls.
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { createSim, type Input, type MtoSlots, type Sim } from '@sim';
import { fakeRecogniser } from '@adapters/mock/voiceInput';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { buttonsOf, press, recording } from '../../tests/acceptance/buttons';
import { combatInit, START } from '../../tests/acceptance/init';
import { corr, openRadio, radioEvents, send, toReady, untilImpact } from '../../tests/acceptance/mission';
import { openForms } from './openForms';
import type { Fill, OpenForm } from './radio/matching';
import { radioSentence, spoken } from './radio/sentence';
import { readbackInput, type Entry } from './readback';
import { ReadbackBox, ReadbackForm } from './ReadbackBox';
import { createTalk, talkText } from './talk';

vi.mock('react/jsx-dev-runtime', async (real) => recording(await real<object>()));
vi.mock('react/jsx-runtime', async (real) => recording(await real<object>()));

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const UNKNOWN_ONLY = { desc: [{ targetType: 'unknown' }], shift: [{ targetType: 'unknown' }] } as const;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
/** A combat game with no enemy, a 조정 mission at 사격준비 끝: the 사격지휘통보 readback is owed. */
function owing(): Sim {
  const sim = createSim({ ...combatInit(7), scenario: { ...BASE_SCENARIO, units: [] } });
  sim.step([START]);
  openRadio(sim);
  toReady(sim);
  return sim;
}
const mission = (sim: Sim) => sim.state.missions.at(-1)!;
const mto = (sim: Sim): MtoSlots => ({ ...mission(sim).mto! });
const forms = (sim: Sim): OpenForm[] => openForms(sim.state.radio.stage, sim.state, UNKNOWN_ONLY);
/** The readback sentence as the 복창 상자 writes it. */
const sentence = (m: MtoSlots) => spoken(radioSentence({ speaker: 'observer', ending: 'wait', kind: 'mto', slots: m }, NAMES));
/** One press and release: what was filled, what was sent, the line. */
async function say(sim: Sim, heard: string[]) {
  const out = { fills: [] as Fill[], sent: [] as Input[] };
  const talk = createTalk(fakeRecogniser(heard), () => {});
  talk.press({ forms: forms(sim), names: NAMES, open: () => true, fill: (f) => void out.fills.push(f), send: (i) => void out.sent.push(i) });
  await talk.release();
  return { ...out, line: talkText(talk.line) };
}
const entryOf = (fill: Fill | undefined): Entry => (fill?.form === 'readback' ? fill.entry : { fuze: null, rounds: '', amc: false, tn: '' });
/** The 복창 상자 as drawn with what was said. */
const box = (sim: Sim, fill: Fill | null) => renderToStaticMarkup(<ReadbackBox mission={mission(sim)} queued={[]} send={() => {}} spoken={fill} />);
/** The 복창 상자 drawn with what was said and its 복창 송신 pressed (not when it cannot be): what the box sent. */
function sendOf(sim: Sim, fill: Fill | null, queued: Input[] = []): Input[] {
  const sent: Input[] = [];
  press(buttonsOf(() => renderToStaticMarkup(<ReadbackBox mission={mission(sim)} queued={queued} send={(i) => void sent.push(i)} spoken={fill} />), '복창 송신')[0]);
  return sent;
}
const points = (sim: Sim) => sim.state.signature!.points;

test('실전: 말로 하는 복창 — 말한 문장이 복창 상자의 네 칸을 채우고 보낸 입력은 손으로 넣은 복창과 같다', async () => {
  const sim = owing();
  const right = mto(sim);
  expect(forms(sim)).toEqual([{ form: 'readback', asked: 'mto' }]);
  const before = points(sim);
  // Said as the box writes it: the four fields, nothing sent, no 노출.
  const r = await say(sim, [sentence(right)]);
  expect(r.sent).toEqual([]);
  expect(r.fills).toEqual([{ form: 'readback', entry: { fuze: right.fuze, rounds: String(right.rounds), amc: right.control === 'amc', tn: String(right.targetNumber).padStart(4, '0') } }]);
  expect(r.line).toBe(`들린 글: ${sentence(right)}`);
  expect(points(sim)).toBe(before);
  const drawn = box(sim, r.fills[0]!);
  expect(drawn).toContain(`aria-label="발수" inputMode="numeric" maxLength="1" size="1" value="${right.rounds}"`);
  expect(drawn).toContain(`aria-label="표적번호" inputMode="numeric" maxLength="4" size="4" value="${right.targetNumber}"`);
  expect(drawn).toMatch(new RegExp(`<button type="button" aria-pressed="true">${right.fuze === 'quick' ? '순발신관' : '접근신관'}</button>`));
  expect(drawn).toContain('<button type="button">복창 송신</button>'); // filled in: it can be pressed
  // 복창 송신 pressed: the box sends the input it makes from typed fields, and 기러기 takes it. Unfilled, or with a readback
  // already on its way, the press sends nothing.
  expect(sendOf(sim, null)).toEqual([]);
  expect(sendOf(sim, r.fills[0]!, [{ a: 'readback', v: ['shot'] }])).toEqual([]);
  const [input] = sendOf(sim, r.fills[0]!);
  expect(input).toEqual({ a: 'readback', v: ['mto', right.fuze, right.rounds, right.control, right.targetNumber] });
  expect(input).toEqual(readbackInput('mto', entryOf(r.fills[0])));
  expect(send(sim, input!).ok).toBe(true);
  expect(mission(sim).readback!.mto).toBe(false);
  expect(points(sim)).toBe(before + 1); // 보낸 것만 복창이다
});

test('실전: 말로 하는 복창 — 하나발 떳다와 마감탄 떳다는 맞으면 바로 나가고 못 알아들은 글에서는 입력도 노출도 없다', async () => {
  const sim = owing();
  expect(send(sim, readbackInput('mto', entryOf((await say(sim, [sentence(mto(sim))])).fills[0]))!).ok).toBe(true);
  untilImpact(sim);
  radioEvents(sim, 30);
  // 하나발 떳다 is owed at 수정: what is said goes to the box, not to the 수정 form.
  expect([sim.state.radio.stage, forms(sim)]).toEqual(['adjust', [{ form: 'readback', asked: 'shot' }]]);
  const before = points(sim);
  // Not understood: a 수정 said now, half the words, another readback's words. Nothing is sent, so nothing is scored.
  for (const heard of ['우로 여섯십, 줄이기 둘백', '하나발', '마감탄 떳다', '']) {
    const missed = await say(sim, heard ? [heard] : []);
    expect([missed.fills, missed.sent], heard).toEqual([[], []]);
    expect(missed.line, heard).toBe(heard ? `알아듣지 못했습니다 · 들린 글: ${heard}` : '알아듣지 못했습니다');
  }
  expect(points(sim)).toBe(before);
  // Said: sent at once, the input the box's button sends.
  const shot = await say(sim, ['하나발 떳다, 잠깐대기']);
  expect([shot.fills, shot.sent]).toEqual([[], [readbackInput('shot', entryOf(undefined))]]);
  expect(send(sim, shot.sent[0]!).ok).toBe(true);
  expect(points(sim)).toBe(before + 1);
  // Nothing owed: the 수정 form is the open one again.
  expect(forms(sim)).toEqual([{ form: 'corr', needsDirection: true }]);
  expect(send(sim, corr(800, 'right', 60, 'drop', 200, 'ffe')).ok).toBe(true);
  for (let k = 0; k < 4000 && !mission(sim).readback?.rounds_complete; k++) sim.step([]);
  expect(send(sim, { a: 'readback', v: ['shot'] }).ok).toBe(true);
  expect(forms(sim)).toEqual([{ form: 'readback', asked: 'rounds_complete' }]);
  const done = await say(sim, ['마감탄 떳다']);
  expect(done.sent).toEqual([{ a: 'readback', v: ['rounds_complete'] }]);
  expect(send(sim, done.sent[0]!).ok).toBe(true);
});

test('실전: 말로 하는 복창 — 틀리게 들린 값을 보내면 틀린 복창이고 정정 뒤 다시 말하면 네 칸이 새 값이 된다', async () => {
  const sim = owing();
  const right = mto(sim);
  const before = points(sim);
  // Heard with another 발수: filled as heard, and sent as it stands it is a wrong readback like a typed one.
  const wrongRounds = right.rounds === 1 ? 2 : 1;
  const wrong = await say(sim, [sentence({ ...right, rounds: wrongRounds })]);
  const [sentWrong] = sendOf(sim, wrong.fills[0]!);
  expect(sentWrong).toEqual({ a: 'readback', v: ['mto', right.fuze, wrongRounds, right.control, right.targetNumber] });
  expect(send(sim, sentWrong!).ok).toBe(true);
  expect(points(sim)).toBe(before + 1);
  const said = radioEvents(sim, 60);
  expect(said.filter((e) => e.utterance.speaker === 'fdc' && e.utterance.kind === 'mto_correction')).toHaveLength(1);
  expect(mission(sim).readback!.mto).toBe(true); // still owed
  // The 정정 is in: the box marks the wrong field, with what was said still in it.
  const marked = renderToStaticMarkup(
    ReadbackForm({ mission: mission(sim), queued: [], entry: entryOf(wrong.fills[0]), sent: { ...right, rounds: wrongRounds }, onEntry: () => {}, onSend: () => {} })!,
  );
  expect(text(marked)).toContain('틀린 칸: 발수');
  expect(marked).toContain(`style="outline:2px solid #e53935" value="${wrongRounds}"`);
  // Said again: the four fields are the new ones, and that readback is taken.
  expect(forms(sim)).toEqual([{ form: 'readback', asked: 'mto' }]);
  const again = await say(sim, [sentence(right)]);
  expect(box(sim, again.fills[0]!)).toContain(`aria-label="발수" inputMode="numeric" maxLength="1" size="1" value="${right.rounds}"`);
  expect(send(sim, readbackInput('mto', entryOf(again.fills[0]))!).ok).toBe(true);
  expect(mission(sim).readback!.mto).toBe(false);
});
