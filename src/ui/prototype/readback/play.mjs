// PROTOTYPE, not product code, ticket #120. Plays one mission (사격 요청 → 수정 → 효력사) per variant by script on the dev
// server, reads back every message (the first 사격지휘통보 once wrong on purpose), takes the screenshots and prints the
// taps per read-back. Usage: node src/ui/prototype/readback/play.mjs <outDir> [base=http://localhost:5190]
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? '.';
const BASE = process.argv[3] ?? 'http://localhost:5190';
const DIG = ['공', '하나', '둘', '삼', '넷', '오', '여섯', '칠', '팔', '아홉'];
const FUZE = { quick: '순발신관', vt: '접근신관' };
const KIND = { mto: '사격지휘통보', shot: '하나발 떳다', rounds_complete: '마감탄 떳다' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const items = (page) => page.evaluate(() => window.__readback?.() ?? []);

async function until(fn, ms = 120_000, step = 150) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout');
    await sleep(step);
  }
}

async function speedTo(page, n) {
  const b = page.getByRole('button', { name: /^배속 ×/ });
  for (let i = 0; i < 4 && (await b.getAttribute('aria-label')) !== `배속 ×${n}`; i++) await b.click();
}

/** Reads back `it`; `wrong` gives one wrong 발수 first (shots taken around it when `shot` is set). */
async function answer(page, variant, it, { wrong = false, shot } = {}) {
  const box = page.getByRole('region', { name: '복창', includeHidden: true });
  const s = it.slots;
  const send = () => box.getByRole('button', { name: '복창 송신' }).click();
  if (shot) await page.screenshot({ path: `${OUT}/${shot}-ask.png` });
  const tries = wrong ? [true, false] : [false];
  for (const bad of tries) {
    const r = s && bad ? (s.rounds > 1 ? s.rounds - 1 : s.rounds + 1) : s?.rounds;
    if (variant === 'A') {
      const full = bad || !wrong; // the first pass fills every slot; after a wrong one only the 발수 is fixed
      if (full) await box.getByRole('combobox', { name: '복창 교신 종류' }).selectOption(it.kind);
      if (it.kind === 'mto') {
        if (full) {
          await box.getByRole('combobox', { name: '복창 신관' }).selectOption(s.fuze);
          if (s.control === 'amc') await box.getByRole('combobox', { name: '복창 지명사' }).selectOption('amc');
          const d = String(s.targetNumber).padStart(4, '0');
          for (let i = 0; i < 4; i++) await box.getByRole('combobox', { name: `복창 표적번호 ${i + 1}째` }).selectOption(d[i]);
        }
        await box.getByRole('combobox', { name: '복창 발수' }).selectOption(String(r));
      }
      await send();
    } else if (variant === 'B') {
      if (it.kind === 'mto') {
        if (bad || !wrong) {
          await box.getByRole('group', { name: '복창 신관' }).getByRole('button', { name: FUZE[s.fuze] }).click();
          if (s.control === 'amc') await box.getByRole('checkbox').check();
          await box.getByRole('textbox', { name: '복창 표적번호' }).fill(String(s.targetNumber).padStart(4, '0'));
        }
        await box.getByRole('textbox', { name: '복창 발수' }).fill(String(r));
      }
      await send();
    } else {
      await box.getByRole('button', { name: /^복창 \(/ }).click();
      const cands = box.getByRole('group', { name: '복창 후보' }).getByRole('button');
      const texts = await cands.allTextContents();
      const right = (t) =>
        it.kind === 'mto' ? t.includes(FUZE[s.fuze]) && t.includes(`${DIG[s.rounds]}발`) && t.includes([...String(s.targetNumber).padStart(4, '0')].map((c) => DIG[c]).join('')) : t.startsWith(KIND[it.kind]);
      const i = texts.findIndex((t) => (bad ? !right(t) : right(t)));
      if (shot && !bad) await page.screenshot({ path: `${OUT}/${shot}-candidates.png` });
      await cands.nth(i).click();
    }
    if (bad && shot) {
      await sleep(300);
      await page.screenshot({ path: `${OUT}/${shot}-wrong.png` });
      await logShot(page, `${OUT}/${shot}-wrong-log.png`);
    }
  }
}

async function mission(browser, { variant, show, mobile, tag, briefShot }) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1000, height: 700 } });
  await page.goto(`${BASE}/?seed=20261106&variant=${variant}&show=${show}`);
  await page.getByRole('banner').waitFor();
  const tabBtn = (name) => page.getByRole('group', { name: '아래 탭' }).getByRole('button', { name, exact: true });
  if (mobile) await tabBtn('지도').click();
  const map = page.getByRole('img', { name: '지도' });
  const mb = await map.boundingBox();
  await map.click({ position: { x: mb.width / 2, y: mb.height * 0.75 } });
  if (mobile) await tabBtn('입력').click();
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await speedTo(page, 8);
  const log = page.getByRole('region', { name: '무전 기록', includeHidden: true });
  const composer = page.getByRole('region', { name: '입력기' });
  const sendBtn = composer.getByRole('button', { name: '송신' });
  if (mobile) await page.getByRole('button', { name: /^복창 상태/ }).click(); // fold the debug strip: the layout as a player sees it
  await until(async () => (await log.textContent()).includes('감명 양호'));
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click();
  await composer.getByRole('combobox', { name: '경고명령' }).waitFor();
  await sendBtn.click();
  await until(async () => (await log.textContent()).includes('좌표 송신바람'));
  await composer.getByRole('textbox', { name: '동', exact: true }).fill('4720');
  await composer.getByRole('textbox', { name: '북', exact: true }).fill('3150');
  await sendBtn.click();
  await composer.getByRole('combobox', { name: '표적성질' }).waitFor();
  await sendBtn.click();
  // Slow down so the asked moment is a person's moment (×1), and answer every message as it comes.
  const done = new Set();
  let corrected = false;
  let layout = null;
  await until(
    async () => {
      const list = await items(page);
      const it = list.find((i) => !i.done && !done.has(i.id));
      if (it) {
        done.add(it.id);
        const first = it.id === 1;
        if (first) {
          await speedTo(page, 1);
          if (briefShot) {
            await sleep(4600); // BRIEF_MS + a margin
            await page.screenshot({ path: `${OUT}/${briefShot}.png` });
            await logShot(page, `${OUT}/${briefShot}-log.png`);
          }
          if (mobile) layout = await measure(page);
        }
        await answer(page, variant, it, { wrong: first, shot: first ? tag : undefined });
        if (first) await speedTo(page, 8);
        return false;
      }
      const dir = composer.getByRole('textbox', { name: '방향' });
      if (!corrected && (await dir.isVisible())) {
        corrected = true;
        await dir.fill('1600');
        await composer.getByRole('combobox', { name: '좌우', exact: true }).selectOption('right');
        await composer.getByRole('textbox', { name: '좌우 거리' }).fill('50');
        await composer.getByRole('combobox', { name: '사거리', exact: true }).selectOption('add');
        await composer.getByRole('textbox', { name: '사거리 거리' }).fill('100');
        await composer.getByRole('combobox', { name: '다음' }).selectOption('ffe');
        await sendBtn.click();
        return false;
      }
      return corrected && list.length && list.every((i) => i.done) && (await composer.textContent()).includes('효과를 관측하십시오');
    },
    360_000,
    100,
  );
  if (tag && !mobile) await page.screenshot({ path: `${OUT}/${tag}-end.png` });
  const out = await items(page);
  await page.close();
  return { variant, show, mobile, items: out, layout };
}

/** The last lines of the 무전 기록 (desktop: the log runs below the fold). */
async function logShot(page, path) {
  const log = page.getByRole('region', { name: '무전 기록' });
  if (!(await log.isVisible())) return;
  const lis = log.locator('li');
  const n = await lis.count();
  await lis.nth(n - 1).scrollIntoViewIfNeeded();
  const first = await lis.nth(Math.max(0, n - 6)).boundingBox();
  const last = await lis.nth(n - 1).boundingBox();
  await page.screenshot({ path, clip: { x: first.x, y: first.y, width: first.width, height: last.y + last.height - first.y } });
  await page.evaluate(() => scrollTo(0, 0));
}

/** Where the read-back box sits on the portrait screen at the asked moment. */
const measure = (page) =>
  page.evaluate(() => {
    const r = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) };
    };
    const panel = document.querySelector('[data-panel="input"]');
    return {
      viewport: innerHeight,
      view: r('.view'),
      tabs: r('.lower-tabs'),
      readback: r('[data-prototype="readback"]'),
      inputPanel: panel && { ...r('[data-panel="input"]'), scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight },
    };
  });

const browser = await chromium.launch();
const runs = [];
const only = process.env.ONLY?.split(',');
for (const variant of ['A', 'B', 'C']) {
  if (only && !only.includes(variant)) continue;
  for (const mobile of [false, true]) {
    if (process.env.MOBILE === '0' && mobile) continue;
    const tag = `${variant}-${mobile ? 'mobile' : 'desktop'}`;
    const show = variant === 'B' && !mobile ? 'brief' : 'text';
    runs.push(await mission(browser, { variant, show, mobile, tag, briefShot: show === 'brief' ? 'B-desktop-brief-gone' : undefined }));
    console.error('done', tag);
  }
}
await browser.close();
console.log(JSON.stringify(runs, null, 1));
