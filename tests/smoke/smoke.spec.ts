import { expect, test, type Locator, type Page } from '@playwright/test';
import { everyControlNamed, lineSaid, linesFrom, mapPixels, settledMap, skipReport, speedTo, standardGame, tabTo, toReady } from './helpers';

test('스모크: 관측소를 고르고 작전을 개시하면 틱 수가 흐른다', async ({ page }) => {
  test.setTimeout(60_000); // 15 s alone, but near the default 30 s under parallel workers
  // A fixed 연습 seed: the daily seed changes the terrain at KST midnight.
  await page.goto('/?seed=20261106');
  await standardGame(page); // the long prep below on the dark view (the preview draws every frame); 훈련 is pressed later
  const tick = page.getByRole('status', { name: '틱' });
  await expect(tick).toBeVisible();
  // 작전 준비: the clock stands still.
  await expect(tick).toHaveText('0');
  await page.waitForTimeout(500);
  await expect(tick).toHaveText('0');
  // 무전 기록 is empty until the operation starts.
  await expect(page.getByRole('region', { name: '무전 기록' })).toHaveText('');
  await everyControlNamed(page);

  // 호출부호를 정하고 랭킹 창을 연다: the mock board's fake rows are marked, and 닫기 closes it.
  await page.getByRole('textbox', { name: '호출부호', exact: true }).fill('참새12');
  await page.getByRole('button', { name: '정하기' }).click();
  await expect(page.getByRole('status', { name: '현재 호출부호' })).toHaveText('참새12');
  await page.getByRole('button', { name: '랭킹' }).click();
  const ranking = page.getByRole('dialog', { name: '랭킹' });
  await expect(ranking).toBeVisible();
  await expect(ranking.getByRole('row').filter({ hasText: '목업' })).toHaveCount(12);
  await everyControlNamed(page);
  await ranking.getByRole('button', { name: '닫기' }).click();
  await expect(ranking).toBeHidden();

  // 지도 패널에 지형이 그려진다
  const map = page.getByRole('img', { name: '지도' });
  await expect(map).toBeVisible();
  const colours = await map.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    const seen = new Set<string>();
    for (let y = 16; y < c.height; y += 64) for (let x = 16; x < c.width; x += 64) seen.add(ctx.getImageData(x, y, 1, 1).data.join());
    return seen.size;
  });
  expect(colours).toBeGreaterThan(8);

  // 관측소 후보: pressing an open field north of 1번 고지 picks it, then 작전 개시 starts the clock.
  // (The map's centre is forest on this seed: the eye stands under the canopy and sees only trees.)
  const prep = page.getByRole('region', { name: '작전 준비' });
  await expect(prep).toContainText('연습 20261106');
  // 준비 화면에 기상이 보인다: a practice seed starts in clear weather.
  await expect(prep).toContainText('기상 시정 24.0 km · 구름 15% · 바람 285° 2.6 m/s');
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(prep).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await expect(tick).toHaveText('0');
  // Start in 훈련 모드 (in 작전 준비 it is free: no warning).
  await page.getByRole('button', { name: '훈련', exact: true }).click();
  await expect(page.getByRole('button', { name: '훈련', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  const first = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(first);
  // Not the planned post: 위치 보고 is required.
  await expect(prep).toContainText('작전 개시 — 찰리호텔 4512 3256 점령. 계획과 다른 위치이므로 기러기에게 위치를 보고하십시오.');
  await everyControlNamed(page); // 위치 보고

  // 관측 화면: 화살표가 조준을, B가 쌍안경을 바꾼다
  const view = page.getByRole('img', { name: '관측 화면' });
  await expect(view).toBeVisible();
  const pixels = () =>
    view.evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext('2d')!;
      const out: string[] = [];
      for (let y = c.height * 0.3; y < c.height; y += c.height / 8)
        for (let x = c.width / 16; x < c.width; x += c.width / 8) out.push(ctx.getImageData(x | 0, y | 0, 1, 1).data.join());
      return out.join(';');
    });
  // Terrain is drawn: the lower part of the view (ground at the default -22 mil) holds many colours, not a blank or a wall.
  const shades = () =>
    view.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, c.height * 0.6 | 0, c.width, c.height * 0.4 | 0).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return seen.size;
    });
  await expect.poll(shades).toBeGreaterThan(32);
  const before = await pixels();
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(pixels).not.toBe(before);
  const bino = page.getByRole('button', { name: '쌍안경' });
  await expect(bino).toHaveAttribute('aria-pressed', 'false');
  const eye = await pixels();
  await page.keyboard.press('b');
  await expect(bino).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(pixels).not.toBe(eye);
  await page.keyboard.press('b');
  await expect(bino).toHaveAttribute('aria-pressed', 'false');

  // 배속 up, then one 일시정지: the clock stands still, and runs again on 재개.
  await speedTo(page, 8);
  const fast = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(fast + 100);
  await page.getByRole('button', { name: '일시정지' }).click();
  const paused = await tick.textContent();
  await page.waitForTimeout(500);
  await expect(tick).toHaveText(paused!);
  await page.getByRole('button', { name: '재개' }).click();
  await expect.poll(async () => tick.textContent()).not.toBe(paused);

  // 키보드 걸음 (arrows and B above): 랭킹 by Tab and Enter; the focus is kept in the dialog, and Esc brings it back.
  const opener = page.getByRole('button', { name: '랭킹' });
  await tabTo(page, opener);
  await page.keyboard.press('Enter');
  await expect(ranking).toBeVisible();
  const inDialog = () => ranking.evaluate((d) => d.contains(document.activeElement));
  expect(await inDialog()).toBe(true);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+Tab');
    // A modal dialog makes the page under it inert: the focus stays inside or leaves the page, never lands under it.
    expect(await page.evaluate(() => !document.activeElement || document.activeElement === document.body || !!document.activeElement.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(ranking).toBeHidden();
  await expect(opener).toBeFocused();
});

test('스모크: 좁은 화면 390 px — 탭 넷과 머리띠 메뉴', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=20261106');
  // The 7 always-visible 머리띠 items fit one line at 390 px.
  const band = page.getByRole('banner');
  const items = [
    band.getByRole('status', { name: '경과' }),
    band.getByRole('status', { name: '점수' }),
    band.getByRole('status', { name: '사용 탄' }),
    band.getByRole('button', { name: '일시정지' }),
    band.getByRole('status', { name: '모드', exact: true }),
    band.getByRole('button', { name: /^배속 ×/ }),
    band.getByRole('button', { name: '메뉴', exact: true }),
  ];
  const boxes = [];
  for (const item of items) {
    await expect(item).toBeVisible();
    boxes.push((await item.boundingBox())!);
  }
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  for (const b of boxes) {
    expect(Math.abs(mid(b) - mid(boxes[0]!))).toBeLessThan(Math.min(b.height, boxes[0]!.height) / 2);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  }
  // The 4 tabs each open their panel.
  const tabs = page.getByRole('group', { name: '아래 탭' });
  for (const [name, region] of [
    ['입력', '작전 준비'],
    ['지도', '지도 패널'],
    ['표적', '표적 목록'],
    ['무전', '무전 기록'],
  ] as const) {
    await tabs.getByRole('button', { name, exact: true }).click();
    await expect(tabs.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.getByRole('region', { name: region, includeHidden: true }).evaluate((e) => e.checkVisibility())).toBe(true);
  }
  // The 머리띠 메뉴 opens and closes.
  const menuButton = band.getByRole('button', { name: '메뉴', exact: true });
  const menu = page.getByRole('region', { name: '머리띠 메뉴' });
  await menuButton.click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: '랭킹' })).toBeVisible();
  await menuButton.click();
  await expect(menu).toBeHidden();
});

/** Whether the lower view is drawn in 2-pixel blocks: 보통 renders 480 internal pixels, stretched to a 960-wide canvas. */
const doubled = (view: Locator) =>
  view.evaluate((c: HTMLCanvasElement) => {
    if (c.width !== 960) return null;
    const d = c.getContext('2d')!.getImageData(0, (c.height * 0.6) | 0, c.width, (c.height * 0.4) | 0).data;
    for (let i = 0; i < d.length; i += 8) for (let k = 0; k < 3; k++) if (d[i + k] !== d[i + 4 + k]) return false;
    return true;
  });

test('F-30: 연습 시드의 기상 선택 — 화면', async ({ page }) => {
  // A daily game: the weather the seed picked is shown, and there is nothing to choose.
  await page.goto('/');
  const prep = page.getByRole('region', { name: '작전 준비' });
  await expect(prep).toContainText('일일 ');
  await expect(prep).toContainText(/기상 시정 \d+\.\d km · 구름 \d+% · 바람 \d+° \d+\.\d m\/s/);
  await expect(page.getByRole('combobox', { name: '기상 바꾸기' })).toHaveCount(0);

  // A practice game: the five presets by name, clear first; choosing one shows its values.
  await page.goto('/?seed=20261106');
  await expect(prep).toContainText('연습 20261106');
  const picker = page.getByRole('combobox', { name: '기상 바꾸기' });
  await expect(picker).toBeVisible();
  for (const name of ['맑음', '박무', '비', '강한 북서풍', '안개']) await expect(picker.getByRole('option', { name, exact: true })).toHaveCount(1);
  await expect(picker.getByRole('option')).toHaveCount(5);
  await expect(picker).toHaveValue('clear');
  await expect(prep).toContainText('기상 시정 24.0 km · 구름 15% · 바람 285° 2.6 m/s');
  await picker.selectOption({ label: '비' });
  await expect(prep).toContainText('기상 시정 8.0 km · 구름 100% · 바람 200° 5.2 m/s · 11.2°C · 습도 94% · 1009 hPa · 강수 2.4 mm/h');
  await expect(picker).toHaveValue('rain');
});

test('F-30: 기상 변경은 판을 새로 만든다 — 화면', async ({ page }) => {
  // `doubled` reads a 960-px view canvas: at 1280 px the wide layout's view column is narrower.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=20261106');
  await standardGame(page); // training's labels are drawn at full resolution and would break `doubled`
  const tick = page.getByRole('status', { name: '틱' });
  const prep = page.getByRole('region', { name: '작전 준비' });
  const map = page.getByRole('img', { name: '지도' });
  const bino = page.getByRole('button', { name: '쌍안경' });
  const quality = (name: string) => page.getByRole('group', { name: '화질' }).getByRole('button', { name, exact: true });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(prep).toContainText('관측소 후보: 찰리호텔 4512 3256');
  // The reference map is a fresh 안개 game with this post and the default sight: the map base follows the weather (#105).
  const weather = page.getByRole('combobox', { name: '기상 바꾸기' });
  await weather.selectOption({ label: '안개' });
  await expect(prep).toContainText('기상 시정 2.5 km · 구름 100% · 바람 180° 0.7 m/s');
  const fresh = await settledMap(page, map);
  // 화질 is the player's, not the game's: 높음 chosen in prep stays through the weather change.
  await quality('높음').click();
  await expect(quality('높음')).toHaveAttribute('aria-pressed', 'true');

  // Prep state the simulation holds and the screen shows: the line of sight turned east (the map's sight wedge) and the
  // binoculars on.
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('b');
  await expect.poll(() => mapPixels(map)).not.toBe(fresh);
  await expect(bino).toHaveAttribute('aria-pressed', 'true');

  // 비 and back to 안개: a fresh game under that weather again, the line of sight and the binoculars back where a new
  // game has them, the chosen 관측소 후보 kept and the clock still at 0.
  await weather.selectOption({ label: '비' });
  await expect(prep).toContainText('기상 시정 8.0 km · 구름 100% · 바람 200° 5.2 m/s');
  await weather.selectOption({ label: '안개' });
  await expect(prep).toContainText('기상 시정 2.5 km · 구름 100% · 바람 180° 0.7 m/s');
  await expect.poll(() => mapPixels(map)).toBe(fresh);
  await expect(bino).toHaveAttribute('aria-pressed', 'false');
  await expect(prep).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await expect(tick).toHaveText('0');
  await expect(quality('높음')).toHaveAttribute('aria-pressed', 'true');
  await expect(quality('보통')).toHaveAttribute('aria-pressed', 'false');

  // 작전 개시 runs the new game from that post: its clock moves, and none of the old game's inputs (the turned sight,
  // the binoculars) reach it.
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(20);
  await expect(prep).toContainText('작전 개시 — 찰리호텔 4512 3256 점령.');
  await expect(bino).toHaveAttribute('aria-pressed', 'false');
  expect(await mapPixels(map)).toBe(fresh);
  // 높음 still applies once the view draws: 640 internal pixels, no 2-pixel blocks; 보통 (480) draws them.
  const view = page.getByRole('img', { name: '관측 화면' });
  await expect.poll(() => doubled(view)).toBe(false);
  await quality('보통').click();
  await expect.poll(() => doubled(view)).toBe(true);
});

test('스모크: 보이는 적을 누르면 표적 탭에 표적이 생긴다', async ({ page }) => {
  test.setTimeout(90_000); // 통신 점검, 15.5 s of watching and three transmissions with 기러기's answers
  await page.goto('/?seed=20261106');
  await standardGame(page);
  // On this seed the enemy mortar section digs in at about (5676, 7520) from the start. From an open post about
  // 820 m south-east of it, (6450, 7250), six of its crew are seen by eye (found with a Node run of the simulation).
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: (box.width * 6450) / 10240, y: box.height * (1 - 7250 / 10240) } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  const tick = page.getByRole('status', { name: '틱' });
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);

  // Aim at them by eye: from 20.4 mils, 6 × 200 and 3 × 20 mils left gives 5160.4; one 25 mil step up gives +3.
  const view = page.getByRole('img', { name: '관측 화면' });
  await view.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowLeft');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowUp');
  await page.waitForTimeout(300); // a frame drawn with the new aim
  const targets = page.getByRole('region', { name: '표적 목록' });
  await expect(targets).not.toContainText('표적 1');
  const v = (await view.boundingBox())!;
  await view.click({ position: { x: v.width / 2, y: v.height / 2 } });
  await expect(targets).toContainText('표적 1 미상');
  await expect(targets).toContainText('탐지 · 최초 탐지');

  // Watched through the binoculars it is identified (type after 5.5 s, size after 15.5 s), and the 사격요구 goes on
  // the identified target with the composer's non-default values: 바로 효력사, then the 박격포반 as 표적성질. The log
  // holds each observer line exactly as the preview showed it: one line, nothing else in it but its time and 갈매기.
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: '쌍안경' })).toHaveAttribute('aria-pressed', 'true');
  await expect(targets).toContainText('적정 확인', { timeout: 30_000 });
  const log = page.getByRole('region', { name: '무전 기록' });
  const composer = page.getByRole('region', { name: '입력기' });
  const preview = composer.getByRole('status', { name: '보낼 문장' });
  const transmit = async () => {
    const said = (await preview.textContent())!;
    await composer.getByRole('button', { name: '송신' }).click();
    await expect(lineSaid(log, '갈매기', said)).toHaveCount(1); // the whole line: its time, 갈매기 and the sentence
    return said;
  };
  await expect(log).toContainText('감명 양호', { timeout: 15_000 });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click(); // not the planned post (F-21)
  await composer.getByRole('combobox', { name: '경고명령' }).selectOption('ffe');
  expect(await transmit()).toBe('기러기, 여기는 갈매기, 효력사, 이상.');
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await composer.getByRole('textbox', { name: '동', exact: true }).fill('4567');
  await composer.getByRole('textbox', { name: '북', exact: true }).fill('3752');
  expect(await transmit()).toBe('좌표 찰리호텔 넷오여섯칠 삼칠오둘, 이상.');
  const kind = composer.getByRole('combobox', { name: '표적성질' });
  const mortar = (await kind.locator('option', { hasText: '박격포' }).getAttribute('value'))!;
  await kind.selectOption(mortar);
  expect(await transmit()).toMatch(/박격포/);
  await expect(log).toContainText('표적번호 알파브라보 하나공공하나', { timeout: 20_000 });
});

test('F-07: F 키', async ({ page, context }) => {
  test.setTimeout(120_000);
  // Two runs on the same seed, post and transmissions, side by side: one fires with the button, the other with F.
  const other = await context.newPage();
  const [button, key] = await Promise.all([toReady(page, 'amc'), toReady(other, 'amc')]);
  const fire = button.composer.getByRole('button', { name: '준비 쏴' });
  await expect(fire).toBeVisible();
  await expect(key.composer.getByRole('button', { name: '준비 쏴' })).toBeVisible();
  await fire.click();
  // F with the focus on the page itself, not in a field.
  await other.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await other.evaluate(() => document.activeElement === document.body)).toBe(true);
  await other.keyboard.press('f');

  const after = ['갈매기 준비 쏴.', '기러기 하나발 떳다, 이상.', '갈매기 하나발 떳다, 잠깐대기.'];
  for (const run of [button, key]) await expect(run.log).toContainText(after.at(-1)!.replace(/^\S+ /, ''), { timeout: 15_000 });
  const lines = await Promise.all([button, key].map((run) => linesFrom(run.log, '포대 사격준비 끝.')));
  expect(lines[0]).toEqual(lines[1]);
  expect(lines[0]!.slice(1)).toEqual(after);
});

/** From a fresh page on a fixed seed: occupy the post north of 1번 고지 and wait for the clock to run. */
async function occupied(page: Page) {
  await page.goto('/?seed=20261106');
  await standardGame(page);
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  const tick = page.getByRole('status', { name: '틱' });
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  return page.getByRole('region', { name: '관측' });
}

test('F-05: R 키', async ({ page, context }) => {
  test.setTimeout(60_000);
  // Two runs on the same seed and post, the view untouched: one lases with the button, the other with R.
  const other = await context.newPage();
  const [button, key] = await Promise.all([occupied(page), occupied(other)]);
  await button.getByRole('button', { name: '레이저' }).click();
  await other.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await other.keyboard.press('r');
  // The opening line of sight, 22 mils down, meets the ground: 방위각 0020, a range, no target.
  const line = (view: typeof button) => view.getByRole('group', { name: '레이저 측정' }).locator('p');
  await expect(line(button)).toContainText('레이저: 방위각 0020 밀 · 거리 ');
  await expect(line(key)).toContainText('레이저: 방위각 0020 밀 · 거리 ');
  expect(await line(key).textContent()).toBe(await line(button).textContent());
  await expect(line(button)).not.toContainText('표적 반사');
});

test('F-07: 극좌표 위치법 — 입력기', async ({ page }) => {
  test.setTimeout(60_000);
  const view = await occupied(page);
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('기러기, 여기는 갈매기, 감명 양호, 이상.', { timeout: 10_000 }); // 5.5 s in
  const composer = page.getByRole('region', { name: '입력기' });
  await skipReport(composer); // not the planned post (F-21)
  const preview = composer.getByRole('status', { name: '보낼 문장' });
  const send = composer.getByRole('button', { name: '송신' });
  await send.click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 }); // 2.5–4 s after the call

  // A lase fills 극좌표; then the observer types their own 방위각 and 거리 (거리 goes out to the nearest 10 m).
  await view.getByRole('button', { name: '레이저' }).click();
  await expect(view.getByRole('group', { name: '레이저 측정' }).locator('p')).toContainText('레이저: 방위각 0020 밀');
  await composer.getByRole('radio', { name: '극좌표' }).check();
  await expect(composer.getByRole('textbox', { name: '방위각' })).toHaveValue('0020');
  await composer.getByRole('textbox', { name: '방위각' }).fill('0800');
  await composer.getByRole('textbox', { name: '거리' }).fill('1004');
  await expect(preview).toHaveText('극좌표, 방위각 공팔공공, 거리 하나공공공, 이상.');
  const said = (await preview.textContent())!;
  await send.click();
  // The log shows the observer's line exactly as previewed, then 기러기's readback of it.
  await expect(log.locator('li', { hasText: `갈매기 ${said}` })).toHaveCount(1);
  await expect(log.locator('li', { hasText: `기러기 ${said}` })).toHaveCount(1, { timeout: 10_000 }); // 2.5–4 s
});

test('스모크: 통신 점검 뒤 사격요구 세 송신에 사격준비 끝이 오고, 수정탄을 보고 수정을 한 번 보낸다', async ({ page }) => {
  // 기러기 answers 사격준비 끝 24–38 s after the third transmission; the round then flies about 20 s.
  test.setTimeout(150_000);
  const { log, composer, preview, send } = await toReady(page, 'ready');

  // 준비되는 대로: the adjusting round goes by itself. Once it lands the correction form opens (standard mode: 방향 empty).
  await expect(log).toContainText('하나발 떳다', { timeout: 10_000 });
  const direction = composer.getByRole('textbox', { name: '방향' });
  await expect(direction).toBeVisible({ timeout: 40_000 });
  await expect(direction).toHaveValue('');
  await expect(composer).toContainText('(10 m 단위)');
  await expect(composer).toContainText('(50 m 단위)');
  await everyControlNamed(page); // 수정
  await expect(send).toBeDisabled();
  await direction.fill('0800');
  await composer.getByRole('combobox', { name: '좌우', exact: true }).selectOption('right');
  await composer.getByRole('textbox', { name: '좌우 거리' }).fill('50');
  await expect(preview).toHaveText('방향 공팔공공, 우로 오십, 이상.');
  await send.click();
  await expect(log).toContainText('방향 공팔공공, 우로 오십, 이상.');
  await expect(log).toContainText('방향 공팔공공, 우로 오십, 잠깐대기.', { timeout: 10_000 }); // 기러기's readback, 2.5–4 s
});

test('스모크: 수정에 효력사를 붙여 효력사를 걸면 마감탄 떳다가 오고, 재효력사를 보내면 기러기가 복창한다', async ({ page }) => {
  // 사격준비 끝 24–38 s, the adjusting round about 20 s, 신관 사격준비 끝 14–22 s after the correction, 마감탄 떳다 ~25 s later.
  test.setTimeout(180_000);
  const { log, composer, preview, send } = await toReady(page, 'ready');
  const direction = composer.getByRole('textbox', { name: '방향' });
  await expect(direction).toBeVisible({ timeout: 50_000 });
  await direction.fill('0800');
  await composer.getByRole('combobox', { name: '다음' }).selectOption('ffe');
  await expect(preview).toHaveText('방향 공팔공공, 동제원, 효력사, 이상.');
  await send.click();
  await expect(log).toContainText('방향 공팔공공, 동제원, 효력사, 잠깐대기.', { timeout: 10_000 });
  await expect(log).toContainText('순발신관 사격준비 끝.', { timeout: 30_000 });
  await expect(log).toContainText('기러기 마감탄 떳다, 이상.', { timeout: 40_000 });
  await expect(log).toContainText('갈매기 마감탄 떳다, 잠깐대기.', { timeout: 5_000 });
  await expect(composer).toContainText('효과를 관측하십시오.', { timeout: 40_000 });
  await everyControlNamed(page); // 효과

  // 재효력사: the line the log shows is the one previewed, target name included, then 기러기's readback.
  await composer.getByRole('combobox', { name: '효과' }).selectOption('neutralized');
  await composer.getByRole('combobox', { name: '다음 조치' }).selectOption('repeat');
  await composer.getByRole('combobox', { name: '발수' }).selectOption('1');
  const said = (await preview.textContent())!;
  expect(said).toMatch(/^(표적|적 \S+) 무력화, 재효력사, 동제원, 포대 하나발, 이상\.$/);
  await send.click();
  await expect(log.locator('li', { hasText: `갈매기 ${said}` })).toHaveCount(1);
  await expect(log).toContainText('기러기 동제원 포대 하나발, 잠깐대기.', { timeout: 10_000 }); // 3 s
});

test('스모크: 바로 효력사 뒤 수정 후 효력사에 방향을 함께 보내고, 임무끝으로 임무를 맺는다', async ({ page }) => {
  // 사격준비 끝 24–38 s, the volley lands ~40 s later; after the correction 14–22 s, then the volley again; the move a few
  // seconds and its 30 s setup.
  test.setTimeout(360_000);
  const { log, composer, preview, send } = await toReady(page, 'ready', 'ffe');
  await expect(composer).toContainText('효과를 관측하십시오.', { timeout: 90_000 });

  // B1: this mission never sent 방향, so 수정 후 효력사 asks for it and cannot go without it.
  await composer.getByRole('combobox', { name: '효과' }).selectOption('ineffective');
  await composer.getByRole('combobox', { name: '다음 조치' }).selectOption('corr');
  const direction = composer.getByRole('textbox', { name: '방향' });
  await expect(direction).toHaveValue('');
  await expect(send).toBeDisabled();
  await direction.fill('0800');
  await composer.getByRole('combobox', { name: '좌우', exact: true }).selectOption('right');
  await composer.getByRole('textbox', { name: '좌우 거리' }).fill('50');
  await expect(preview).toHaveText('방향 공팔공공, 우로 오십, 효력사, 이상.');
  await send.click();
  await expect(log).toContainText('방향 공팔공공, 우로 오십, 효력사, 이상.');
  await expect(log).toContainText('방향 공팔공공, 우로 오십, 효력사, 잠깐대기.', { timeout: 10_000 });
  await expect(log.locator('li', { hasText: '마감탄 떳다, 잠깐대기.' })).toHaveCount(2, { timeout: 90_000 }); // fired again

  // 임무끝: the preview is the line the log shows, and the composer is back to a new call.
  await expect(composer.getByRole('combobox', { name: '다음 조치' })).toHaveValue('eom', { timeout: 60_000 });
  await composer.getByRole('combobox', { name: '효과' }).selectOption('destroyed');
  const said = await preview.textContent();
  expect(said).toMatch(/^임무끝, .+ 파괴\.$/);
  await send.click();
  await expect(log.locator('li').last()).toContainText(said!);
  await expect(composer.getByRole('combobox', { name: '경고명령' })).toBeVisible();
  // A new mission's form starts on 조정 (demo 703, 947–950), so 효력사 is chosen again.
  await composer.getByRole('combobox', { name: '경고명령' }).selectOption('ffe');
  await expect(preview).toHaveText('기러기, 여기는 갈매기, 효력사, 이상.');

  await test.step('F-21: 관측소 이동과 위치 보고', async () => {
    // After 임무끝 the post may move: press the map 1 px east of it (a few metres: the shortest walk the map gives; B2
    // limits only the map edges), walk, wait the 30 s setup, then report the grid the 좌표자 read.
    const mapPanel = page.getByRole('region', { name: '지도 패널' });
    await mapPanel.getByRole('button', { name: '관측소로' }).click();
    const map = mapPanel.getByRole('img', { name: '지도' });
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width / 2 + 1, y: box.height / 2 } });
    const ruler = (await mapPanel.getByText(/^좌표자:/).textContent())!;
    const [, e, n] = ruler.match(/(\d{4}) (\d{4})/)!;
    await mapPanel.getByRole('button', { name: /^여기로 관측소 이동 · \d+ m · 약 \d\d:\d\d/ }).click();
    await expect(log).toContainText('관측소 이동 시작 — 거리');
    await expect(log).toContainText('기러기, 여기는 갈매기, 관측소 이동, 이상.');
    await expect(log).toContainText('갈매기, 여기는 기러기, 관측소 이동, 이상.', { timeout: 10_000 });
    await expect(log).toContainText('관측소 도착.', { timeout: 30_000 });
    await expect(composer).toContainText('관측 장비 설치 중');
    await expect(composer.getByRole('combobox', { name: '경고명령' })).toHaveCount(0);
    await expect(log).toContainText('관측소 설치 끝.', { timeout: 40_000 });
    const report = composer.getByRole('region', { name: '위치 보고' });
    await report.getByRole('textbox', { name: '동', exact: true }).fill(e!);
    await report.getByRole('textbox', { name: '북', exact: true }).fill(n!);
    const said = (await report.getByRole('status', { name: '보낼 문장' }).textContent())!;
    expect(said).toMatch(/^기러기, 여기는 갈매기, 관측소 이동 끝, 현 위치 좌표 찰리호텔 .+, 이상\.$/);
    await report.getByRole('button', { name: '송신' }).click();
    await expect(log.locator('li', { hasText: said })).toHaveCount(1);
    await expect(log).toContainText(said.replace('기러기, 여기는 갈매기', '갈매기, 여기는 기러기'), { timeout: 10_000 }); // 3–4 s
    await expect(composer.getByRole('combobox', { name: '경고명령' })).toBeVisible();
  });

  await test.step('F-07: 전이사격 — 입력기', async () => {
    // From the mission just ended (AB1001): one transmission, previewed as the log will show it; 기러기 reads it back
    // and gives the next 표적번호.
    const shift = page.getByRole('region', { name: '전이사격' });
    await expect(shift).toContainText('기준: AB1001');
    await everyControlNamed(page);
    const shiftPreview = shift.getByRole('status', { name: '보낼 문장' });
    const shiftSend = shift.getByRole('button', { name: '송신' });
    await expect(shiftSend).toBeDisabled(); // standard mode: 방향 starts empty
    await shift.getByRole('textbox', { name: '방향' }).fill('0800');
    await shift.getByRole('combobox', { name: '좌우', exact: true }).selectOption('right');
    await shift.getByRole('textbox', { name: '좌우 거리' }).fill('104');
    await shift.getByRole('combobox', { name: '사거리', exact: true }).selectOption('add');
    await shift.getByRole('textbox', { name: '사거리 거리' }).fill('130');
    await shift.getByRole('combobox', { name: '발수' }).selectOption('2');
    await shift.getByRole('checkbox', { name: '위험근접' }).check();
    await expect(shiftPreview).toHaveText(/^전이, 표적번호 알파브라보 하나공공하나, 방향 공팔공공, 우로 하나백, .+, 포대 둘발, 위험근접, 효력사, 이상\.$/);
    const line = (await shiftPreview.textContent())!;
    await shiftSend.click();
    await expect(log.locator('li', { hasText: `갈매기 ${line}` })).toHaveCount(1);
    await expect(log.locator('li', { hasText: `기러기 ${line.replace(/이상\.$/, '잠깐대기.')}` })).toHaveCount(1, { timeout: 10_000 }); // 3 s
    await expect(log).toContainText('표적번호 알파브라보 하나공공둘', { timeout: 20_000 }); // 사격지휘통보 9–12 s
  });
});

test('시간 배율: timescale=4는 틱을 네 배로 흘린다', async ({ page }) => {
  // The hidden test aid the game smoke switches on after the pick: none is normal pace (×1: 40 ticks in 2 s), and the
  // loop reads the address each frame, so adding timescale=4 mid-game runs ×1 × 4.
  await page.goto('/?seed=20261106');
  await standardGame(page);
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  const tick = page.getByRole('status', { name: '틱' });
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  const ticksIn2s = async () => {
    const before = Number(await tick.textContent());
    await page.waitForTimeout(2000);
    return Number(await tick.textContent()) - before;
  };
  const normal = await ticksIn2s();
  expect(normal).toBeGreaterThan(20);
  expect(normal).toBeLessThan(60);
  await page.evaluate(() => history.replaceState(null, '', `${location.search}&timescale=4`));
  expect(await ticksIn2s()).toBeGreaterThan(normal * 2.5);
  // No control, text or setting shows it.
  await expect(page.getByText(/timescale|시간 배율/)).toHaveCount(0);
});
