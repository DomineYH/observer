// npm run voice:check — 조각 표 검사 (#178): with the real 음성 모델 in a browser, every 교신 낱말 and every 듣기 자료 word
// must reach the 인식기 as words the model has. Prints what the model lacks, so the two lists in
// src/adapters/vosk/pieces.ts can be mended.
import { createReadStream, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { expect, test } from 'vitest';
import { ACTIVITIES, TARGET_TYPES, UNITS, type Target } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { listenWords, type OpenForm } from '@ui/radio/matching';
import { PIECES, toGrammar, VOCABULARY } from '@adapters/vosk/pieces';

const ROOT = new URL('../..', import.meta.url).pathname;
const MODEL = `${ROOT}public/voice/vosk-model-small-ko-0.22.tar.gz`;

/** Every 표적성질 a form could list: each 활동 × 병종 × 규모, counts 1–19. */
const TARGETS: Target[] = [
  { targetType: 'unknown' },
  ...ACTIVITIES.flatMap((activity) =>
    TARGET_TYPES.filter((t) => t !== 'unknown').flatMap((targetType) =>
      UNITS.flatMap((unit): Target[] =>
        unit === 'men' || unit === 'vehicles' || unit === 'tubes'
          ? Array.from({ length: 19 }, (_, i) => ({ targetType, activity, unit, count: i + 1 }))
          : [{ targetType, activity, unit }],
      ),
    ),
  ),
];
const FORMS: OpenForm[] = [
  { form: 'call' }, { form: 'loc' }, { form: 'fire' }, { form: 'pos' },
  { form: 'readback', asked: 'mto' }, { form: 'readback', asked: 'shot' }, { form: 'readback', asked: 'rounds_complete' },
  { form: 'desc', options: TARGETS }, { form: 'corr', needsDirection: true, after: true }, { form: 'eom' }, { form: 'repeat' }, { form: 'shift', options: TARGETS },
];
/** Every 들을 낱말 of every form, every 방안 문자; no callsign (the player's own word). */
export const allWords = (): string[] => listenWords(FORMS, { callsign: '', gridLetters: Object.keys(RADIO_GRAMMAR.phonetic.words).join('') });

/** The words of `candidates` the model lacks: its worker says so when a recogniser is made with them. */
async function lacking(candidates: readonly string[]): Promise<string[]> {
  // The page, vosk-browser and the model from one origin of our own (the model is too large to hand over a route).
  const server = createServer((req, res) => {
    if (req.url === '/vosk.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(readFileSync(`${ROOT}node_modules/vosk-browser/dist/vosk.js`));
    if (req.url === '/model.tar.gz') return void createReadStream(MODEL).pipe(res.writeHead(200, { 'content-type': 'application/gzip' }));
    res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><script src="/vosk.js"></script>');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'voice-check-')), { headless: true, channel: 'chromium' }); // not incognito: the model is kept in IndexedDB
  try {
    const page = await context.newPage();
    const missing = new Set<string>();
    const note = (m: { text(): string }) => {
      const found = /missing in vocabulary: '?([^'\s]+)'?/.exec(m.text());
      if (found) missing.add(found[1]!);
    };
    page.on('console', note);
    page.on('worker', (w) => w.on('console', note));
    await page.goto(origin);
    const loadMs = await page.evaluate(async (words) => {
      const t = performance.now();
      const vosk = (window as unknown as { Vosk: { createModel(url: string): Promise<{ KaldiRecognizer: new (rate: number, grammar: string) => { remove(): void } }> } }).Vosk;
      const model = await vosk.createModel('/model.tar.gz');
      const ms = performance.now() - t;
      new model.KaldiRecognizer(16000, JSON.stringify(words));
      await new Promise((done) => setTimeout(done, 3000));
      return ms;
    }, [...candidates]);
    console.log(`모델을 올리는 데 ${Math.round(loadMs)} ms`);
    return [...missing];
  } finally {
    await context.close();
    server.close();
  }
}

test('음성 입력: 조각 표 검사 — 모든 교신 낱말이 모델에 있는 낱말이나 조각으로 바뀐다', async () => {
  expect(existsSync(MODEL), 'npm run voice:fetch 를 먼저 돌린다').toBe(true);
  const words = allWords();
  const pieces = Object.values(PIECES).flatMap((p) => p.split(' '));
  const lacks = await lacking([...new Set([...words, ...pieces])]);
  console.log(`낱말 ${words.length}개, 모델에 없는 것 ${lacks.length}개: ${lacks.join(' ')}`);
  // VOICE_DUMP=<file>: the words and what the model lacks, for mending the two lists.
  if (process.env.VOICE_DUMP) writeFileSync(process.env.VOICE_DUMP, JSON.stringify({ words, lacks }));
  // No word is lost on the way to the 인식기, and nothing given to it is a word it lacks.
  const lost: string[] = [];
  const grammar = toGrammar(words, (w) => lost.push(w));
  expect(lost, '조각 표에도 모델 낱말 목록에도 없는 낱말').toEqual([]);
  expect(grammar.filter((w) => lacks.includes(w)), '모델에 없는데 그대로 주는 낱말이나 조각').toEqual([]);
  // The lists hold nothing stale: a word listed as the model's is one, and a word with pieces is one the model lacks.
  expect([...VOCABULARY].filter((w) => lacks.includes(w))).toEqual([]);
  expect(Object.keys(PIECES).filter((w) => !lacks.includes(w) && words.includes(w)), '모델에 있는데 조각으로 주는 낱말').toEqual([]);
});
