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
  /** Starts fetching (once) and loading the model. `ready` rejects when the file is not there; `cancel` stops the
   * loading and frees what it took, whether or not `ready` has settled. */
  model(): { ready: Promise<Model>; cancel(): void };
  /** A 들을 낱말 that cannot be given to the 인식기: a warning for whoever develops, nothing on screen. */
  lost(word: string): void;
}

const NOTHING: Listening = { stop: () => Promise.resolve([]), cancel: () => {} };

export function voskInput(env: VoskEnv = browserEnv()): VoiceInput {
  let mic: Mic | null = null;
  let model: Model | null = null;
  let turn = 0; // `close` ends the turn: an `open` still under way lets go of what it gets
  let giveUp: (() => void) | null = null; // ends the wait of an `open` that is loading the model
  const release = () => {
    mic?.close();
    model?.close();
    mic = model = null;
  };
  return {
    async open() {
      const mine = ++turn;
      giveUp?.();
      release();
      if (!env.capable()) throw new VoiceInputError('unsupported');
      // No microphone, or no way to read its sound, is this machine's lack; anything else is the permission not given.
      const got = await env.microphone().catch((e: unknown) => {
        const name = (e as { name?: string } | null)?.name;
        throw new VoiceInputError(name === 'NotFoundError' || name === 'NotSupportedError' ? 'unsupported' : 'denied', { cause: e });
      });
      if (mine !== turn) return got.close();
      mic = got;
      const loading = env.model();
      loading.ready.catch(() => {}); // a refusal after the wait was given up is nobody's
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stopped = new Promise<never>((_, reject) => {
        giveUp = () => reject(new Error('closed'));
        timer = setTimeout(() => reject(new Error('180 s')), MODEL_LIMIT_MS);
      });
      try {
        model = await Promise.race([loading.ready, stopped]);
      } catch (e) {
        loading.cancel(); // the fetch and the worker go, loaded or not
        if (mine !== turn) return; // turned off meanwhile: `close` let the microphone go
        release();
        throw new VoiceInputError('model', { cause: e });
      } finally {
        clearTimeout(timer);
        giveUp = null;
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
      giveUp?.();
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
type VoskModel = { KaldiRecognizer: new (rate: number, grammar: string) => VoskRecogniser; on(event: 'load', listener: (m: { result?: boolean }) => void): void; terminate(): void };
type VoskModule = { Model: new (url: string) => VoskModel };
const QUIET_MS = 500; // no event says which result is the last: it is the one no other follows this long
const FINISH_LIMIT_MS = 10_000;

/** The browser's own: getUserMedia, an AudioContext at 16 kHz, vosk-browser loaded only when 음성 입력 is turned on. */
export function browserEnv(): VoskEnv {
  const told = new Set<string>(); // each lost word is said once, in the console
  return {
    capable: () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof WebAssembly === 'object' && typeof Worker === 'function' && typeof indexedDB === 'object',
    async microphone() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      let audio: AudioContext | undefined;
      const stop = () => {
        for (const track of stream.getTracks()) track.stop();
        void audio?.close();
      };
      try {
        audio = new AudioContext({ sampleRate: RATE });
        const source = audio.createMediaStreamSource(stream);
        // ponytail: ScriptProcessorNode is deprecated but needs no worklet file; move to an AudioWorklet when a browser drops it.
        const tap = audio.createScriptProcessor(4096, 1, 1);
        const mic: Mic = {
          heard: null,
          close() {
            tap.disconnect();
            source.disconnect();
            stop();
          },
        };
        tap.onaudioprocess = (e) => mic.heard?.(e.inputBuffer.getChannelData(0).slice()); // −1…1 as it comes: scaled up, vosk hears nonsense
        source.connect(tap);
        tap.connect(audio.destination); // it only runs while connected; its output is silence
        return mic;
      } catch (e) {
        // The permission was given but the sound cannot be read here: the microphone is let go, and it is this browser's lack.
        stop();
        throw Object.assign(new Error('audio', { cause: e }), { name: 'NotSupportedError' });
      }
    },
    model() {
      const abort = new AbortController();
      let made: VoskModel | null = null;
      const load = async (): Promise<Model> => {
        // A missing file must not be the page itself: a static host answers an unknown path with its index.
        const head = await fetch(MODEL_URL, { method: 'HEAD', signal: abort.signal });
        if (!head.ok || (head.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`${MODEL_URL}: ${head.status}`);
        const vosk = (await import('vosk-browser')) as unknown as VoskModule & { default?: VoskModule };
        if (abort.signal.aborted) throw new Error('cancelled');
        // The model object is there before it has loaded, so its worker can be ended while it loads.
        const loaded = (made = new (vosk.Model ?? vosk.default!.Model)(MODEL_URL));
        await new Promise<void>((done, fail) => loaded.on('load', (m) => (m.result ? done() : fail(new Error('load')))));
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
      };
      return {
        ready: load(),
        cancel() {
          abort.abort();
          made?.terminate();
        },
      };
    },
    lost: (word) => {
      if (told.has(word)) return;
      told.add(word);
      console.warn(`음성 입력: 모델이 모르는 낱말이라 듣지 않는다: ${word}`);
    },
  };
}
