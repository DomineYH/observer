/* eslint-disable no-restricted-syntax -- PROTOTYPE: plain DOM, no React */
// PROTOTYPE (#177): the owner speaks each 교신 문장 once; every candidate recogniser's text and time go in one table.
// Throwaway. State is in memory; "내려받기" is the only thing that leaves the page.
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { builtIn, builtInReplay, installLocal, RATE, vosk, whisper, type Heard } from './engines';
import { SENTENCES } from './sentences';

type EngineId = 'builtin-cloud' | 'builtin-local' | 'whisper-tiny' | 'whisper-base' | 'whisper-small' | 'vosk' | 'vosk-grammar';
const ENGINES: { id: EngineId; label: string; on: boolean }[] = [
  { id: 'builtin-cloud', label: '내장·클라우드 (실시간, 소리가 Google로 감)', on: true },
  { id: 'builtin-local', label: '내장·기기 안 (녹음을 다시 틀어 줌, Chrome 139+)', on: true },
  { id: 'whisper-tiny', label: 'Whisper tiny (39 MiB)', on: true },
  { id: 'whisper-base', label: 'Whisper base (73 MiB)', on: true },
  { id: 'whisper-small', label: 'Whisper small (238 MiB)', on: false },
  { id: 'vosk', label: 'vosk small-ko (82M)', on: true },
  { id: 'vosk-grammar', label: 'vosk small-ko + 구절 문법', on: true },
];
interface Sample {
  id: string;
  said: string;
  seconds: number;
  pcm: Float32Array;
  heard: Partial<Record<EngineId, Heard>>;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const on = (id: EngineId) => $<HTMLInputElement>(`e-${id}`).checked;
const device = () => $<HTMLSelectElement>('device').value as 'wasm' | 'webgpu';
const status = (text: string) => ($('status').textContent = text);
/** Words only: what a 맞추는 규칙 would at least have to forgive (spaces and punctuation). */
const bare = (s: string) => s.replace(/[\s,.?!]/g, '');
// vosk's grammar is a list of 낱말 it may hear, in any order. The sentences run 숫자 and 음성 문자 together (넷여섯오칠,
// 찰리호텔), which no lexicon has as one word, so such runs are cut into their pieces.
const PIECES = [...RADIO_GRAMMAR.digits.words, '백', '십', '발', ...Object.values(RADIO_GRAMMAR.phonetic.words)].sort((a, z) => z.length - a.length);
const RUN = new RegExp(`^(?:${PIECES.join('|')})+$`);
const PIECE = new RegExp(PIECES.join('|'), 'g');
const PHRASES = [
  ...new Set(
    SENTENCES.flatMap((s) => s.text.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)).flatMap((w) => (RUN.test(w) ? w.match(PIECE)! : [w])),
  ),
];

const samples: Sample[] = [];
let at = 0;
let busy = false;

function drawSentence() {
  const s = SENTENCES[at]!;
  $('where').textContent = `${at + 1} / ${SENTENCES.length} · ${s.id}`;
  $('sentence').textContent = s.text;
}

function drawTable() {
  const shown = ENGINES.filter((e) => samples.some((s) => s.heard[e.id]));
  const cell = (s: Sample, id: EngineId) => {
    const h = s.heard[id];
    if (!h) return '<td></td>';
    const ok = bare(h.text) === bare(s.said);
    return `<td class="${ok ? 'ok' : ''}">${h.text || '<i>(아무것도 못 들음)</i>'}<small>${Math.round(h.ms)} ms${h.note ? ` · ${h.note}` : ''}</small></td>`;
  };
  $('table').innerHTML =
    `<tr><th>말한 것</th>${shown.map((e) => `<th>${e.label}</th>`).join('')}</tr>` +
    samples.map((s) => `<tr><td>${s.said}<small>${s.id} · ${s.seconds.toFixed(1)}초</small></td>${shown.map((e) => cell(s, e.id)).join('')}</tr>`).join('');
}

async function run(id: EngineId, pcm: Float32Array | null): Promise<Heard | null> {
  try {
    if (id === 'builtin-local') return pcm ? await builtInReplay(true, pcm) : null;
    if (id === 'builtin-cloud') return pcm ? await builtInReplay(false, pcm) : null;
    if (id === 'vosk') return await vosk(pcm);
    if (id === 'vosk-grammar') return await vosk(pcm, PHRASES);
    return await whisper(id.slice(8) as 'tiny' | 'base' | 'small', device(), pcm);
  } catch (e) {
    return { text: '', ms: 0, note: `오류 ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Every checked engine on one recording, one after another so the times do not share the CPU. `live`: already heard. */
async function recognise(sample: Sample, live: Partial<Record<EngineId, Heard>> = {}) {
  Object.assign(sample.heard, live);
  for (const e of ENGINES) {
    if (!on(e.id) || live[e.id]) continue;
    status(`${e.label} …`);
    const heard = await run(e.id, sample.pcm);
    if (heard) sample.heard[e.id] = heard;
    drawTable();
  }
  status('끝. 다음 문장으로.');
}

// 눌러서 말하기: the microphone is recorded at 16 kHz while the built-in recogniser (cloud) listens to it live.
let mic: { ctx: AudioContext; chunks: Float32Array[]; recording: boolean } | null = null;
let live: ReturnType<typeof builtIn> | null = null;
async function openMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false } });
  const ctx = new AudioContext({ sampleRate: RATE });
  const node = ctx.createScriptProcessor(4096, 1, 1); // deprecated and enough for a prototype
  const m = { ctx, chunks: [] as Float32Array[], recording: false };
  node.onaudioprocess = (e) => {
    if (m.recording) m.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  ctx.createMediaStreamSource(stream).connect(node);
  node.connect(ctx.destination);
  mic = m;
  status('마이크 켜짐. 단추나 스페이스를 누른 채 말하고, 떼면 인식한다.');
}

async function press() {
  if (busy || mic?.recording) return;
  if (!mic) await openMic();
  mic!.chunks = [];
  mic!.recording = true;
  $('talk').classList.add('down');
  try {
    live = on('builtin-cloud') ? builtIn(false) : null;
  } catch (e) {
    live = null;
    status(String(e));
  }
}

async function release() {
  if (!mic?.recording) return;
  mic.recording = false;
  $('talk').classList.remove('down');
  busy = true;
  const pcm = new Float32Array(mic.chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of mic.chunks) {
    pcm.set(c, o);
    o += c.length;
  }
  const s = SENTENCES[at]!;
  const sample: Sample = { id: s.id, said: s.text, seconds: pcm.length / RATE, pcm, heard: {} };
  samples.push(sample);
  const heardLive = live ? { 'builtin-cloud': await live.stop() } : {};
  live = null;
  drawTable();
  await recognise(sample, heardLive);
  busy = false;
}

const b64 = (pcm: Float32Array) => {
  const bytes = new Uint8Array(Int16Array.from(pcm, (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32768)))).buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Float32Array.from(new Int16Array(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer), (x) => x / 32768);

function download() {
  const audio = $<HTMLInputElement>('with-audio').checked;
  const data = {
    prototype: 'm4-voice-recognition (#177)',
    userAgent: navigator.userAgent,
    device: device(),
    rate: RATE,
    samples: samples.map((s) => ({ id: s.id, said: s.said, seconds: s.seconds, heard: s.heard, ...(audio ? { pcm16: b64(s.pcm) } : {}) })),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `m4-voice-samples${audio ? '-audio' : ''}.json`;
  a.click();
}

/** A downloaded file with audio back in: its recordings go through the checked engines again (no one has to speak twice). */
async function rerun(file: File) {
  const data = JSON.parse(await file.text()) as { samples: { id: string; said: string; seconds: number; pcm16?: string }[] };
  busy = true;
  for (const s of data.samples) {
    if (!s.pcm16) continue;
    const sample: Sample = { id: s.id, said: s.said, seconds: s.seconds, pcm: unb64(s.pcm16), heard: {} };
    samples.push(sample);
    drawTable();
    await recognise(sample);
  }
  busy = false;
}

$('engines').innerHTML = ENGINES.map((e) => `<label><input type="checkbox" id="e-${e.id}" ${e.on ? 'checked' : ''}> ${e.label}</label>`).join('');
$('prev').onclick = () => ((at = (at + SENTENCES.length - 1) % SENTENCES.length), drawSentence());
$('next').onclick = () => ((at = (at + 1) % SENTENCES.length), drawSentence());
$('talk').onpointerdown = () => void press();
$('talk').onpointerup = $('talk').onpointerleave = () => void release();
document.onkeydown = (e) => {
  if (e.code !== 'Space' || e.repeat || e.target instanceof HTMLInputElement) return;
  e.preventDefault();
  void press();
};
document.onkeyup = (e) => {
  if (e.code === 'Space') void release();
  if (e.code === 'ArrowRight' && !busy) $('next').click();
  if (e.code === 'ArrowLeft' && !busy) $('prev').click();
};
$('install').onclick = async () => status(await installLocal().catch((e: unknown) => `기기 안 설치 실패: ${String(e)}`));
$('load').onclick = async () => {
  for (const e of ENGINES) {
    if (!on(e.id) || e.id.startsWith('builtin')) continue;
    status(`${e.label} 받는 중 …`);
    const h = await run(e.id, null);
    status(`${e.label}: ${h?.note ?? ''}`);
  }
  status('모델을 다 받았다.');
};
$('download').onclick = download;
$<HTMLInputElement>('file').onchange = (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void rerun(f);
};
drawSentence();
