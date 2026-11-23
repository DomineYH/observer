// usage: node measure.mjs <profile> <ttsDir> <out.json> <engine ids to check, comma separated>
import { chromium } from '/mnt/c/dev/observer-m4-voice/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [profile, dir, out, engines] = process.argv.slice(2);
const wanted = engines.split(',');
const list = JSON.parse(readFileSync(`${dir}/sentences.json`, 'utf8'));
const samples = [];
for (const rate of ['r0', 'r3']) for (const s of list) {
  const b = readFileSync(`${dir}/${rate}-${s.id}.wav`);
  const at = b.indexOf('data') + 8;
  const pcm = b.subarray(at, at + b.readUInt32LE(at - 4));
  samples.push({ id: `${rate}-${s.id}`, said: s.text, seconds: pcm.length / 2 / 16000, pcm16: pcm.toString('base64') });
}
writeFileSync(`${dir}/samples.json`, JSON.stringify({ samples }));
const ctx = await chromium.launchPersistentContext(profile, { executablePath: '/usr/bin/google-chrome', headless: true, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5177/prototype-voice.html');
for (const id of ['builtin-cloud', 'builtin-local', 'whisper-tiny', 'whisper-base', 'whisper-small', 'vosk', 'vosk-grammar'])
  await page.setChecked(`#e-${id}`, wanted.includes(id));
await page.setChecked('#with-audio', false);
await page.setInputFiles('#file', `${dir}/samples.json`);
const t = Date.now();
await page.waitForFunction((n) => document.querySelectorAll('#table tr').length === n + 1 && document.getElementById('status').textContent.startsWith('끝'), samples.length, { timeout: 90 * 60000, polling: 2000 });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
await dl.saveAs(out);
console.log('done', samples.length, 'samples in', Math.round((Date.now() - t) / 1000), 's');
await ctx.close();
