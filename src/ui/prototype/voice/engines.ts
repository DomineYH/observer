/* eslint-disable @typescript-eslint/no-explicit-any */
// PROTOTYPE (#177): the candidate recognisers behind one shape. Throwaway: vendor APIs are `any`, libraries come from a CDN.
// Offline engines take the recording (16 kHz mono floats); the built-in one listens live or to the recording played back.

export const RATE = 16000;
export interface Heard {
  text: string;
  ms: number; // from "the player stopped talking" (or: the recording was handed over) to the final text
  note?: string;
}

const SR = (): any => (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

/** 브라우저 내장 인식. `local`: Chrome 139+ `processLocally` (nothing leaves the machine). `track`: listen to this instead of the microphone. */
export function builtIn(local: boolean, track?: MediaStreamTrack) {
  const Ctor = SR();
  if (!Ctor) throw new Error('이 브라우저에는 내장 음성 인식이 없다');
  const r = new Ctor();
  r.lang = 'ko-KR';
  r.continuous = true; // not continuous, Chromium ends the session after 0.5–1 s of silence, mid-sentence
  r.interimResults = false;
  r.maxAlternatives = 3;
  if (local) r.processLocally = true;
  const finals: string[] = [];
  const others: string[] = [];
  let error = '';
  r.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      finals.push(e.results[i][0].transcript);
      for (let k = 1; k < e.results[i].length; k++) others.push(e.results[i][k].transcript);
    }
  };
  r.onerror = (e: any) => (error = `${e.error}${e.message ? `: ${e.message}` : ''}`);
  const ended = new Promise<void>((done) => (r.onend = () => done()));
  if (track) r.start(track);
  else r.start();
  return {
    async stop(): Promise<Heard> {
      const t = performance.now();
      r.stop();
      // Some builds never say `end` (seen headless): do not hang the page on it.
      const late = await Promise.race([ended.then(() => false), new Promise<boolean>((done) => setTimeout(() => done(true), 10000))]);
      if (late) {
        r.abort();
        error ||= '10초 안에 끝나지 않음';
      }
      const note = [error && `오류 ${error}`, others.length && `다른 후보: ${others.join(' / ')}`].filter(Boolean).join(' · ');
      return { text: finals.join(' ').trim(), ms: performance.now() - t, note: note || undefined };
    },
  };
}

/** Plays the recording into a track for the built-in recogniser (it cannot take a buffer), in real time. */
export async function builtInReplay(local: boolean, pcm: Float32Array): Promise<Heard> {
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, pcm.length, RATE);
  buffer.getChannelData(0).set(pcm);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const out = ctx.createMediaStreamDestination();
  source.connect(out);
  const session = builtIn(local, out.stream.getAudioTracks()[0]);
  const played = new Promise<void>((done) => (source.onended = () => done()));
  source.start();
  await played;
  await new Promise((done) => setTimeout(done, 300)); // the tail of the last word
  const heard = await session.stop();
  await ctx.close();
  return heard;
}

/** Chrome 139+: is the 기기 안 한국어 pack there, and install it (needs the click that called this). */
export async function installLocal(): Promise<string> {
  const Ctor = SR();
  if (!Ctor?.available) return '이 브라우저에는 기기 안 모드(available/install)가 없다';
  const options = { langs: ['ko-KR'], processLocally: true };
  const before = await Ctor.available(options);
  if (before === 'available') return '기기 안 한국어: 이미 있음';
  if (before === 'unavailable') return '기기 안 한국어: 쓸 수 없음(unavailable)';
  const ok = await Ctor.install(options);
  return `기기 안 한국어: ${before} → 설치 ${ok ? '됨' : '안 됨'}`;
}

const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const pipes = new Map<string, Promise<any>>();
/** Whisper (다국어) through Transformers.js: `wasm` runs single-threaded without COOP/COEP, as a static host would. */
export async function whisper(size: 'tiny' | 'base' | 'small', device: 'wasm' | 'webgpu', pcm: Float32Array | null): Promise<Heard> {
  const key = `${size}/${device}`;
  let loadMs = 0;
  if (!pipes.has(key)) {
    const t = performance.now();
    const T: any = await import(/* @vite-ignore */ TRANSFORMERS);
    const dtype = device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8';
    pipes.set(key, T.pipeline('automatic-speech-recognition', `onnx-community/whisper-${size}`, { device, dtype }));
    await pipes.get(key);
    loadMs = performance.now() - t;
  }
  const asr = await pipes.get(key);
  if (!pcm) return { text: '', ms: 0, note: `받음 ${Math.round(loadMs)} ms` };
  const t = performance.now();
  const out = await asr(pcm, { language: 'korean', task: 'transcribe' });
  return { text: String(out.text).trim(), ms: performance.now() - t, note: loadMs ? `모델 받기 ${Math.round(loadMs)} ms` : undefined };
}

const VOSK = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL = '/proto-voice/vosk-model-small-ko-0.22.tar.gz'; // fetch-vosk.sh puts it there
let voskModel: Promise<any> | null = null;
/** vosk-browser + small-ko. `phrases`: the 구절 문법 (only these word sequences can come out), if the model takes one. */
export async function vosk(pcm: Float32Array | null, phrases?: readonly string[]): Promise<Heard> {
  let loadMs = 0;
  if (!voskModel) {
    const t = performance.now();
    voskModel = (async () => {
      await new Promise<void>((done, fail) => {
        const s = document.createElement('script');
        s.src = VOSK;
        s.onload = () => done();
        s.onerror = () => fail(new Error('vosk.js를 받지 못했다'));
        document.head.append(s);
      });
      return (window as any).Vosk.createModel(VOSK_MODEL);
    })();
    await voskModel;
    loadMs = performance.now() - t;
  }
  const model = await voskModel;
  if (!pcm) return { text: '', ms: 0, note: `받음 ${Math.round(loadMs)} ms` };
  const rec = phrases ? new model.KaldiRecognizer(RATE, JSON.stringify(phrases)) : new model.KaldiRecognizer(RATE);
  const t = performance.now();
  const texts: string[] = [];
  let last = t;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const heard = await new Promise<Heard>((done) => {
    // One `result` per endpoint, then one for retrieveFinalResult: no event says which is the last, so wait until it is
    // quiet after a result (and give up after 60 s without one).
    const settle = (ms: number) => {
      clearTimeout(quiet);
      quiet = setTimeout(() => done({ text: texts.join(' ').trim(), ms: last - t, note: loadMs ? `모델 받기 ${Math.round(loadMs)} ms` : undefined }), ms);
    };
    rec.on('result', (m: any) => {
      if (m.result?.text) texts.push(m.result.text);
      last = performance.now();
      settle(500);
    });
    rec.on('error', (m: any) => done({ text: '', ms: performance.now() - t, note: `오류 ${m.error}` }));
    rec.acceptWaveformFloat(pcm.slice(), RATE); // −1…1 as recorded (measured: scaled to the 16-bit range it hears nonsense)
    rec.retrieveFinalResult();
    settle(60000);
  });
  rec.remove();
  return heard;
}
