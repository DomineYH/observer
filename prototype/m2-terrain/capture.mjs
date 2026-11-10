// PROTOTYPE (#58): screenshots and fps for the mock and the three 진안 variants. Throwaway.
// Usage: node capture.mjs <app url> <data url> <out dir> [chrome|headless] [run ids, e.g. v1c,v2c]
//   app url  e.g. http://localhost:5182 (vite preview of this branch)   data url  e.g. http://localhost:4180 (serve.mjs)
//   chrome   launch real Chrome (channel 'chrome', headed); otherwise headless Chromium from @playwright/test.
// Runs with either playwright-core (a Windows temp folder) or @playwright/test (this repo).
/* global process, console, window, performance, requestAnimationFrame */
const { chromium } = await import('playwright-core').catch(() => import('@playwright/test'));
const [app, data, out, how, only] = process.argv.slice(2);
const real = how === 'chrome';
const POSTS = { P1: [4750, 1900], P2: [7350, 2100], P3: [9750, 300] }; // see README: forest-free 550 m, forest-free, forested SE summit
const RUNS = [
  { id: 'mock', terrain: null, posts: { P0: [5120, 1800] } }, // the planned post
  { id: 'v1', terrain: 'jinan-v1.bin', posts: POSTS },
  { id: 'v2', terrain: 'jinan-v2.bin', posts: POSTS },
  { id: 'v3', terrain: 'jinan-v3.bin', posts: POSTS },
  // what-if: a 60 m clearing cut at P4 on the southern ridge (build.mjs)
  ...['v1', 'v2', 'v3'].map((v) => ({ id: `${v}c`, terrain: `jinan-${v}-clear.bin`, posts: { P4: [4450, 1950] } })),
];

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

const table = [];
for (const r of RUNS.filter((r) => !only || only.split(',').includes(r.id))) {
  const q = `?seed=1&fps=1${r.terrain ? `&terrain=${data}/${r.terrain}` : ''}`;
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
    await button('관측소로').click();
    await wait(300);
    await shot(map, `${r.id}-${pid}-map-x3`);
    await page.getByRole('checkbox').uncheck();
    await button('전체 지도').click();
    await view.scrollIntoViewIfNeeded();
    await wait(1000);
    await shot(view, `${r.id}-${pid}-eye`);
    const timed = ['P0', 'P1', 'P4'].includes(pid);
    const eye = timed ? await fps() : null;
    await button('쌍안경').click();
    await wait(1000);
    await shot(view, `${r.id}-${pid}-bino`);
    const bino = timed ? await fps() : null;
    await button('쌍안경').click();
    await wait(500);
    if (eye !== null) table.push({ run: r.id, post: pid, eye, bino });
  }
}
console.log(JSON.stringify({ browser: real ? 'chrome (headed)' : 'chromium (headless)', version: browser.version(), fps: table }, null, 1));
await browser.close();
