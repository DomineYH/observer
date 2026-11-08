// Steps several smoke specs share.
import { expect, type Locator, type Page } from '@playwright/test';

/** From a fresh page on a fixed seed: occupy the post, then `warning` (조정 unless asked) · 찰리호텔 4720 3150 · 미상 표적
 * 포대 삼발 with `control`, until 기러기's 사격준비 끝. */
export async function toReady(page: Page, control: 'ready' | 'amc', warning: 'adjust' | 'ffe' = 'adjust') {
  await page.goto('/?seed=20261106');
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();

  // 통신 점검: 기러기 asks 4 s in and 감명 양호 goes out by itself.
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('작전 개시.');
  await expect(log).toContainText('갈매기, 여기는 기러기, 감명 보고, 이상.', { timeout: 15_000 }); // 4 s in: margin for dropped frame time
  await expect(log).toContainText('기러기, 여기는 갈매기, 감명 양호, 이상.', { timeout: 15_000 }); // 5.5 s in

  const composer = page.getByRole('region', { name: '입력기' });
  // Not the planned post: the 위치 보고 comes first and no call can go; going on without it keeps the planned post for
  // 극좌표 (F-21).
  await expect(composer.getByLabel('경고명령')).toHaveCount(0);
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click();
  await expect(log).toContainText('위치 보고 생략');
  const preview = composer.getByLabel('보낼 문장');
  const send = composer.getByRole('button', { name: '송신' });
  await expect(preview).toHaveText('기러기, 여기는 갈매기, 조정, 이상.');
  if (warning === 'ffe') {
    await composer.getByLabel('경고명령').selectOption('ffe');
    await expect(preview).toHaveText('기러기, 여기는 갈매기, 효력사, 이상.');
  }
  await send.click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 }); // 2.5–4 s after the call
  await composer.getByLabel('동', { exact: true }).fill('4720');
  await composer.getByLabel('북', { exact: true }).fill('3150');
  await expect(preview).toContainText('찰리호텔 넷칠둘공 삼하나오공');
  await send.click();
  await expect(composer.getByLabel('표적성질')).toHaveValue('{"targetType":"unknown"}');
  await composer.getByLabel('통제').selectOption(control);
  await expect(preview).toHaveText(control === 'amc' ? '미상 표적, 포대 삼발, 지명사, 이상.' : '미상 표적, 포대 삼발, 이상.');
  await send.click();
  await expect(log).toContainText('표적번호 알파브라보 하나공공하나', { timeout: 20_000 }); // 9–12 s
  await expect(log).toContainText(warning === 'ffe' ? '신관 사격준비 끝.' : '포대 사격준비 끝.', { timeout: 60_000 });
  return { log, composer, preview, send };
}

/** The log's lines from the first one containing `from`, without their time. */
export const linesFrom = async (log: Locator, from: string) => {
  const all = (await log.locator('li').allTextContents()).map((t) => t.replace(/^\d\d:\d\d /, ''));
  return all.slice(all.findIndex((t) => t.includes(from)));
};

/** The map's pixels on a 16 px grid, less the bottom-right corner where the wind arrow follows the weather. */
export const mapPixels = (map: Locator) =>
  map.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    const out: string[] = [];
    for (let y = 8; y < c.height; y += 16)
      for (let x = 8; x < c.width; x += 16) if (x < c.width * 0.82 || y < c.height * 0.82) out.push(ctx.getImageData(x, y, 1, 1).data.join());
    return out.join(';');
  });

/** The map's pixels once it has settled: the map redraws every 120 ms, so a pick shows up a frame or two after its text. */
export async function settledMap(page: Page, map: Locator): Promise<string> {
  let last = await mapPixels(map);
  for (;;) {
    await page.waitForTimeout(300);
    const now = await mapPixels(map);
    if (now === last) return now;
    last = now;
  }
}

/** 배속 is one button cycling ×1 → ×2 → ×4 → ×8 → ×1: press it until it reads ×`n`. */
export async function speedTo(page: Page, n: 1 | 2 | 4 | 8) {
  const speed = page.getByRole('button', { name: /^배속 ×/ });
  for (let i = 0; i < 4 && (await speed.getAttribute('aria-label')) !== `배속 ×${n}`; i++) await speed.click();
  await expect(speed).toHaveAccessibleName(`배속 ×${n}`);
}

/** The shortest end the app allows, from a started game at 찰리호텔 4512 3256 just after 작전 개시: 효력사 on our own post.
 * 기러기 applies 위험근접 and adjusts first; one correction with 효력사 brings the volley onto the post and our rounds take
 * out the 관측반 (about 2 min of game time). Returns the 사후강평. */
export async function fireOnOwnPost(page: Page) {
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('감명 양호', { timeout: 15_000 });
  const composer = page.getByRole('region', { name: '입력기' });
  const send = composer.getByRole('button', { name: '송신' });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click();
  await composer.getByLabel('경고명령').selectOption('ffe');
  await send.click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await composer.getByLabel('동', { exact: true }).fill('4512');
  await composer.getByLabel('북', { exact: true }).fill('3256');
  await send.click();
  await expect(composer.getByLabel('표적성질')).toBeVisible({ timeout: 15_000 });
  await send.click();
  const direction = composer.getByLabel('방향');
  await expect(direction).toBeVisible({ timeout: 120_000 }); // the adjusting round has landed, 73 m off
  await direction.fill('1600');
  await composer.getByLabel('좌우', { exact: true }).selectOption('right');
  await composer.getByLabel('좌우 거리').fill('40');
  await composer.getByLabel('사거리', { exact: true }).selectOption('add');
  await composer.getByLabel('사거리 거리').fill('60');
  await composer.getByLabel('다음').selectOption('ffe');
  await send.click();

  const debrief = page.getByRole('region', { name: '사후강평' });
  await expect(debrief).toBeVisible({ timeout: 150_000 });
  await expect(debrief).toContainText('관측반 전투 불능으로 임무 종료.');
  return debrief;
}

/** A 아래 탭 by its name. */
export const tab = (page: Page, name: string) => page.getByRole('group', { name: '아래 탭' }).getByRole('button', { name, exact: true });
/** A panel by role and name, found also while its tab is not chosen. */
export const region = (page: Page, name: string) => page.getByRole('region', { name, includeHidden: true });
export const ticks = async (page: Page) => Number(await page.getByRole('status', { name: '틱' }).textContent());

/** On the narrow page: pick the open field north of 1번 고지 on the 지도 tab, start on the 입력 tab, wait for the clock. */
export async function narrowStart(page: Page) {
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

/** Presses Tab until `target` has the focus, so it is in the tab order; fails after 80 presses. */
export async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 80 && !(await target.evaluate((e) => e === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}
