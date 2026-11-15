// PROTOTYPE, not product code, ticket #130. Sanity: main vs this branch without ?variant= (dev server on 5191), and a pixel diff.
// Usage: node sanity.mjs <prefix>  (writes <prefix>-practice.png, <prefix>-daily.png)   or   node sanity.mjs --diff <a.png> <b.png>
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
if (process.argv[2] === '--diff') {
  const [x, y] = process.argv.slice(3).map((f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`);
  console.log(JSON.stringify(await p.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const px = async (s) => { const i = await load(s); const c = new OffscreenCanvas(i.width, i.height); const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const [P, Q] = [await px(a), await px(b)]; let d = 0;
    for (let k = 0; k < P.length; k += 4) if (P[k] !== Q[k] || P[k+1] !== Q[k+1] || P[k+2] !== Q[k+2]) d++;
    return { differing: d, total: P.length / 4, sameSize: P.length === Q.length };
  }, [x, y])));
} else {
  for (const [q, n] of [['?seed=20261106', 'practice'], ['', 'daily']]) {
    await p.goto('http://localhost:5191/' + q);
    await p.getByRole('region', { name: '작전 준비' }).waitFor();
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${process.argv[2]}-${n}.png` });
  }
}
await b.close();
