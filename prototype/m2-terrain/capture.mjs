// PROTOTYPE (#58, #72): screenshots and fps for the mock and the candidate squares. Throwaway.
// Usage: node capture.mjs <app url> <data url> <out dir> <chrome|headless> <runs.json>
//   runs.json  [{ id, terrain: '<file>.bin' | null (mock), scenario: '<file>.json' (optional), posts: { name: [x, y] },
//               fps: repeats, fpsPosts: [names] (default all), qualities: ['높음', '보통'] (default 높음), edge: true,
//               recon: { el: { A: el, B: el } } (start at the first post at ×8, wait for the 정찰조 to stop, aim at it) }]
//              fps: measure naked eye and binoculars this many times at each post; edge: also a naked-eye view south.
//   app url  e.g. http://localhost:5182 (vite preview of this branch)   data url  e.g. http://localhost:4180 (serve.mjs)
//   chrome   launch real Chrome (channel 'chrome', headed); otherwise headless Chromium from @playwright/test.
// Runs with either playwright-core (a Windows temp folder) or @playwright/test (this repo).
/* global process, console, window, document, performance, requestAnimationFrame */
import { readFileSync } from 'node:fs';
const { chromium } = await import('playwright-core').catch(() => import('@playwright/test'));
const [app, data, out, how, runs] = process.argv.slice(2);
const real = how === 'chrome';
const RUNS = JSON.parse(readFileSync(runs, 'utf8'));

const browser = await chromium.launch(real ? { channel: 'chrome', headless: false } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
const wait = (ms) => page.waitForTimeout(ms);
// frames per second of the page's own animation loop, which draws the view every frame
const fps = () => page.evaluate(() => new Promise((done) => {
  let n = 0;
  const t0 = performance.now();
  const tick = () => (performance.now() - t0 < 5000 ? (n++, requestAnimationFrame(tick)) : done(Math.round((n * 1000) / (performance.now() - t0))));
  requestAnimationFrame(tick);
}));
const canvases = async () => {
  const boxes = await page.locator('canvas').evaluateAll((cs) => cs.map((c, i) => ({ i, w: c.getBoundingClientRect().width })));
  boxes.sort((a, b) => b.w - a.w);
  return { view: page.locator('canvas').nth(boxes[0].i), map: page.locator('canvas').nth(boxes[1].i) };
};
const shot = (loc, name) => loc.screenshot({ path: `${out}/${name}.png` });
const button = (name) => page.getByRole('button', { name, exact: true });

// Turns the view with the arrow keys (the view follows the ui's aim, not an injected 조준 입력): coarse by eye
// (Shift: 200 / 25 mil, plain: 20 / 5 mil), then fine through the binoculars (2 / 1 mil). Ends with the binoculars on.
const aimNow = () => page.evaluate(() => window.__state().aim);
const wrap = (d) => ((d + 9600) % 6400) - 3200;
async function press(key, n) { for (let k = 0; k < n; k++) await page.keyboard.press(key); }
async function aimTo(az, el) {
  await page.evaluate(() => document.activeElement?.blur());
  let a = await aimNow(), dAz = wrap(az - a.az / 10), dEl = el - a.el / 10;
  await press(`Shift+${dAz > 0 ? 'ArrowRight' : 'ArrowLeft'}`, Math.floor(Math.abs(dAz) / 200));
  await press(dAz > 0 ? 'ArrowRight' : 'ArrowLeft', Math.round((Math.abs(dAz) % 200) / 20));
  await press(`Shift+${dEl > 0 ? 'ArrowUp' : 'ArrowDown'}`, Math.floor(Math.abs(dEl) / 25));
  await press(dEl > 0 ? 'ArrowUp' : 'ArrowDown', Math.round((Math.abs(dEl) % 25) / 5));
  await button('쌍안경').click();
  await wait(500);
  await page.evaluate(() => document.activeElement?.blur());
  a = await aimNow();
  dAz = wrap(az - a.az / 10);
  dEl = el - a.el / 10;
  await press(dAz > 0 ? 'ArrowRight' : 'ArrowLeft', Math.round(Math.abs(dAz) / 2));
  await press(dEl > 0 ? 'ArrowUp' : 'ArrowDown', Math.round(Math.abs(dEl)));
}

const table = [], reconOut = [];
for (const r of RUNS) {
  const q = `?seed=1&fps=1${r.terrain ? `&terrain=${data}/${r.terrain}` : ''}${r.scenario ? `&scenario=${data}/${r.scenario}` : ''}`;
  await page.goto(`${app}/${q}`);
  await page.waitForSelector('canvas');
  await wait(2500);
  await button('높음').click();
  await page.getByRole('button', { name: '지도' }).click().catch(() => {}); // narrow layouts only
  const { view, map } = await canvases();
  await map.scrollIntoViewIfNeeded();
  await shot(map, `${r.id}-map-x1`);
  for (const [pid, [x, y]] of Object.entries(r.posts)) {
    await page.evaluate(([x, y]) => window.__send({ a: 'pick', v: [x, y] }), [x, y]);
    await wait(800);
    await page.getByRole('checkbox').check(); // 가시권 표시 (training)
    await wait(1500);
    await button('전체 지도').click();
    await wait(300);
    await shot(map, `${r.id}-${pid}-map-x1-viewshed`);
    await page.getByRole('checkbox').uncheck();
    await button('관측소로').click();
    await wait(300);
    await shot(map, `${r.id}-${pid}-map-x3`);
    await button('전체 지도').click();
    await view.scrollIntoViewIfNeeded();
    await wait(1000);
    await shot(view, `${r.id}-${pid}-eye`);
    if (r.fps && (!r.fpsPosts || r.fpsPosts.includes(pid)))
      for (const ql of r.qualities ?? ['높음']) {
        await button(ql).click();
        await wait(1000);
        const eye = [], bino = [];
        for (let k = 0; k < r.fps; k++) eye.push(await fps());
        await button('쌍안경').click();
        await wait(1000);
        for (let k = 0; k < r.fps; k++) bino.push(await fps());
        await button('쌍안경').click();
        await wait(500);
        table.push({ run: r.id, post: pid, quality: ql, eye, bino });
      }
    await button('높음').click();
    await button('쌍안경').click();
    await wait(1000);
    await shot(view, `${r.id}-${pid}-bino`);
    await button('쌍안경').click();
    await wait(500);
    if (r.edge) {
      // turn to the south (16 × 200 mil) to look across the near map edge; the 조준 keys listen on the document
      await page.evaluate(() => document.activeElement?.blur());
      for (let k = 0; k < 16; k++) await page.keyboard.press('Shift+ArrowRight');
      await wait(1000);
      await shot(view, `${r.id}-${pid}-edge-south`);
      for (let k = 0; k < 16; k++) await page.keyboard.press('Shift+ArrowLeft');
    }
  }
  if (r.recon) {
    // 작전 개시 at the first post, ×8, until the 정찰조 holds at its stop (its route's 2nd point); then look at it
    const [ox, oy] = Object.values(r.posts)[0];
    await page.evaluate(([x, y]) => { window.__send({ a: 'pick', v: [x, y] }); window.__send({ a: 'start', v: [x, y] }); }, [ox, oy]);
    await wait(1000);
    for (let k = 0; k < 2; k++) await page.getByRole('button', { name: /^배속/ }).click();
    const t0 = Date.now();
    let rc;
    do {
      await wait(2000);
      rc = await page.evaluate(() => { const s = window.__state(), p = s.platoons.find((q) => q.type === 'recon'); return { state: p.state, route: p.route, x: p.x, y: p.y, tick: s.tick, op: s.op }; });
    } while (rc.state !== 'hold' && Date.now() - t0 < 300000);
    await wait(4000); // the men go prone
    const az = Math.round(((Math.atan2(rc.x - rc.op.x, rc.y - rc.op.y) * 32000) / Math.PI + 64000) % 64000);
    await aimTo(az / 10, r.recon.el[rc.route] / 10);
    await wait(1500);
    const vis = await page.evaluate(() => window.__state().platoons.find((q) => q.type === 'recon').members.map((m) => m.vis));
    await shot(view, `${r.id}-recon-bino`);
    reconOut.push({ run: r.id, ...rc, az, aim: await aimNow(), vis });
    await button('쌍안경').click();
    await wait(800);
    await shot(view, `${r.id}-recon-eye`);
  }
}
console.log(JSON.stringify({ recon: reconOut }));
console.log(JSON.stringify({ browser: real ? 'chrome (headed)' : 'chromium (headless)', version: browser.version(), fps: table }, null, 1));
await browser.close();
