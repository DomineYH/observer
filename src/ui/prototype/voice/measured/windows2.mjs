// usage (Windows node): node windows2.mjs <dir> <out.json> <tailMs> <samples.json> [more samples.json]
import { chromium } from 'file:///C:/dev/observer-m4-voice/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [dir, out, tail, ...files] = process.argv.slice(2);
const samples = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).samples);
const ctx = await chromium.launchPersistentContext(`${dir}\\profile`, {
  channel: 'chrome', headless: false,
  args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto('http://localhost:5177/prototype-voice.html');
const ua = await page.evaluate(() => navigator.userAgent);
// 기기 안 한국어: try to install for at most 4 minutes.
await page.click('#install');
let local = '';
try {
  await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('기기 안'), null, { timeout: 4 * 60000 });
  local = await page.textContent('#status');
} catch { local = '4분 안에 설치가 끝나지 않음'; }
const state = await page.evaluate(async () => {
  const C = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return C.available ? await C.available({ langs: ['ko-KR'], processLocally: true }) : 'no available()';
});
console.log('local', local, '| available now:', state);
const hear = ([b64, isLocal, tailMs]) => new Promise(async (done) => {
  const pcm = Float32Array.from(new Int16Array(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer), (x) => x / 32768);
  const ac = new AudioContext();
  const buffer = ac.createBuffer(1, pcm.length, 16000);
  buffer.getChannelData(0).set(pcm);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const dest = ac.createMediaStreamDestination();
  source.connect(dest);
  const C = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const r = new C();
  r.lang = 'ko-KR'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
  if (isLocal) r.processLocally = true;
  const finals = [], alts = []; let interim = '', error = '', t = 0;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) { finals.push(e.results[i][0].transcript); for (let k = 1; k < e.results[i].length; k++) alts.push(e.results[i][k].transcript); interim = ''; }
      else interim = e.results[i][0].transcript;
    }
  };
  r.onerror = (e) => (error = e.error);
  let finished = false;
  const finish = (late) => { if (finished) return; finished = true; ac.close(); done({ text: finals.join(' ').trim(), ms: performance.now() - t, note: [error && `오류 ${error}`, late && '10초 안에 끝나지 않음', interim && `중간 결과만: ${interim}`, alts.length && `다른 후보: ${alts.join(' / ')}`].filter(Boolean).join(' · ') || undefined }); };
  r.onend = () => finish(false);
  try { r.start(dest.stream.getAudioTracks()[0]); } catch (e) { error = String(e); t = performance.now(); return finish(false); }
  source.onended = () => setTimeout(() => { t = performance.now(); r.stop(); setTimeout(() => finish(true), 10000); }, tailMs);
  source.start();
});
const result = { prototype: 'm4-voice-recognition (#177) windows2', userAgent: ua, tailMs: Number(tail), local: `${local} | ${state}`, samples: [] };
for (const s of samples) {
  const heard = { 'builtin-cloud': await page.evaluate(hear, [s.pcm16, false, Number(tail)]) };
  await page.waitForTimeout(700);
  if (state === 'available') { heard['builtin-local'] = await page.evaluate(hear, [s.pcm16, true, Number(tail)]); await page.waitForTimeout(700); }
  result.samples.push({ id: s.id, said: s.said, seconds: s.seconds, heard });
  writeFileSync(out, JSON.stringify(result, null, 1));
}
console.log('done', samples.length);
await ctx.close();
