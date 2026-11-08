import { expect, test, type Locator, type Page } from '@playwright/test';
import { fireOnOwnPost, mapPixels, narrowStart, region, settledMap, tab, ticks } from './helpers';

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
/** Whether the browser renders it at all (an empty panel has no height, so Playwright's "visible" would say no). */
const rendered = (l: Locator) => l.evaluate((e) => e.checkVisibility());

test.describe('좁은 화면', () => {
  test.use(PHONE);

  test('F-03: 1밀 터치 단추', async ({ page }) => {
    test.setTimeout(240_000);
    await narrowStart(page);
    const pad = page.getByRole('region', { name: '관측' }).getByRole('group', { name: '1밀 조준' });
    const press = (name: string) => pad.getByRole('button', { name }).tap();
    // One tap on each button, then the right one held for a second.
    await press('오른쪽 1밀');
    await press('왼쪽 1밀');
    await press('위 1밀');
    await press('아래 1밀');
    await gesture(page, [[await centre(pad.getByRole('button', { name: '오른쪽 1밀' }))]], 1000);
    // B straight after the lift: its 쌍안경 input marks the release in the record (its tick is the release's or later).
    await page.keyboard.press('b');
    await page.waitForTimeout(400);

    // The exact aims come from the game's 재생 자료, which the 사후강평 shows once the game ends: every accepted input
    // with its tick `t` (20 a second), 조준 입력 [az, el] in 0.1 mils. End it the shortest way, on the wide layout (the
    // same page, nothing remounts).
    await page.setViewportSize({ width: 1280, height: 800 });
    const debrief = await fireOnOwnPost(page);
    await debrief.getByText('전송 데이터 미리보기').click();
    type Rec = { t: number; a: string; v: number[] };
    const inputs = (JSON.parse((await debrief.getByLabel('전송 데이터').textContent())!) as { inputs: Rec[] }).inputs;
    const cams = inputs.filter((i) => i.a === 'cam');

    // From the opening aim 20.4 / −22 mils: each tap is exactly 1 mil on its own axis, in its direction.
    expect(cams.slice(0, 4).map((c) => c.v)).toEqual([
      [214, -220],
      [204, -220],
      [204, -210],
      [204, -220],
    ]);
    // The hold: one step at once, the repeats from 350 ms on, one every 90 ms (the first lands at 440 ms) — 8 in the
    // second held, each exactly 1 mil right of the one before. The timing bounds below are wide enough for a loaded
    // runner's main-thread stalls; the strict stop-on-release timing goes to human review (#45, user decision
    // 2026-11-08).
    const held = cams.slice(4);
    expect(held.length).toBeGreaterThanOrEqual(4); // at least 3 repeats after the first step
    expect(held.length).toBeLessThanOrEqual(10);
    expect(held.map((c) => c.v)).toEqual(held.map((_, i) => [214 + 10 * i, -220]));
    // It stops at the lift: no 조준 입력 after the release mark.
    const release = inputs.findIndex((i) => i.a === 'bino');
    expect(release).toBeGreaterThan(inputs.indexOf(held.at(-1)!));
    expect(inputs.slice(release).filter((i) => i.a === 'cam')).toEqual([]);
    // Continuous over time: 440 ms ≈ 8.8 ticks to the first repeat, then 90 ms ≈ 1.8 ticks apart — every step on a
    // later tick than the one before (no same-tick burst), within a stall's slack.
    const gaps = held.slice(1).map((c, i) => c.t - held[i]!.t);
    expect(gaps[0]).toBeGreaterThanOrEqual(4);
    expect(gaps[0]).toBeLessThanOrEqual(25);
    for (const g of gaps.slice(1)) {
      expect(g).toBeGreaterThanOrEqual(1);
      expect(g).toBeLessThanOrEqual(8);
    }
    // Held up to the lift: from the last step to the release mark (the B key straight after it), with a stall's slack.
    expect(inputs[release]!.t - held.at(-1)!.t).toBeLessThanOrEqual(12);
  });
});

/** The wide 머리띠 is one row (spec): every item's centre within 3 px of the first, and the band one row high. Where it
 * `fits` (1280 px and up) the band does not scroll and every item lies inside the band's visible box. */
async function oneRow(page: Page, fits: boolean) {
  const items = [page.getByRole('banner').getByText('OBSERVER'), ...alwaysShown(page).slice(0, 6), ...menuItems(page)];
  const boxes = [];
  for (const item of items) {
    await expect(item).toBeVisible();
    boxes.push((await item.boundingBox())!);
  }
  for (const b of boxes) expect(Math.abs(b.y + b.height / 2 - (boxes[0]!.y + boxes[0]!.height / 2))).toBeLessThanOrEqual(3);
  const row = Math.max(...boxes.map((b) => b.height));
  // The band: the 머리띠's banner and its menu side by side; its inner height (no border, no scroll bar) is one row and
  // its padding.
  const band = await page.getByRole('banner').evaluate((h) => {
    const b = h.parentElement!;
    const r = b.getBoundingClientRect();
    return { inner: b.clientHeight, scroll: b.scrollWidth, client: b.clientWidth, left: r.left, right: r.right };
  });
  expect(band.inner).toBeLessThanOrEqual(row + 8);
  if (!fits) return;
  expect(band.scroll).toBeLessThanOrEqual(band.client);
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(band.left);
    expect(b.x + b.width).toBeLessThanOrEqual(band.right);
  }
}

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
  await expect(page.getByRole('banner')).toContainText('포병 관측'); // the wide 머리띠, spread out
  await oneRow(page, false); // 768 px holds about two thirds of the row: it scrolls inside the band (report, for M1-H2)
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await oneRow(page, true);
  }
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
    await expect(items[7]!).toHaveText('시정 24.0km·바람 285° 2.6m/s');
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
