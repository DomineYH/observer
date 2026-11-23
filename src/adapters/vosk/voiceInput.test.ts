// vosk 어댑터, without the model: the 조각 표, the three failures and the 180 s limit. What the model really hears is
// measured where the model is (npm run voice:check) and by 사람 검수.
import { afterEach, expect, test, vi } from 'vitest';
import { VoiceInputError } from '../index';
import { PIECES, toGrammar, VOCABULARY } from './pieces';
import { browserEnv, MODEL_LIMIT_MS, voskInput, type Mic, type Model, type VoskEnv } from './voiceInput';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A browser the test holds: what it was asked, and a model the test gives or withholds. */
/** `model`: how the model comes (default: at once). Its loading is cancelled by the adapter, which the log shows. */
function fakeEnv(over: Partial<Omit<VoskEnv, 'model'>> & { model?: () => Promise<Model> } = {}) {
  const log: string[] = [];
  const mic: Mic = { heard: null, close: () => void log.push('mic closed') };
  const grammars: string[][] = [];
  const fed: number[] = [];
  const model: Model = {
    recogniser: (grammar) => {
      grammars.push([...grammar]);
      return { feed: (s) => void fed.push(s.length), finish: () => Promise.resolve(heard.shift() ?? ''), remove: () => void log.push('recogniser removed') };
    },
    close: () => void log.push('model closed'),
  };
  const heard: string[] = [];
  const { model: coming = () => Promise.resolve(model), ...rest } = over;
  const env: VoskEnv = {
    capable: () => true,
    microphone: () => Promise.resolve(mic),
    lost: (w) => void log.push(`lost ${w}`),
    ...rest,
    model: () => ({ ready: coming(), cancel: () => void log.push('loading cancelled') }),
  };
  return { env, log, mic, model, grammars, fed, heard };
}
const reason = (p: Promise<void>) => p.then(() => 'opened', (e: unknown) => (e instanceof VoiceInputError ? e.reason : `other: ${String(e)}`));

test('음성 입력: 조각 표 — 모델에 있는 낱말은 그대로, 조각 표의 낱말은 조각으로, 어느 쪽도 아닌 낱말은 빠진다', () => {
  const lost: string[] = [];
  expect(toGrammar(['기러기', '여기는', '갈매깃', '조정', '효력사', '재효력사', '이상', '효력사'], (w) => lost.push(w))).toEqual(['기러기', '여기', '는', '조정', '효력', '사', '재', '이상']);
  expect(lost).toEqual(['갈매깃']);
  // The pieces the prototype found (#177), and the two lists never hold the same word.
  expect(PIECES).toMatchObject({ 효력사: '효력 사', 임무끝: '임무 끝', 좌로: '좌 로', 우로: '우 로', 표적번호: '표적 번호', 사격지휘통보: '사격지휘 통보', 지명사: '지명 사', 잠깐대기: '잠깐 대기', 마감탄: '마감 탄', 전이: '전 이', 여기는: '여기 는', 동제원: '동 제원' });
  expect(Object.keys(PIECES).filter((w) => VOCABULARY.has(w))).toEqual([]);
  // Every piece is itself a word the model has, as far as the lists say (the model check measures the rest).
  for (const w of ['공', '하나', '둘', '삼', '넷', '오', '여섯', '칠', '팔', '아홉', '백', '십', '발', '좌표', '방위각', '거리', '포대', '준비', '쏴']) expect(VOCABULARY.has(w), w).toBe(true);
  expect(toGrammar([])).toEqual([]);
  // A callsign that is the name of something every object has is a lost word like any other, not a crash.
  const odd: string[] = [];
  expect(toGrammar(['toString', 'constructor', '__proto__', '조정'], (w) => odd.push(w))).toEqual(['조정']);
  expect(odd).toEqual(['toString', 'constructor', '__proto__']);
});

test('음성 입력: 실패의 갈래 — 능력이 없는 브라우저는 unsupported, 마이크 권한 거절은 denied, 모델 파일이 없으면 model', async () => {
  const named = (name: string) => Object.assign(new Error(name), { name });
  // No capability: nothing is asked for.
  const none = fakeEnv({ capable: () => false, microphone: () => Promise.reject(new Error('must not be asked')) });
  expect(await reason(voskInput(none.env).open())).toBe('unsupported');
  // The permission refused (or the prompt dismissed); a machine with no microphone is unsupported.
  for (const [name, why] of [['NotAllowedError', 'denied'], ['SecurityError', 'denied'], ['AbortError', 'denied'], ['NotFoundError', 'unsupported'], ['NotSupportedError', 'unsupported']] as const)
    expect(await reason(voskInput(fakeEnv({ microphone: () => Promise.reject(named(name)) }).env).open()), name).toBe(why);
  // The model file is not there: the microphone that was opened is let go.
  const missing = fakeEnv({ model: () => Promise.reject(new Error('404')) });
  const input = voskInput(missing.env);
  expect(await reason(input.open())).toBe('model');
  expect(missing.log).toEqual(['loading cancelled', 'mic closed']);
  expect(await input.listen(['조정']).stop()).toEqual([]); // nothing listens after a failure
  // It may be tried again.
  const again = fakeEnv();
  const ok = voskInput(again.env);
  expect(await reason(ok.open())).toBe('opened');
});

test('음성 입력: 실패의 갈래 — 모델이 180초 안에 오지 않으면 model이고, 그 사이에 끄면 늦게 온 것을 놓는다', async () => {
  vi.useFakeTimers();
  // Never comes (a private window hangs while storing the model).
  const never = fakeEnv({ model: () => new Promise(() => {}) });
  const waiting = reason(voskInput(never.env).open());
  await vi.advanceTimersByTimeAsync(MODEL_LIMIT_MS - 1);
  expect(never.log).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(await waiting).toBe('model');
  expect(never.log).toEqual(['loading cancelled', 'mic closed']); // the worker still loading is ended, not left
  // Turned off while the model loads: the wait ends at once, the loading is cancelled, and no timer is left behind.
  const off = fakeEnv({ model: () => new Promise(() => {}) });
  const closing = voskInput(off.env);
  const opening = reason(closing.open());
  await vi.advanceTimersByTimeAsync(1000);
  closing.close();
  expect(await opening).toBe('opened'); // the setting dropped this attempt already; nothing is kept
  expect(off.log).toEqual(['mic closed', 'loading cancelled']);
  expect(vi.getTimerCount()).toBe(0);
  expect(await closing.listen(['조정']).stop()).toEqual([]);
  // Turned off in the very moment the model is ready: it is closed, not kept for a setting that is off.
  let ready!: (m: Model) => void;
  const edge = fakeEnv({ model: () => new Promise((r) => (ready = r)) });
  const edging = voskInput(edge.env);
  const done = reason(edging.open());
  await vi.advanceTimersByTimeAsync(0);
  ready(edge.model);
  edging.close();
  expect(await done).toBe('opened');
  expect(edge.log).toEqual(['mic closed', 'model closed']);
  expect(await edging.listen(['조정']).stop()).toEqual([]);
  // Turned on again while the first is still loading: the first gives up, the second opens.
  let give!: (m: Model) => void;
  let asked = 0;
  const twice = fakeEnv({ model: () => (asked++ ? new Promise((r) => (give = r)) : new Promise(() => {})) });
  const input = voskInput(twice.env);
  const first = reason(input.open());
  await vi.advanceTimersByTimeAsync(0); // the first has its microphone and waits for its model
  const second = reason(input.open());
  await vi.advanceTimersByTimeAsync(0);
  give(twice.model);
  expect([await first, await second]).toEqual(['opened', 'opened']);
  expect(twice.log).toEqual(['mic closed', 'loading cancelled']);
  twice.heard.push('조정');
  expect(await input.listen(['조정']).stop()).toEqual(['조정']);
  expect(vi.getTimerCount()).toBe(0);
});

test('음성 입력: 실패의 갈래 — 마이크는 얻었는데 소리를 읽을 수 없으면 마이크를 놓고 unsupported다', async () => {
  // The browser's own microphone path, with a stream that cannot be connected.
  const stops: string[] = [];
  const stream = { getTracks: () => [{ stop: () => void stops.push('track stopped') }] };
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve(stream) } });
  vi.stubGlobal(
    'AudioContext',
    class {
      createMediaStreamSource(): never {
        throw new Error('no audio graph');
      }
      close() {
        stops.push('context closed');
        return Promise.resolve();
      }
    },
  );
  const refused = await browserEnv().microphone().catch((e: unknown) => e);
  expect((refused as { name: string }).name).toBe('NotSupportedError');
  expect(stops).toEqual(['track stopped', 'context closed']);
  const env = { ...fakeEnv().env, microphone: () => browserEnv().microphone() };
  expect(await reason(voskInput(env).open())).toBe('unsupported');
});

test('음성 입력: 듣기 — 들을 낱말을 조각으로 주고 말하는 동안의 소리만 흘려 넣으며 떼면 들린 글을 낸다', async () => {
  const f = fakeEnv();
  const input = voskInput(f.env);
  await input.open();
  f.mic.heard?.(new Float32Array(1)); // not listening: the sound goes nowhere
  f.heard.push('기러기 여기 는 갈매기 효력 사 이상');
  const listening = input.listen(['기러기', '여기는', '갈매깃', '효력사', '이상']);
  expect(f.grammars).toEqual([['기러기', '여기', '는', '효력', '사', '이상']]);
  expect(f.log).toEqual(['lost 갈매깃']);
  f.mic.heard!(new Float32Array(4096));
  f.mic.heard!(new Float32Array(4096));
  expect(await listening.stop()).toEqual(['기러기 여기 는 갈매기 효력 사 이상']);
  expect(f.mic.heard).toBeNull();
  expect(f.fed).toEqual([4096, 4096]);
  // Nothing heard is an empty list; a cancelled listening gives nothing and frees its recogniser.
  expect(await input.listen(['조정']).stop()).toEqual([]);
  input.listen(['조정']).cancel();
  expect(f.mic.heard).toBeNull();
  expect(f.log.filter((l) => l === 'recogniser removed')).toHaveLength(3);
  // Off: the microphone and the model are let go.
  input.close();
  expect(f.log.slice(-2)).toEqual(['mic closed', 'model closed']);
  expect(await input.listen(['조정']).stop()).toEqual([]);
});
