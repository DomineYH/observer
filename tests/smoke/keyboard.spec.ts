// 키보드와 화면 읽기 (#42, spec 384–388): the seven 단축키, when they are ignored, and the focus of the 머리띠 메뉴 and 랭킹.
import { expect, test, type Page } from '@playwright/test';
import { linesFrom, narrowStart, tab, tabTo, ticks, toReady } from './helpers';

/** Lets `n` more ticks pass, so any input sent before has been applied. */
async function ticksPass(page: Page, n = 3) {
  const from = await ticks(page);
  await expect.poll(() => ticks(page)).toBeGreaterThanOrEqual(from + n);
}
/** Focus on the page itself, not on a control. */
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test('B7: 조합 키에서는 단축키 무시', async ({ page }) => {
  test.setTimeout(120_000);
  const { log } = await toReady(page, 'amc'); // 지명사: F would send 준비 쏴
  const view = page.getByRole('region', { name: '관측' });
  const readout = view.getByLabel('레이저 측정');
  await blur(page);
  for (const mod of ['Control', 'Alt', 'Meta'])
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift+ArrowRight', 'b', 'r', 'f']) await page.keyboard.press(`${mod}+${k}`);
  await ticksPass(page);
  await expect(readout).toHaveCount(0); // no R lase
  await expect(view.getByRole('button', { name: '쌍안경' })).toHaveAttribute('aria-pressed', 'false');
  await expect(log).not.toContainText('준비 쏴.');
  await view.getByRole('button', { name: '레이저' }).click();
  await expect(readout.locator('p')).toContainText('레이저: 방위각 0020 밀'); // the opening aim: no arrow moved it
  // The same keys bare still act, and the page was never reloaded by a combination.
  await blur(page);
  await page.keyboard.press('f');
  await expect(log).toContainText('갈매기 준비 쏴.');
  await expect(log).toContainText('작전 개시.');
});

test('B7: 단축키는 단추와 같은 입력', async ({ page, context }) => {
  test.setTimeout(150_000);
  // Two runs on the same seed, post and transmissions, side by side: one plays with the keys, the other with the buttons.
  const other = await context.newPage();
  const [keys, buttons] = await Promise.all([toReady(page, 'amc'), toReady(other, 'amc')]);
  const kView = page.getByRole('region', { name: '관측' });
  const bView = other.getByRole('region', { name: '관측' });
  const line = (view: typeof kView) => view.getByLabel('레이저 측정').locator('p');
  const pad = (name: string) => bView.getByRole('group', { name: '1밀 조준' }).getByRole('button', { name });
  let before = '';
  /** `key` on one page, `n` presses of the 1밀 `button` on the other (Enter: one step each), then R and 레이저. */
  const same = async (key: string, button: string, n: number, az: string) => {
    await blur(page);
    await page.keyboard.press(key);
    await page.keyboard.press('r');
    await pad(button).focus();
    for (let i = 0; i < n; i++) await other.keyboard.press('Enter');
    await bView.getByRole('button', { name: '레이저' }).click();
    // The arrow's step (육안 20/5, 쌍안경 2/1 밀; Shift ×10 방위, ×5 고각) is the aim n 1밀 presses reach.
    await expect(line(kView)).not.toHaveText(before);
    await expect(line(kView)).toContainText(`레이저: 방위각 ${az} 밀`);
    await expect(line(bView)).toHaveText((before = (await line(kView).textContent())!));
  };
  // The opening aim is 0020 · −22 mils.
  await same('ArrowRight', '오른쪽 1밀', 20, '0040');
  await same('Shift+ArrowLeft', '왼쪽 1밀', 200, '6240');
  await same('ArrowUp', '위 1밀', 5, '6240');
  await same('Shift+ArrowDown', '아래 1밀', 25, '6240');
  // B ≡ 쌍안경.
  await blur(page);
  await page.keyboard.press('b');
  await bView.getByRole('button', { name: '쌍안경' }).click();
  for (const view of [kView, bView]) await expect(view.getByRole('button', { name: '쌍안경' })).toHaveAttribute('aria-pressed', 'true');
  await same('ArrowRight', '오른쪽 1밀', 2, '6242');
  await same('Shift+ArrowRight', '오른쪽 1밀', 20, '6262');
  await same('ArrowUp', '위 1밀', 1, '6262');
  await same('Shift+ArrowDown', '아래 1밀', 5, '6262');
  // F ≡ 준비 쏴.
  await blur(page);
  await page.keyboard.press('f');
  await buttons.composer.getByRole('button', { name: '준비 쏴' }).click();
  for (const run of [keys, buttons]) await expect(run.log).toContainText('하나발 떳다, 잠깐대기.', { timeout: 15_000 });
  const lines = await Promise.all([keys, buttons].map((run) => linesFrom(run.log, '포대 사격준비 끝.')));
  expect(lines[0]).toEqual(lines[1]);
  expect(lines[0]).toContain('갈매기 준비 쏴.');
});

/** From a fresh page on a fixed seed: occupy the post north of 1번 고지 and wait for 통신 점검 to end. */
async function occupy(page: Page) {
  await page.goto('/?seed=20261106');
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('감명 양호', { timeout: 15_000 });
  return { log, composer: page.getByRole('region', { name: '입력기' }), view: page.getByRole('region', { name: '관측' }) };
}

test('B7: 초점에 따른 무시 조건', async ({ page }) => {
  test.setTimeout(60_000);
  const { log, composer, view } = await occupy(page);
  const bino = view.getByRole('button', { name: '쌍안경' });
  const readout = view.getByLabel('레이저 측정');
  const keys = async (...k: string[]) => {
    for (const key of k) await page.keyboard.press(key);
  };
  // A text field (위치 보고 동), a select (경고명령) and a radio button (좌표): the keys go to the field, not the game.
  await composer.getByRole('region', { name: '위치 보고' }).getByRole('textbox', { name: '동' }).focus();
  await keys('b', 'r', 'ArrowLeft', 'Shift+ArrowUp');
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click();
  await composer.getByRole('combobox', { name: '경고명령' }).focus();
  await keys('b', 'r', 'ArrowUp');
  await composer.getByRole('button', { name: '송신' }).click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await composer.getByRole('radio', { name: '좌표', exact: true }).focus();
  await keys('b', 'r');
  await ticksPass(page);
  await expect(readout).toHaveCount(0);
  await expect(bino).toHaveAttribute('aria-pressed', 'false');

  // A focused button keeps the keys: the aim moves 20 mils, R lases, B takes the binoculars.
  await bino.focus();
  await keys('ArrowRight', 'r');
  await expect(readout.locator('p')).toContainText('레이저: 방위각 0040 밀');
  await keys('b');
  await expect(bino).toHaveAttribute('aria-pressed', 'true');
});

test('F-07: 키보드만으로 사격요구', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?seed=20261106');
  // Pressing the map is a pointer-only 조작; everything after it goes by Tab, typing and Enter/Space.
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await tabTo(page, page.getByRole('button', { name: '관측소 점령 · 작전 개시' }));
  await page.keyboard.press('Enter');
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('감명 양호', { timeout: 15_000 });
  const composer = page.getByRole('region', { name: '입력기' });
  const send = composer.getByRole('button', { name: '송신' });
  await tabTo(page, composer.getByRole('button', { name: '보고하지 않고 계속' }));
  await page.keyboard.press('Space');
  await expect(log).toContainText('위치 보고 생략');
  await tabTo(page, send);
  await page.keyboard.press('Enter');
  await expect(log).toContainText('기러기, 여기는 갈매기, 조정, 이상.');
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await tabTo(page, composer.getByRole('textbox', { name: '동', exact: true }));
  await page.keyboard.type('4720');
  await page.keyboard.press('Tab');
  await expect(composer.getByRole('textbox', { name: '북', exact: true })).toBeFocused();
  await page.keyboard.type('3150');
  await tabTo(page, send);
  await page.keyboard.press('Space');
  await expect(log).toContainText('찰리호텔 넷칠둘공 삼하나오공');
  await expect(composer.getByRole('combobox', { name: '표적성질' })).toBeVisible({ timeout: 15_000 });
  await tabTo(page, send);
  await page.keyboard.press('Enter');
  await expect(log).toContainText('미상 표적, 포대 삼발, 이상.');
  await expect(log).toContainText('표적번호 알파브라보 하나공공하나', { timeout: 20_000 });
  await expect(log).toContainText('포대 사격준비 끝.', { timeout: 60_000 });
});

test.describe('좁은 화면', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('머리띠: 메뉴의 초점과 Esc', async ({ page }) => {
    await page.goto('/?seed=20261106');
    const toggle = page.getByRole('button', { name: '메뉴', exact: true });
    const menu = page.getByRole('region', { name: '머리띠 메뉴' });
    // No read-out is a live region: the clock and the score would be read out every tick.
    await expect(page.locator('output')).not.toHaveCount(0);
    await expect(page.locator('output:not([aria-live="off"])')).toHaveCount(0);

    await tabTo(page, toggle);
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: '훈련' })).toBeFocused(); // its first item
    // Not a trap: Tab leaves the sheet while the game keeps running.
    const inMenu = () => menu.evaluate((m) => m.contains(document.activeElement));
    for (let i = 0; i < 30 && (await inMenu()); i++) await page.keyboard.press('Tab');
    expect(await inMenu()).toBe(false);
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: '음성' }).focus();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toBeFocused();

    // While the clock runs: the same, and Esc does not stop the game.
    await narrowStart(page);
    await toggle.click();
    await expect(menu.getByRole('button', { name: '훈련' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
    const from = await ticks(page);
    await expect.poll(() => ticks(page)).toBeGreaterThan(from);

    // Esc in the 랭킹 dialog, which opens from the menu, closes only the dialog.
    await toggle.click();
    const ranking = menu.getByRole('button', { name: '랭킹' });
    await ranking.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '랭킹' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menu).toBeVisible();
    await expect(ranking).toBeFocused();
  });

  test('F-03: 탭과 화살표', async ({ page }) => {
    await narrowStart(page);
    const map = tab(page, '지도');
    const targets = tab(page, '표적');
    await tabTo(page, map);
    await page.keyboard.press('Enter');
    await expect(map).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: '지도 패널' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(targets).toBeFocused();
    await page.keyboard.press('Space');
    await expect(targets).toHaveAttribute('aria-pressed', 'true');
    await expect(map).toHaveAttribute('aria-pressed', 'false');
    // On a tab, an arrow is still 조준: the tab keeps the focus and its choice, and the aim moves 20 mils.
    await page.keyboard.press('ArrowRight');
    await expect(targets).toBeFocused();
    await expect(targets).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('r');
    await expect(page.getByRole('region', { name: '관측' }).getByLabel('레이저 측정').locator('p')).toContainText('레이저: 방위각 0040 밀');
  });
});
