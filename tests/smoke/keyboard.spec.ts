// 키보드와 화면 읽기 (#42, spec 384–388): the seven 단축키, when they are ignored, and the focus of the 머리띠 메뉴 and 랭킹.
import { expect, test, type Page } from '@playwright/test';
import { toReady } from './helpers';

const ticks = async (page: Page) => Number(await page.getByRole('status', { name: '틱' }).textContent());
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
