import { expect, test, type Locator, type Page } from '@playwright/test';

test('스모크: 관측소를 고르고 작전을 개시하면 틱 수가 흐른다', async ({ page }) => {
  // A fixed 연습 seed: the daily seed changes the terrain at KST midnight.
  await page.goto('/?seed=20261106');
  const tick = page.getByRole('status', { name: '틱' });
  await expect(tick).toBeVisible();
  // 작전 준비: the clock stands still.
  await expect(tick).toHaveText('0');
  await page.waitForTimeout(500);
  await expect(tick).toHaveText('0');
  // 무전 기록 is empty until the operation starts.
  await expect(page.getByRole('region', { name: '무전 기록' })).toHaveText('');

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
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(prep).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await expect(tick).toHaveText('0');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  const first = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(first);
  // Not the planned post: 위치 보고 is required.
  await expect(prep).toContainText('작전 개시 — 찰리호텔 4512 3256 점령. 계획과 다른 위치이므로 기러기에게 위치를 보고하십시오.');

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
});

test('스모크: 보이는 적을 누르면 표적 탭에 표적이 생긴다', async ({ page }) => {
  await page.goto('/?seed=20261106');
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
});

/** From a fresh page on a fixed seed: occupy the post, then 조정 · 찰리호텔 4720 3150 · 미상 표적 포대 삼발 with `control`,
 * until 기러기's 포대 사격준비 끝. */
async function toReady(page: Page, control: 'ready' | 'amc') {
  await page.goto('/?seed=20261106');
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();

  // 통신 점검: 기러기 asks 4 s in and 감명 양호 goes out by itself.
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('작전 개시.');
  await expect(log).toContainText('갈매기, 여기는 기러기, 감명 보고, 이상.');
  await expect(log).toContainText('기러기, 여기는 갈매기, 감명 양호, 이상.');

  const composer = page.getByRole('region', { name: '입력기' });
  const preview = composer.getByLabel('보낼 문장');
  const send = composer.getByRole('button', { name: '송신' });
  await expect(preview).toHaveText('기러기, 여기는 갈매기, 조정, 이상.');
  await send.click();
  await expect(log).toContainText('좌표 송신바람');
  await composer.getByLabel('동', { exact: true }).fill('4720');
  await composer.getByLabel('북', { exact: true }).fill('3150');
  await expect(preview).toContainText('찰리호텔 넷칠둘공 삼하나오공');
  await send.click();
  await expect(composer.getByLabel('표적성질')).toHaveValue('{"targetType":"unknown"}');
  await composer.getByLabel('통제').selectOption(control);
  await expect(preview).toHaveText(control === 'amc' ? '미상 표적, 포대 삼발, 지명사, 이상.' : '미상 표적, 포대 삼발, 이상.');
  await send.click();
  await expect(log).toContainText('표적번호 알파브라보 하나공공하나', { timeout: 20_000 }); // 9–12 s
  await expect(log).toContainText('포대 사격준비 끝.', { timeout: 60_000 });
  return { log, composer, preview, send };
}

/** The log's lines from the first one containing `from`, without their time. */
const linesFrom = async (log: Locator, from: string) => {
  const all = (await log.locator('li').allTextContents()).map((t) => t.replace(/^\d\d:\d\d /, ''));
  return all.slice(all.findIndex((t) => t.includes(from)));
};

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

test('스모크: 통신 점검 뒤 사격요구 세 송신에 사격준비 끝이 오고, 수정탄을 보고 수정을 한 번 보낸다', async ({ page }) => {
  // 기러기 answers 사격준비 끝 24–38 s after the third transmission; the round then flies about 20 s.
  test.setTimeout(150_000);
  const { log, composer, preview, send } = await toReady(page, 'ready');

  // 준비되는 대로: the adjusting round goes by itself. Once it lands the correction form opens (standard mode: 방향 empty).
  await expect(log).toContainText('하나발 떳다', { timeout: 10_000 });
  const direction = composer.getByLabel('방향');
  await expect(direction).toBeVisible({ timeout: 40_000 });
  await expect(direction).toHaveValue('');
  await expect(send).toBeDisabled();
  await direction.fill('0800');
  await composer.getByLabel('좌우', { exact: true }).selectOption('right');
  await composer.getByLabel('좌우 거리').fill('50');
  await expect(preview).toHaveText('방향 공팔공공, 우로 오십, 이상.');
  await send.click();
  await expect(log).toContainText('방향 공팔공공, 우로 오십, 이상.');
  await expect(log).toContainText('방향 공팔공공, 우로 오십, 잠깐대기.', { timeout: 10_000 }); // 기러기's readback, 2.5–4 s
});

test('스모크: 수정에 효력사를 붙여 효력사를 걸면 마감탄 떳다가 온다', async ({ page }) => {
  // 사격준비 끝 24–38 s, the adjusting round about 20 s, 신관 사격준비 끝 14–22 s after the correction, 마감탄 떳다 ~25 s later.
  test.setTimeout(180_000);
  const { log, composer, preview, send } = await toReady(page, 'ready');
  const direction = composer.getByLabel('방향');
  await expect(direction).toBeVisible({ timeout: 50_000 });
  await direction.fill('0800');
  await composer.getByLabel('다음').selectOption('ffe');
  await expect(preview).toHaveText('방향 공팔공공, 동제원, 효력사, 이상.');
  await send.click();
  await expect(log).toContainText('방향 공팔공공, 동제원, 효력사, 잠깐대기.', { timeout: 10_000 });
  await expect(log).toContainText('순발신관 사격준비 끝.', { timeout: 30_000 });
  await expect(log).toContainText('기러기 마감탄 떳다, 이상.', { timeout: 40_000 });
  await expect(log).toContainText('갈매기 마감탄 떳다, 잠깐대기.', { timeout: 5_000 });
  await expect(composer).toContainText('효과를 관측하십시오.', { timeout: 40_000 });
});
