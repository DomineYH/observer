// 음성 입력 설정 (M4-3): the setting's button and its one line, driven by an 음성 입력 the test settles by hand.
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim } from '@sim';
import { VoiceInputError, VOICE_INPUT_FAILURES, type VoiceInput } from '@adapters/index';
import { init, START } from '../../tests/acceptance/init';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { SoundToggles } from './SoundToggles';
import { createVoiceSetting } from './voiceSetting';

/** An 음성 입력 whose `open` the test resolves or rejects, counting its calls. */
function handInput() {
  const calls = { open: 0, close: 0 };
  let settle!: { resolve: () => void; reject: (e: unknown) => void };
  const input: VoiceInput = {
    open: () => (calls.open++, new Promise<void>((resolve, reject) => (settle = { resolve, reject }))),
    listen: () => ({ stop: () => Promise.resolve([]), cancel: () => {} }),
    close: () => void calls.close++,
  };
  return { calls, input, settle: () => settle };
}
const SOUND = { settings: { voice: false, effects: true }, set: () => {} };
const text = (html: string) => html.replace(/<[^>]*>/g, '');
/** The 소리 설정 group as shown: its text, and whether the 음성 입력 button is pressed (null without the button). */
function shown(setting?: ReturnType<typeof createVoiceSetting>) {
  const html = renderToStaticMarkup(<SoundToggles sound={SOUND} voiceInput={setting && { setting: setting.setting, toggle: setting.toggle }} />);
  const pressed = html.match(/aria-pressed="(true|false)">음성 입력</)?.[1];
  return { text: text(html), pressed: pressed === undefined ? null : pressed === 'true' };
}
const settled = () => new Promise<void>((r) => setTimeout(r));

test('F-18: 못 쓰는 환경에서는 글자 입력으로 한 판이 된다', async () => {
  const sim = createSim(init(7));
  sim.step([START]);
  const composer = () =>
    renderToStaticMarkup(
      <Composer stage={sim.state.radio.stage} live platoons={sim.state.platoons} names={{ callsign: '갈매기', gridLetters: 'CH' }} grid={flatTerrain().grid} mode={sim.state.mode} send={() => {}} state={sim.state} />,
    );
  const typed = composer();
  const REASONS = { unsupported: '이 브라우저에서는 음성 입력을 쓸 수 없습니다', denied: '마이크 권한이 없습니다', model: '음성 모델을 받지 못했습니다' };
  for (const reason of VOICE_INPUT_FAILURES) {
    const hand = handInput();
    let changes = 0;
    const setting = createVoiceSetting(hand.input, () => void changes++);
    // Off by default: the button and nothing beside it.
    expect(shown(setting), reason).toEqual({ text: '소리음성음성 입력', pressed: false });
    setting.toggle();
    expect(shown(setting), reason).toEqual({ text: '소리음성음성 입력 음성 모델 받는 중', pressed: true });
    hand.settle().reject(new VoiceInputError(reason));
    await settled();
    // Off again, with the cause beside the button; the 입력기 is as it was.
    expect(shown(setting), reason).toEqual({ text: `소리음성음성 입력 ${REASONS[reason]}`, pressed: false });
    expect(setting.setting, reason).toEqual({ state: 'off', failure: reason });
    expect(changes, reason).toBe(2);
    expect(composer(), reason).toBe(typed);
    // Pressed again it tries again (the cause goes); this time it opens, and pressing once more lets it go.
    setting.toggle();
    expect(shown(setting).text, reason).toBe('소리음성음성 입력 음성 모델 받는 중');
    hand.settle().resolve();
    await settled();
    expect(shown(setting), reason).toEqual({ text: '소리음성음성 입력', pressed: true });
    setting.toggle();
    expect([shown(setting), hand.calls], reason).toEqual([{ text: '소리음성음성 입력', pressed: false }, { open: 2, close: 1 }]);
  }
});

test('F-18: 못 쓰는 환경 — 받는 중에 끄면 그만두고 늦게 온 결과가 설정을 켜지 않는다', async () => {
  for (const late of ['resolve', 'reject'] as const) {
    const hand = handInput();
    const setting = createVoiceSetting(hand.input);
    setting.toggle();
    const first = hand.settle();
    setting.toggle(); // off while 받는 중
    expect([setting.setting, hand.calls], late).toEqual([{ state: 'off', failure: null }, { open: 1, close: 1 }]);
    if (late === 'resolve') first.resolve();
    else first.reject(new VoiceInputError('model'));
    await settled();
    expect(shown(setting), late).toEqual({ text: '소리음성음성 입력', pressed: false });
    // On again while the first result is still out: only the second attempt's result counts.
    const again = handInput();
    const other = createVoiceSetting(again.input);
    other.toggle();
    const old = again.settle();
    other.toggle();
    other.toggle();
    if (late === 'resolve') old.resolve();
    else old.reject(new VoiceInputError('denied'));
    await settled();
    expect(other.setting, late).toEqual({ state: 'opening' });
    again.settle().resolve();
    await settled();
    expect(other.setting, late).toEqual({ state: 'on' });
  }
});

test('F-18: 못 쓰는 환경 — 좁은 화면에는 음성 입력 단추가 없다', () => {
  expect(shown()).toEqual({ text: '소리음성', pressed: null });
});
