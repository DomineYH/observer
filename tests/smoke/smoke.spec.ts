import { expect, test } from '@playwright/test';

test('스모크: 관측소를 고르고 작전을 개시하면 틱 수가 흐른다', async ({ page }) => {
  await page.goto('/');
  const tick = page.getByRole('status', { name: '틱' });
  await expect(tick).toBeVisible();
  // 작전 준비: the clock stands still.
  await expect(tick).toHaveText('0');
  await page.waitForTimeout(500);
  await expect(tick).toHaveText('0');
  // 무전 기록 패널에 예시 문장이 보인다.
  await expect(page.getByRole('region', { name: '무전 기록' })).toContainText(
    '방향 넷칠둘공, 우로 여섯십, 줄이기 둘백, 효력사, 이상.',
  );

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

  // 관측소 후보: pressing the map's centre picks it, then 작전 개시 starts the clock.
  const prep = page.getByRole('region', { name: '작전 준비' });
  await expect(prep).toContainText('일일 ');
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(prep).toContainText('관측소 후보: 찰리호텔 4512 3512');
  await expect(tick).toHaveText('0');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  const first = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(first);
  // Not the planned post: 위치 보고 is required.
  await expect(prep).toContainText('작전 개시 — 찰리호텔 4512 3512 점령. 계획과 다른 위치이므로 기러기에게 위치를 보고하십시오.');

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
  await expect.poll(async () => new Set((await pixels()).split(';')).size).toBeGreaterThan(4); // terrain is drawn
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
