import { expect, test } from '@playwright/test';

test('스모크: 페이지가 뜨고 틱 수가 흐른다', async ({ page }) => {
  await page.goto('/');
  const tick = page.getByRole('status', { name: '틱' });
  await expect(tick).toBeVisible();
  const first = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(first);
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
});
