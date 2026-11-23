// vosk 어댑터 (ADR 0023, #178): the real 음성 입력. vosk small-ko runs in this browser through vosk-browser and hears only
// the 들을 낱말 it is given; no sound leaves the machine. The model is fetched from this origin (npm run voice:fetch puts
// it there) and vosk-browser keeps it in IndexedDB, so the next 음성 입력 does not fetch it again.
import { VoiceInputError, type Listening, type VoiceInput } from '../index';
import { toGrammar } from './pieces';

export const RATE = 16000;
export const MODEL_URL = '/voice/vosk-model-small-ko-0.22.tar.gz';
/** The model is not ready this long after it was asked for: `model` (a private window hangs while storing it). */
export const MODEL_LIMIT_MS = 180_000;
/** 자료 출처: shown where the 음성 입력 is this adapter. */
export const VOICE_CREDITS = ['음성 모델 vosk-model-small-ko-0.22 (Alpha Cephei, Apache-2.0)', 'vosk-browser 0.0.8 (Apache-2.0)'];

/** The microphone, open: 16 kHz samples go to `heard` while it is set. */
export interface Mic {
  heard: ((samples: Float32Array) => void) | null;
  close(): void;
}
export interface Recogniser {
  feed(samples: Float32Array): void;
  /** No more sound: the 들린 글 ('' when nothing was heard). */
  finish(): Promise<string>;
  remove(): void;
}
export interface Model {
  recogniser(grammar: readonly string[]): Recogniser;
  close(): void;
}
/** What the adapter needs of the browser; the tests give their own. */
export interface VoskEnv {
  /** 마이크 · WebAssembly · Worker · IndexedDB are all there. */
  capable(): boolean;
  /** Asks for the microphone. Rejects as `getUserMedia` does. */
  microphone(): Promise<Mic>;
  /** Fetches the model (once) and loads it. Rejects when the file is not there. */
  model(): Promise<Model>;
  /** A 들을 낱말 that cannot be given to the 인식기: a warning for whoever develops, nothing on screen. */
  lost(word: string): void;
}

const NOTHING: Listening = { stop: () => Promise.resolve([]), cancel: () => {} };

export function voskInput(env: VoskEnv = browserEnv()): VoiceInput {
  let mic: Mic | null = null;
  let model: Model | null = null;
  let turn = 0; // `close` ends the turn: an `open` still under way lets go of what it gets
  const release = () => {
    mic?.close();
    model?.close();
    mic = model = null;
  };
  return {
    async open() {
      const mine = ++turn;
      release();
      if (!env.capable()) throw new VoiceInputError('unsupported');
      // No microphone at all is this machine's lack; anything else is the permission not given.
      const got = await env.microphone().catch((e: unknown) => {
        throw new VoiceInputError((e as { name?: string } | null)?.name === 'NotFoundError' ? 'unsupported' : 'denied', { cause: e });
      });
      if (mine !== turn) return got.close();
      mic = got;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('180 s')), MODEL_LIMIT_MS)));
      const loading = env.model();
      try {
        const loaded = await Promise.race([loading, late]);
        if (mine !== turn) return loaded.close();
        model = loaded;
      } catch (e) {
        loading.then((m) => m.close(), () => {}); // one that still comes is let go
        if (mine === turn) release();
        throw new VoiceInputError('model', { cause: e });
      } finally {
        clearTimeout(timer);
      }
    },
    listen(words) {
      if (!mic || !model) return NOTHING;
      const [on, rec] = [mic, model.recogniser(toGrammar(words, env.lost))];
      on.heard = (samples) => rec.feed(samples);
      const done = () => {
        if (on.heard) on.heard = null;
      };
      return {
        async stop() {
          done();
          const text = await rec.finish().catch(() => '');
          rec.remove();
          return text ? [text] : [];
        },
        cancel() {
          done();
          rec.remove();
        },
      };
    },
    close() {
      turn++;
      release();
    },
  };
}

type VoskRecogniser = {
  on(event: 'result', listener: (m: { result?: { text?: string } }) => void): void;
  acceptWaveformFloat(samples: Float32Array, rate: number): void;
  retrieveFinalResult(): void;
  remove(): void;
};
type VoskModel = { KaldiRecognizer: new (rate: number, grammar: string) => VoskRecogniser; terminate(): void };
const QUIET_MS = 500; // no event says which result is the last: it is the one no other follows this long
const FINISH_LIMIT_MS = 10_000;

/** The browser's own: getUserMedia, an AudioContext at 16 kHz, vosk-browser loaded only when 음성 입력 is turned on. */
export function browserEnv(): VoskEnv {
  const told = new Set<string>(); // each lost word is said once, in the console
  return {
    capable: () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof indexedDB === 'object',
    async microphone() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const audio = new AudioContext({ sampleRate: RATE });
      const source = audio.createMediaStreamSource(stream);
      // ponytail: ScriptProcessorNode is deprecated but needs no worklet file; move to an AudioWorklet when a browser drops it.
      const tap = audio.createScriptProcessor(4096, 1, 1);
      const mic: Mic = {
        heard: null,
        close() {
          tap.disconnect();
          source.disconnect();
          for (const track of stream.getTracks()) track.stop();
          void audio.close();
        },
      };
      tap.onaudioprocess = (e) => mic.heard?.(e.inputBuffer.getChannelData(0).slice()); // −1…1 as it comes: scaled up, vosk hears nonsense
      source.connect(tap);
      tap.connect(audio.destination); // it only runs while connected; its output is silence
      return mic;
    },
    async model() {
      // A missing file must not be the page itself: a static host answers an unknown path with its index.
      const head = await fetch(MODEL_URL, { method: 'HEAD' });
      if (!head.ok || (head.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`${MODEL_URL}: ${head.status}`);
      const vosk = (await import('vosk-browser')) as unknown as { createModel?: (url: string) => Promise<VoskModel>; default?: { createModel(url: string): Promise<VoskModel> } };
      const loaded = await (vosk.createModel ?? vosk.default!.createModel)(MODEL_URL);
      return {
        recogniser(grammar) {
          const rec = new loaded.KaldiRecognizer(RATE, JSON.stringify(grammar));
          const texts: string[] = [];
          let quiet = () => {};
          rec.on('result', (m) => {
            if (m.result?.text) texts.push(m.result.text);
            quiet();
          });
          return {
            feed: (samples) => rec.acceptWaveformFloat(samples, RATE),
            finish: () =>
              new Promise<string>((done) => {
                let timer = setTimeout(() => done(texts.join(' ').trim()), FINISH_LIMIT_MS);
                quiet = () => {
                  clearTimeout(timer);
                  timer = setTimeout(() => done(texts.join(' ').trim()), QUIET_MS);
                };
                rec.retrieveFinalResult();
              }),
            remove: () => rec.remove(),
          };
        },
        close: () => loaded.terminate(),
      };
    },
    lost: (word) => {
      if (told.has(word)) return;
      told.add(word);
      console.warn(`음성 입력: 모델이 모르는 낱말이라 듣지 않는다: ${word}`);
    },
  };
}
