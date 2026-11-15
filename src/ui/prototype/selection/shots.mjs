// PROTOTYPE, not product code, ticket #130. Screenshots of every variant × state × size, and the narrow-screen
// measurements (scroll px inside the 입력 tab to 작전 개시 · 실전 · the scenario choice). The pink bar is hidden in the
// shots (its text goes to <name>.txt). Usage: node src/ui/prototype/selection/shots.mjs <outDir> [base] [tag] [list]
//   list: all (default) | real (the 문경 set: n=2, daily/practice) | measure (numbers only)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] ?? '.';
const BASE = process.argv[3] ?? 'http://localhost:5191';
const TAG = process.argv[4] ?? 'mock';
const LIST = process.argv[5] ?? 'all';
const SIZES = { desktop: { width: 1000, height: 700 }, narrow: { width: 390, height: 844 } };
const STATES = ['daily', 'practice', 'combat', 'locked', 'lockedc'];
const HIDE = '[data-prototype=switcher]{display:none!important}';

async function open(browser, size, query) {
  const page = await browser.newPage({ viewport: SIZES[size] });
  await page.goto(`${BASE}/${query}`);
  await page.getByRole('region', { name: '작전 준비' }).waitFor();
  if (/state=locked/.test(query)) await page.getByText(/작전 개시 — .* 점령/).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  return page;
}

/** Scroll needed inside the narrow 입력 panel to bring each target's bottom into view (0 = visible at load). */
const measure = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector('[data-panel=input]');
    const pr = panel.getBoundingClientRect();
    const need = (el) => (el ? Math.max(0, Math.round(el.getBoundingClientRect().bottom - pr.bottom + panel.scrollTop)) : null);
    const btns = [...panel.querySelectorAll('button')];
    const start = btns.find((b) => b.textContent.includes('작전 개시'));
    const combat = btns.find((b) => b.textContent === '실전');
    const scn = panel.querySelector('[aria-label="시나리오 고르기"], select, [aria-label="판 정보"] button');
    const bar = panel.querySelector('.p130-bar');
    return { start: need(start), combat: need(combat), scenario: need(scn), panelH: Math.round(pr.height), contentH: panel.scrollHeight, barH: bar ? Math.round(bar.getBoundingClientRect().height) : 0 };
  });

async function shot(page, name, { full = false } = {}) {
  writeFileSync(`${OUT}/${name}.txt`, (await page.locator('[data-prototype=debug]').textContent().catch(() => '')) ?? '');
  await page.addStyleTag({ content: HIDE });
  if (full) await page.addStyleTag({ content: '.app{height:auto!important}[data-panel]{overflow:visible!important}' });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
}

const browser = await chromium.launch();
const rows = [];
const variants = LIST === 'real' ? ['A', 'B', 'C'] : [null, 'A', 'B', 'C'];
for (const v of variants) {
  for (const st of LIST === 'all' && v ? STATES : ['daily', 'practice']) {
    const query = v ? `?variant=${v}&state=${st}${LIST === 'real' ? '&n=2' : ''}` : st === 'practice' ? '?seed=20261115' : '';
    for (const size of LIST === 'measure' ? ['narrow'] : ['desktop', 'narrow']) {
      const page = await open(browser, size, query);
      const name = `${TAG}-${v ?? 'main'}-${st}-${size}`;
      if (size === 'narrow' && (st === 'daily' || st === 'practice')) rows.push({ name, ...(await measure(page)) });
      if (LIST !== 'measure') {
        await shot(page, name);
        if (size === 'narrow' && (st === 'daily' || st === 'practice')) await shot(page, `${name}-full`, { full: true });
      }
      await page.close();
    }
  }
  if (LIST === 'all' && v) {
    // four scenarios, practice, desktop; B with its scenario chooser open
    const page = await open(browser, 'desktop', `?variant=${v}&state=practice&n=4`);
    if (v === 'B') await page.getByRole('button', { name: /^바꾸기/ }).first().click();
    await shot(page, `${TAG}-${v}-n4-desktop`, { full: true });
    await page.close();
    const daily = await open(browser, 'narrow', `?variant=${v}&state=daily&n=4`);
    if (v === 'B') await daily.getByRole('button', { name: /다른 시나리오/ }).click();
    await shot(daily, `${TAG}-${v}-n4-daily-narrow-full`, { full: true });
    await daily.close();
  }
}
if (LIST === 'all') {
  // one shot with the switcher and the debug strip, after a click
  const page = await open(browser, 'desktop', '?variant=B&state=practice&n=4');
  await page.getByRole('button', { name: '실전' }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${TAG}-B-switcher-desktop.png` });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(rows, null, 1));
writeFileSync(`${OUT}/${TAG}-measure.json`, JSON.stringify(rows, null, 1));
