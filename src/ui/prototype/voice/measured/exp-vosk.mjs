// Does vosk small-ko hear the 교신 낱말 it lacks when they are given as pieces it has? usage: node exp-vosk.mjs <profile> <samples.json> <out.json>
import { chromium } from '/mnt/c/dev/observer-m4-voice/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [profile, file, out] = process.argv.slice(2);
const samples = JSON.parse(readFileSync(file, 'utf8')).samples;
const SPLITS = {
  효력사: ['효력 사'], 재효력사: ['재 효력 사'], 임무끝: ['임무 끝'], 좌로: ['좌 로', '좌측 으로'], 우로: ['우 로', '우측 으로'], 표적번호: ['표적 번호'],
  사격지휘통보: ['사격지휘 통보', '사격 지휘 통보'], 순발신관: ['순발 신관'], 접근신관: ['접근 신관'], 위험근접: ['위험 근접'], 지명사: ['지명 사'],
  잠깐대기: ['잠깐 대기'], 마감탄: ['마감 탄'], 전이: ['전 이'], 여기는: ['여기 는'], 보병소대: ['보병 소대'], 공격중인: ['공격 중인', '공격 중 인'],
  이동중인: ['이동 중인', '이동 중 인'], 사격중인: ['사격 중인', '사격 중 인'], 동제원: ['동 제원'], '1개': ['한 개', '일 개'], '2대': ['두 대', '이 대'], '3문': ['세 문', '삼 문'],
  떳다: ['떴다'], 하나발: ['하나 발'], 둘발: ['둘 발'], 삼발: ['삼 발'], 넷발: ['넷 발'],
};
const DIGITS = ['공', '하나', '둘', '삼', '넷', '오', '여섯', '칠', '팔', '아홉', '백', '십', '알파', '브라보', '찰리', '호텔'].sort((a, z) => z.length - a.length);
const RUN = new RegExp(`^(?:${DIGITS.join('|')})+$`), PIECE = new RegExp(DIGITS.join('|'), 'g');
const words = [...new Set(samples.flatMap((s) => s.said.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)).flatMap((w) => (RUN.test(w) ? w.match(PIECE) : [w])))];
const ctx = await chromium.launchPersistentContext(profile, { executablePath: '/usr/bin/google-chrome', headless: true });
const page = await ctx.newPage();
const missing = new Set();
const note = (m) => { const x = /missing in vocabulary: '?([^'\s]+)'?/.exec(m.text()); if (x) missing.add(x[1]); };
page.on('console', note);
page.on('worker', (w) => w.on('console', note));
await page.goto('http://localhost:5177/prototype-voice.html');
const run = (b64, phrases) => page.evaluate(async ([b64, phrases]) => {
  const { vosk } = await import('/src/ui/prototype/voice/engines.ts');
  const pcm = Float32Array.from(new Int16Array(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer), (x) => x / 32768);
  return vosk(pcm, phrases);
}, [b64, phrases]);
// 1. which words and which pieces does the model lack?
const candidates = [...new Set([...words, ...Object.values(SPLITS).flat().flatMap((s) => s.split(' '))])];
await run(samples[10].pcm16, candidates);
await page.waitForTimeout(1500);
const lacks = [...missing];
// 2. the grammar: a word the model has stays; one it lacks becomes its first split whose pieces it all has.
const unsplit = [];
const grammar = [...new Set(words.flatMap((w) => {
  if (!lacks.includes(w)) return [w];
  const split = (SPLITS[w] ?? []).find((s) => s.split(' ').every((p) => !lacks.includes(p)));
  if (!split) { unsplit.push(w); return []; }
  return split.split(' ');
}))];
console.log('모델에 없는 낱말·조각:', lacks.join(' '));
console.log('조각으로도 안 되는 낱말:', unsplit.join(' ') || '(없음)');
console.log('문법:', grammar.join(' '));
const result = { prototype: 'm4-voice-recognition (#177) vosk pieces', userAgent: await page.evaluate(() => navigator.userAgent), lacks, unsplit, grammar, samples: [] };
for (const s of samples) {
  result.samples.push({ id: s.id, said: s.said, seconds: s.seconds, heard: { 'vosk-pieces': await run(s.pcm16, grammar) } });
  writeFileSync(out, JSON.stringify(result, null, 1));
}
console.log('done');
await ctx.close();
