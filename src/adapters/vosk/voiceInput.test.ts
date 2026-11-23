// vosk 어댑터, without the model: the 조각 표, the three failures and the 180 s limit. What the model really hears is
// measured where the model is (npm run voice:check) and by 사람 검수.
import { afterEach, expect, test, vi } from 'vitest';
import { VoiceInputError } from '../index';
import { PIECES, toGrammar, VOCABULARY } from './pieces';
import { MODEL_LIMIT_MS, voskInput, type Mic, type Model, type VoskEnv } from './voiceInput';

afterEach(() => void vi.useRealTimers());

/** A browser the test holds: what it was asked, and a model the test gives or withholds. */
function fakeEnv(over: Partial<VoskEnv> = {}) {
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
  const env: VoskEnv = { capable: () => true, microphone: () => Promise.resolve(mic), model: () => Promise.resolve(model), lost: (w) => void log.push(`lost ${w}`), ...over };
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
});

test('음성 입력: 실패의 갈래 — 능력이 없는 브라우저는 unsupported, 마이크 권한 거절은 denied, 모델 파일이 없으면 model', async () => {
  const named = (name: string) => Object.assign(new Error(name), { name });
  // No capability: nothing is asked for.
  const none = fakeEnv({ capable: () => false, microphone: () => Promise.reject(new Error('must not be asked')) });
  expect(await reason(voskInput(none.env).open())).toBe('unsupported');
  // The permission refused (or the prompt dismissed); a machine with no microphone is unsupported.
  for (const [name, why] of [['NotAllowedError', 'denied'], ['SecurityError', 'denied'], ['AbortError', 'denied'], ['NotFoundError', 'unsupported']] as const)
    expect(await reason(voskInput(fakeEnv({ microphone: () => Promise.reject(named(name)) }).env).open()), name).toBe(why);
  // The model file is not there: the microphone that was opened is let go.
  const missing = fakeEnv({ model: () => Promise.reject(new Error('404')) });
  const input = voskInput(missing.env);
  expect(await reason(input.open())).toBe('model');
  expect(missing.log).toEqual(['mic closed']);
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
  expect(never.log).toEqual(['mic closed']);
  // Comes after the limit: it is closed, not kept.
  let give!: (m: Model) => void;
  const slow = fakeEnv({ model: () => new Promise((r) => (give = r)) });
  const input = voskInput(slow.env);
  const late = reason(input.open());
  await vi.advanceTimersByTimeAsync(MODEL_LIMIT_MS);
  expect(await late).toBe('model');
  give(slow.model);
  await vi.advanceTimersByTimeAsync(0);
  expect(slow.log).toEqual(['mic closed', 'model closed']);
  // Turned off while the model loads: the open ends quietly and what comes is let go.
  const off = fakeEnv({ model: () => new Promise((r) => (give = r)) });
  const closing = voskInput(off.env);
  const opening = reason(closing.open());
  await vi.advanceTimersByTimeAsync(1000);
  closing.close();
  give(off.model);
  expect(await opening).toBe('opened'); // the setting dropped this attempt already; nothing is kept
  expect(off.log).toEqual(['mic closed', 'model closed']);
  expect(await closing.listen(['조정']).stop()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
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
