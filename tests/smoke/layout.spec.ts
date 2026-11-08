import { expect, test, type Locator, type Page } from '@playwright/test';
import { mapPixels, settledMap } from './helpers';

// A phone held upright. Touches go through Chromium's own touch input (CDP): Playwright alone can only tap.
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

type Pt = { x: number; y: number };
/** One touch gesture: `frames[0]` goes down, each later frame moves, then every finger lifts. `holdMs` waits before the lift. */
async function gesture(page: Page, frames: Pt[][], holdMs = 0) {
  const cdp = await page.context().newCDPSession(page);
  const points = (f: Pt[]) => f.map((p, id) => ({ x: p.x, y: p.y, id }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(frames[0]!) });
  for (const f of frames.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(f) });
  if (holdMs) await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

const centre = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const tab = (page: Page, name: string) => page.getByRole('group', { name: '아래 탭' }).getByRole('button', { name, exact: true });
/** A panel by role and name, found also while its tab is not chosen. */
const region = (page: Page, name: string) => page.getByRole('region', { name, includeHidden: true });
/** Whether the browser renders it at all (an empty panel has no height, so Playwright's "visible" would say no). */
const rendered = (l: Locator) => l.evaluate((e) => e.checkVisibility());
const tick = (page: Page) => page.getByRole('status', { name: '틱' });
const ticks = async (page: Page) => Number(await tick(page).textContent());

/** On the narrow page: pick the open field north of 1번 고지 on the 지도 tab, start on the 입력 tab, wait for the clock. */
async function narrowStart(page: Page) {
  await page.goto('/?seed=20261106');
  await tab(page, '지도').click();
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(region(page, '작전 준비')).toContainText('관측소 후보: 찰리호텔 4512 3256'); // on the 입력 tab, hidden now
  await tab(page, '입력').click();
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(() => ticks(page)).toBeGreaterThan(0);
}

test.describe('좁은 화면', () => {
  test.use(PHONE);

  test('F-03: 1밀 터치 단추', async ({ page }) => {
    await narrowStart(page);
    const view = page.getByRole('region', { name: '관측' });
    const pad = view.getByRole('group', { name: '1밀 조준' });
    const readout = view.getByLabel('레이저 측정').locator('p');
    // The view keeps the last 5 lases, newest first: this test lases 5 times, so the n-th lase is the n-th line.
    let lases = 0;
    const lase = async () => {
      await view.getByRole('button', { name: '레이저' }).tap();
      await expect(view.getByLabel('레이저 측정').locator('li')).toHaveCount(++lases);
      return Number(/방위각 (\d{4}) 밀/.exec((await readout.textContent())!)![1]);
    };
    // The opening aim is 20.4 mils: one tap right is 1 mil, one tap left comes back.
    expect(await lase()).toBe(20);
    await pad.getByRole('button', { name: '오른쪽 1밀' }).tap();
    expect(await lase()).toBe(21);
    await pad.getByRole('button', { name: '왼쪽 1밀' }).tap();
    expect(await lase()).toBe(20);
    // Held for a second: one step at once, then more every 90 ms after 350 ms.
    await gesture(page, [[await centre(pad.getByRole('button', { name: '오른쪽 1밀' }))]], 1000);
    const held = await lase();
    expect(held).toBeGreaterThanOrEqual(23);
    // Lifting the finger stops it.
    await page.waitForTimeout(400);
    expect(await lase()).toBe(held);
  });
});

test('레이아웃: 좁은 화면 경계', async ({ page }) => {
  const tabs = page.getByRole('group', { name: '아래 탭' });
  const menuButton = page.getByRole('button', { name: '메뉴', exact: true });
  const menu = page.getByRole('region', { name: '머리띠 메뉴' });
  const subtitle = page.getByRole('banner').locator('small');
  const view = page.getByRole('img', { name: '관측 화면' });

  // 767 px: the upright layout. The view on top at full width, 16:9, above the tabs; the 머리띠 folded.
  await page.setViewportSize({ width: 767, height: 900 });
  await page.goto('/?seed=20261106');
  await expect(tabs).toBeVisible();
  await expect(menuButton).toBeVisible();
  await expect(menu).toBeHidden();
  await expect(subtitle).toBeHidden();
  const v = (await view.boundingBox())!;
  expect(v.x).toBeCloseTo(0, 0);
  expect(Math.abs(v.width - 767)).toBeLessThanOrEqual(1);
  expect(Math.abs(v.height - (v.width * 9) / 16)).toBeLessThanOrEqual(1);
  expect(v.y + v.height).toBeLessThanOrEqual((await tabs.boundingBox())!.y);
  // Only one lower panel at a time.
  await expect(page.getByRole('region', { name: '작전 준비' })).toBeVisible();
  for (const name of ['지도 패널', '표적 목록', '무전 기록']) expect(await rendered(region(page, name))).toBe(false);

  // 768 px, the same page: the wide layout and the 머리띠 spread out, every panel at once.
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(tabs).toBeHidden();
  await expect(menuButton).toBeHidden();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('group', { name: '화질' })).toBeVisible();
  await expect(subtitle).toBeVisible();
  for (const name of ['지도 패널', '작전 준비', '입력기', '표적 목록', '무전 기록']) await expect.poll(() => rendered(region(page, name))).toBe(true);
  // and back.
  await page.setViewportSize({ width: 767, height: 900 });
  await expect(tabs).toBeVisible();
  await expect(menu).toBeHidden();
});

test.describe('좁은 화면 탭', () => {
  test.use(PHONE);

  test('레이아웃: 관측 화면 고정', async ({ page }) => {
    await narrowStart(page);
    const view = page.getByRole('img', { name: '관측 화면' });
    const first = await view.boundingBox();
    // Each tab shows its panel and hides the other three; the view stays where it is.
    const panels: [string, string][] = [
      ['입력', '입력기'],
      ['지도', '지도 패널'],
      ['표적', '표적 목록'],
      ['무전', '무전 기록'],
    ];
    for (const [name, shown] of panels) {
      await tab(page, name).click();
      for (const [other] of panels) await expect(tab(page, other)).toHaveAttribute('aria-pressed', String(other === name));
      for (const [, r] of panels) {
        await expect.poll(() => rendered(region(page, r))).toBe(r === shown);
      }
      await expect(view).toBeVisible();
      expect(await view.boundingBox()).toEqual(first);
    }
    // Scrolling a long panel scrolls the panel, not the view.
    await tab(page, '입력').click();
    await page.mouse.move(195, 800);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await view.boundingBox()).toEqual(first);
    // The view still draws: its pixels change as the aim moves.
    const pixels = () => view.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const before = await pixels();
    await page.getByRole('button', { name: '오른쪽 1밀' }).tap();
    await page.getByRole('button', { name: '오른쪽 1밀' }).tap();
    await expect.poll(pixels).not.toBe(before);
  });
});

/** The 7 always-visible 머리띠 items (spec 화면과 조작). */
const alwaysShown = (page: Page) => {
  const band = page.getByRole('banner');
  return [
    band.getByRole('status', { name: '경과' }),
    band.getByRole('status', { name: '점수' }),
    band.getByRole('status', { name: '사용 탄' }),
    band.getByRole('button', { name: '일시정지' }),
    band.getByRole('status', { name: '모드', exact: true }),
    band.getByRole('button', { name: /^배속 ×/ }),
    band.getByRole('button', { name: '메뉴', exact: true }),
  ];
};
/** The 머리띠 메뉴's 8 items, in the spec's order (소리 and 음성 are two). */
const menuItems = (page: Page) => {
  const menu = page.getByRole('region', { name: '머리띠 메뉴', includeHidden: true });
  return [
    menu.getByRole('group', { name: '모드 전환', includeHidden: true }),
    menu.getByRole('group', { name: '화질', includeHidden: true }),
    menu.getByRole('button', { name: '소리', includeHidden: true }),
    menu.getByRole('button', { name: '음성', includeHidden: true }),
    menu.getByRole('textbox', { name: '호출부호', exact: true, includeHidden: true }),
    menu.getByRole('status', { name: '연결', includeHidden: true }),
    menu.getByRole('status', { name: '시드', includeHidden: true }),
    menu.getByRole('status', { name: '기상', includeHidden: true }),
    menu.getByRole('button', { name: '랭킹', includeHidden: true }),
  ];
};

test.describe('좁은 화면 머리띠', () => {
  test.use(PHONE);

  test('머리띠: 좁은 화면의 늘 보이는 항목', async ({ page }) => {
    await page.goto('/?seed=20261106');
    for (const item of alwaysShown(page)) await expect(item).toBeVisible();
    // The 모드 딱지 shows the mode and cannot be pressed: it is no button, and pressing it changes nothing.
    const tag = alwaysShown(page)[4]!;
    await expect(tag).toHaveText('표준');
    expect(await tag.evaluate((e) => e.tagName)).toBe('OUTPUT');
    await expect(page.getByRole('banner').getByRole('button', { name: /모드|표준|훈련/ })).toHaveCount(0);
    await tag.tap();
    await expect(tag).toHaveText('표준');
    // Everything else waits in the closed menu.
    for (const item of menuItems(page)) {
      await expect(item).toHaveCount(1);
      expect(await rendered(item)).toBe(false);
    }
  });

  test('머리띠: 배속 순환', async ({ page }) => {
    await narrowStart(page);
    const speed = page.getByRole('banner').getByRole('button', { name: /^배속 ×/ });
    await expect(speed).toHaveAccessibleName('배속 ×1');
    for (const n of [2, 4, 8, 1, 2, 4, 8]) {
      await speed.tap();
      await expect(speed).toHaveAccessibleName(`배속 ×${n}`);
      await expect(speed).toHaveText(`×${n}`);
    }
    // At ×8 the clock really runs faster: 100 ticks (5 s of game) in well under 5 s.
    const from = await ticks(page);
    const t0 = Date.now();
    await expect.poll(() => ticks(page)).toBeGreaterThan(from + 100);
    expect(Date.now() - t0).toBeLessThan(4000);
  });

  test('머리띠: 메뉴 항목과 일시정지 없음', async ({ page }) => {
    await narrowStart(page);
    const toggle = page.getByRole('button', { name: '메뉴', exact: true });
    const menu = page.getByRole('region', { name: '머리띠 메뉴' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(menu).toBeVisible();
    // The 8 items, all shown, in this order.
    const items = menuItems(page);
    for (const item of items) await expect(item).toBeVisible();
    await expect(items[5]!).toHaveText('오프라인');
    await expect(items[6]!).toHaveText('연습 20261106');
    await expect(items[7]!).toHaveText('시정 24.0 km · 바람 285° 2.6 m/s');
    const handles = await Promise.all(items.map((i) => i.elementHandle()));
    const ordered = await page.evaluate((els) => els.every((e, i) => i === 0 || !!(els[i - 1]!.compareDocumentPosition(e!) & Node.DOCUMENT_POSITION_FOLLOWING)), handles);
    expect(ordered).toBe(true);
    // A sheet over the lower tabs: the view stays uncovered and in sight.
    const view = page.getByRole('img', { name: '관측 화면' });
    const v = (await view.boundingBox())!;
    const m = (await menu.boundingBox())!;
    expect(m.y).toBeGreaterThanOrEqual(v.y + v.height - 1);
    expect(Math.abs(m.y + m.height - 844)).toBeLessThanOrEqual(1);
    expect(m.width).toBeCloseTo(390, 0);
    // It covers the tabs: what lies at their centre now is the menu.
    const t = await centre(page.getByRole('group', { name: '아래 탭' }));
    expect(await menu.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), t)).toBe(true);
    await expect(view).toBeVisible();
    // No pause: the clock keeps running while the menu is open.
    const open = await ticks(page);
    await expect.poll(() => ticks(page)).toBeGreaterThan(open + 10);
    await expect(page.getByRole('button', { name: '일시정지' })).toHaveAttribute('aria-pressed', 'false');
    // Closing it brings the tabs back.
    await toggle.tap();
    await expect(menu).toBeHidden();
    await expect(page.getByRole('group', { name: '아래 탭' })).toBeVisible();
  });
});

test.describe('좁은 화면 지도', () => {
  test.use(PHONE);

  test('F-06: 두 손가락 확대', async ({ page }) => {
    await page.goto('/?seed=20261106');
    await tab(page, '지도').click();
    const panel = page.getByRole('region', { name: '지도 패널' });
    const map = panel.getByRole('img', { name: '지도' });
    const zoom = panel.getByRole('status', { name: '지도 배율' });
    const prep = region(page, '작전 준비');
    const unpicked = '지도를 눌러 관측소 후보를 고르십시오';
    await expect(zoom).toHaveText('×1');
    await expect(prep).toContainText(unpicked);

    // Two fingers 40 px apart spread to 200 px around the map's centre: the map zooms in (at most ×8), and a pinch
    // is not a press, so no 관측소 후보 is picked.
    const c = await centre(map);
    const frames = Array.from({ length: 11 }, (_, i) => {
      const d = 20 + i * 8;
      return [
        { x: c.x - d, y: c.y },
        { x: c.x + d, y: c.y },
      ];
    });
    await gesture(page, frames);
    await expect.poll(async () => Number((await zoom.textContent())!.slice(1))).toBeGreaterThan(3);
    expect(Number((await zoom.textContent())!.slice(1))).toBeLessThanOrEqual(8);
    await expect(prep).toContainText(unpicked);

    // One finger drags the zoomed map: it moves, and again nothing is picked.
    const before = await settledMap(page, map);
    await gesture(page, Array.from({ length: 8 }, (_, i) => [{ x: c.x + i * 10, y: c.y + i * 6 }]));
    await expect.poll(() => mapPixels(map)).not.toBe(before);
    await expect(prep).toContainText(unpicked);
    const zoomed = await zoom.textContent();
    // Two fingers closing zoom back out.
    await gesture(page, [...frames].reverse());
    await expect.poll(() => zoom.textContent()).not.toBe(zoomed);
    await expect(prep).toContainText(unpicked);
  });
});
