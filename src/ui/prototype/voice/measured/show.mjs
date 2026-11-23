import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const bare = (s) => s.replace(/[\s,.?!]/g, '');
const engines = [...new Set(d.samples.flatMap((s) => Object.keys(s.heard)))];
console.log(d.userAgent);
for (const e of engines) {
  const hs = d.samples.map((s) => s.heard[e]).filter(Boolean);
  const exact = d.samples.filter((s) => s.heard[e] && bare(s.heard[e].text) === bare(s.said)).length;
  const ms = hs.map((h) => h.ms).sort((a, b) => a - b);
  const empty = hs.filter((h) => !h.text).length;
  console.log(`${e}: n=${hs.length} exact=${exact} empty=${empty} ms median=${Math.round(ms[ms.length >> 1])} max=${Math.round(ms.at(-1))}`);
}
if (process.argv[3]) for (const s of d.samples) {
  if (!s.id.startsWith(process.argv[3])) continue;
  console.log(`\n[${s.id}] ${s.seconds.toFixed(1)}s  ${s.said}`);
  for (const e of engines) if (s.heard[e]) console.log(`  ${e.padEnd(13)} ${Math.round(s.heard[e].ms)}ms  ${s.heard[e].text}${s.heard[e].note ? '  («' + s.heard[e].note + '»)' : ''}`);
}
