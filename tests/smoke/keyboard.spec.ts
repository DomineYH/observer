// 키보드와 화면 읽기 (#42, spec 384–388): the seven 단축키, when they are ignored, and the focus of the 머리띠 메뉴 and 랭킹.
// The exact inputs come from the game's 재생 자료 (every accepted input, aims in 0.1 mil), which the 사후강평 shows once
// the game ends: each test ends it the shortest way, on its own post.
import { expect, test, type Page } from '@playwright/test';
import { fireOnOwnPost, narrowStart, recordedInputs, tab, tabTo, ticks, type Recorded } from './helpers';

/** Lets `n` more ticks pass, so any input sent before has been applied. */
async function ticksPass(page: Page, n = 3) {
  const from = await ticks(page);
  await expect.poll(() => ticks(page)).toBeGreaterThanOrEqual(from + n);
}
/** Focus on the page itself, not on a control. */
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

/** From a fresh page on a fixed seed: occupy the post north of 1번 고지 (찰리호텔 4512 3256) and start. `before` runs in
 * 작전 준비, after the pick. */
async function occupy(page: Page, before?: () => Promise<void>) {
  await page.goto('/?seed=20261106');
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await before?.();
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(() => ticks(page)).toBeGreaterThan(0);
  return { composer: page.getByRole('region', { name: '입력기' }), view: page.getByRole('region', { name: '관측' }) };
}

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const SHORTCUTS = [...ARROWS, 'b', 'r', 'f'];
/** The inputs the 단축키 send. */
const SHORTCUT_INPUTS = new Set(['cam', 'bino', 'lase', 'fire']);
type Window = { what: string; from: number; to: number };

/** Presses each key on its own and notes the ticks its input would carry: from the press until three ticks have passed,
 * less the last, so the next press falls outside. In 작전 준비 the clock stands at 0. */
async function pressEach(page: Page, what: string, keys: string[], windows: Window[], live = true) {
  for (const key of keys) {
    const from = await ticks(page);
    await page.keyboard.press(key);
    if (live) await ticksPass(page);
    else await page.waitForTimeout(150);
    windows.push({ what: `${what} ${key}`, from, to: live ? (await ticks(page)) - 1 : 0 });
  }
}
/** Every 단축키 input the record holds inside one of the windows, named by the key that was pressed. */
const strays = (inputs: Recorded[], windows: Window[]) =>
  windows.flatMap((w) =>
    inputs.filter((i) => SHORTCUT_INPUTS.has(i.a) && i.t >= w.from && i.t <= w.to).map((i) => `${w.what}: ${i.a} ${JSON.stringify(i.v)} at ${i.t}`),
  );
const of = (inputs: Recorded[], a: string) => inputs.filter((i) => i.a === a).map((i) => i.v ?? []);

test('B7: 조합 키에서는 단축키 무시', async ({ page }) => {
  test.setTimeout(300_000);
  await occupy(page);
  await blur(page);
  const windows: Window[] = [];
  const combos = (keys: string[]) => ['Control', 'Alt', 'Meta'].flatMap((m) => keys.map((k) => `${m}+${k}`));
  await pressEach(page, 'idle', combos([...ARROWS, 'Shift+ArrowRight', 'b', 'r']), windows); // Shift is the step multiplier, not a way round
  // F at 지명사's 준비 쏴: each combination on its own, then F alone (the key still acts).
  const debrief = await fireOnOwnPost(page, {
    fire: async () => {
      await blur(page);
      await pressEach(page, 'ready', combos(['f']), windows);
      await page.keyboard.press('f');
    },
  });
  const inputs = await recordedInputs(debrief);
  expect(windows).toHaveLength(21 + 6);
  expect(strays(inputs, windows)).toEqual([]);
  // Ctrl/Alt/Meta + Shift + → each in its own ticks: no 조준 입력, and the aim never moved (no cam at all below).
  const shifted = windows.filter((w) => w.what.endsWith('+Shift+ArrowRight'));
  expect(shifted.map((w) => w.what)).toEqual(['idle Control+Shift+ArrowRight', 'idle Alt+Shift+ArrowRight', 'idle Meta+Shift+ArrowRight']);
  expect(strays(inputs, shifted)).toEqual([]);
  expect(of(inputs, 'cam')).toEqual([]);
  expect(of(inputs, 'bino')).toEqual([]);
  expect(of(inputs, 'lase')).toEqual([]);
  expect(of(inputs, 'fire')).toEqual([[], []]); // the two bare F
});

test('B7: 초점에 따른 무시 조건', async ({ page }) => {
  test.setTimeout(300_000);
  const windows: Window[] = [];
  // 훈련 모드: its 가시권 표시 checkbox is the one field still shown at 준비 쏴.
  const { composer, view } = await occupy(page, async () => {
    await page.getByRole('button', { name: '훈련', exact: true }).click();
    // A text field (호출부호, editable only in 작전 준비).
    await page.getByRole('textbox', { name: '호출부호', exact: true }).focus();
    await pressEach(page, '호출부호', SHORTCUTS, windows, false);
  });
  const bino = view.getByRole('button', { name: '쌍안경' });
  const visibility = page.getByRole('checkbox', { name: /가시권 표시/ });
  const debrief = await fireOnOwnPost(page, {
    at: async (stage) => {
      if (stage === 'report') {
        // A number field (위치 보고 동).
        await composer.getByRole('region', { name: '위치 보고' }).getByRole('textbox', { name: '동', exact: true }).focus();
        await pressEach(page, '위치 보고 동', SHORTCUTS, windows);
        // A focused button keeps the keys: 20 mils right, a lase, the binoculars.
        await bino.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('r');
        await page.keyboard.press('b');
        await expect(bino).toHaveAttribute('aria-pressed', 'true');
      } else if (stage === 'call') {
        await composer.getByRole('combobox', { name: '경고명령' }).focus(); // a select
        await pressEach(page, '경고명령', SHORTCUTS, windows);
      } else {
        const grid = composer.getByRole('radio', { name: '좌표', exact: true });
        await grid.focus(); // a radio button (the arrows move the choice between 좌표 and 극좌표)
        await pressEach(page, '좌표', SHORTCUTS, windows);
        await grid.check();
      }
    },
    fire: async () => {
      await visibility.focus();
      await pressEach(page, '가시권 표시', ['f'], windows);
      await bino.focus(); // F on a focused button goes
      await page.keyboard.press('f');
    },
  });
  const inputs = await recordedInputs(debrief);
  expect(windows).toHaveLength(7 * 4 + 2);
  expect(strays(inputs, windows)).toEqual([]);
  // Only what the focused button let through: from the opening 20.4 · −22 mils, 20 mils right.
  expect(of(inputs, 'cam')).toEqual([[404, -220]]);
  expect(of(inputs, 'lase')).toEqual([[404, -220]]);
  expect(of(inputs, 'bino')).toEqual([[1]]);
  expect(of(inputs, 'fire')).toEqual([[], []]);
});

test('B7: 단축키는 단추와 같은 입력', async ({ page, context }) => {
  test.setTimeout(300_000);
  // Two runs on the same seed and post, side by side: one plays with the keys, the other with the buttons.
  const other = await context.newPage();
  const [k, b] = await Promise.all([occupy(page), occupy(other)]);
  const pad = (name: string) => b.view.getByRole('group', { name: '1밀 조준' }).getByRole('button', { name });
  /** `key` then R on one page; `n` presses of the 1밀 `button` (Enter: one step each) then 레이저 on the other. */
  const same = async (key: string, button: string, n: number) => {
    await blur(page);
    await page.keyboard.press(key);
    await page.keyboard.press('r');
    await pad(button).focus();
    for (let i = 0; i < n; i++) await other.keyboard.press('Enter');
    await b.view.getByRole('button', { name: '레이저' }).click();
  };
  const binoBoth = async (on: boolean) => {
    await blur(page);
    await page.keyboard.press('b');
    await b.view.getByRole('button', { name: '쌍안경' }).click();
    for (const v of [k.view, b.view]) await expect(v.getByRole('button', { name: '쌍안경' })).toHaveAttribute('aria-pressed', String(on));
  };
  // 육안 20/5 밀, 쌍안경 2/1 밀; Shift ×10 방위, ×5 고각 — as that many 1밀 presses.
  await same('ArrowRight', '오른쪽 1밀', 20);
  await same('Shift+ArrowLeft', '왼쪽 1밀', 200);
  await same('ArrowUp', '위 1밀', 5);
  await same('Shift+ArrowDown', '아래 1밀', 25);
  await binoBoth(true);
  await same('ArrowRight', '오른쪽 1밀', 2);
  await same('Shift+ArrowRight', '오른쪽 1밀', 20);
  await same('ArrowUp', '위 1밀', 1);
  await same('Shift+ArrowDown', '아래 1밀', 5);
  await binoBoth(false);
  const [keyRun, buttonRun] = await Promise.all([
    fireOnOwnPost(page, {
      fire: async () => {
        await blur(page);
        await page.keyboard.press('f');
      },
    }),
    fireOnOwnPost(other, { fire: () => b.composer.getByRole('button', { name: '준비 쏴' }).click() }),
  ]);
  const [keys, buttons] = await Promise.all([recordedInputs(keyRun), recordedInputs(buttonRun)]);

  // From the opening 20.4 · −22 mils, one 조준 입력 a key, in 0.1 mil.
  const aims = [
    [404, -220],
    [62404, -220],
    [62404, -170],
    [62404, -420],
    [62424, -420],
    [62624, -420],
    [62624, -410],
    [62624, -460],
  ];
  expect(of(keys, 'cam')).toEqual(aims);
  // The buttons' 조준 입력, 1 mil each, reach the same aims at the end of each run of presses.
  const pressed = of(buttons, 'cam');
  expect(pressed).toHaveLength(278);
  expect([20, 220, 225, 250, 252, 272, 273, 278].map((n) => pressed[n - 1])).toEqual(aims);
  // R and 레이저, B and 쌍안경, F and 준비 쏴: the same inputs with the same values.
  expect(of(keys, 'lase')).toEqual(aims);
  expect(of(buttons, 'lase')).toEqual(aims);
  expect(of(keys, 'bino')).toEqual([[1], [0]]);
  expect(of(buttons, 'bino')).toEqual([[1], [0]]);
  expect(of(keys, 'fire')).toEqual([[], []]);
  expect(of(buttons, 'fire')).toEqual([[], []]);
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
    // Not a trap: Tab leaves the sheet for the lower panel while the game keeps running, and Esc still closes it.
    const inMenu = () => menu.evaluate((m) => m.contains(document.activeElement));
    const prep = page.getByRole('region', { name: '작전 준비', includeHidden: true });
    const inPrep = () => prep.evaluate((m) => m.contains(document.activeElement));
    for (let i = 0; i < 60 && !(await inPrep()); i++) await page.keyboard.press('Tab');
    expect(await inPrep()).toBe(true);
    expect(await inMenu()).toBe(false);
    await expect(menu).toBeVisible();
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
    await expect(page.getByRole('region', { name: '관측' }).getByRole('group', { name: '레이저 측정' }).locator('p')).toContainText('레이저: 방위각 0040 밀');
  });
});
