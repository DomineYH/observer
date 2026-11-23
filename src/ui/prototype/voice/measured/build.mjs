// usage: node build.mjs <ttsDir> <id prefix letter> <out samples.json>
import { readFileSync, writeFileSync } from 'node:fs';
const [dir, letter, out] = process.argv.slice(2);
const list = JSON.parse(readFileSync(`${dir}/sentences.json`, 'utf8'));
const samples = [];
for (const rate of ['r0', 'r3']) for (const s of list) {
  const b = readFileSync(`${dir}/${rate}-${s.id}.wav`);
  const at = b.indexOf('data') + 8;
  const pcm = b.subarray(at, at + b.readUInt32LE(at - 4));
  samples.push({ id: `${letter}${rate.slice(1)}-${s.id}`, said: s.said ?? s.text, seconds: pcm.length / 2 / 16000, pcm16: pcm.toString('base64') });
}
writeFileSync(out, JSON.stringify({ samples }));
console.log(samples.length, samples[2].id, samples[2].said);
