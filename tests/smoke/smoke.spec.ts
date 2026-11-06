import { expect, test } from '@playwright/test';

test('스모크: 페이지가 뜨고 틱 수가 흐른다', async ({ page }) => {
  await page.goto('/');
  const tick = page.getByRole('status', { name: '틱' });
  await expect(tick).toBeVisible();
  const first = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(first);
});
