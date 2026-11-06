import { expect, test } from '@playwright/test';

test('스모크: 페이지가 뜨고 틱 수가 흐른다', async ({ page }) => {
  await page.goto('/');
  const tick = page.getByRole('status', { name: '틱' });
  await expect(tick).toBeVisible();
  const first = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(first);
  // 무전 기록 패널에 예시 문장이 보이고, 훈련 모드의 숫자 병기는 흐리다.
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('방향 넷칠둘공(4720), 우로 여섯십(60), 줄이기 둘백(200), 효력사, 이상.');
  const gloss = log.getByText('(4720)');
  const word = log.getByText('넷칠둘공', { exact: true });
  const opacity = async (l: typeof gloss) => Number(await l.evaluate((e) => getComputedStyle(e).opacity));
  expect(await opacity(gloss)).toBeLessThan(await opacity(word));
});
