// PROTOTYPE, not product code, ticket #120. Sanity: the page without ?variant= at a fixed state (작전 준비, fresh load).
// Usage: node sanity.mjs <out.png> [base]   or   node sanity.mjs --diff <a.png> <b.png>  (prints differing pixels)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
if (process.argv[2] === '--diff') {
  const [a, b] = process.argv.slice(3).map((f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`);
  const n = await page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const px = async (src) => { const i = await load(src); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const [p, q] = [await px(a), await px(b)];
    let d = 0;
    for (let k = 0; k < p.length; k += 4) if (p[k] !== q[k] || p[k + 1] !== q[k + 1] || p[k + 2] !== q[k + 2]) d++;
    return { differing: d, total: p.length / 4, sameSize: p.length === q.length };
  }, [a, b]);
  console.log(JSON.stringify(n));
} else {
  await page.goto(`${process.argv[3] ?? 'http://localhost:5190'}/?seed=20261106`);
  await page.getByRole('region', { name: '작전 준비' }).waitFor();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: process.argv[2] });
  writeFileSync(process.argv[2].replace(/\.png$/, '.txt'), await page.evaluate(() => document.body.innerText));
}
await browser.close();
