import { expect, test } from '@playwright/test';
import { BITS, FNS } from '../math/bits';

// The page evaluates the bit output table with 결정적 수학 in this browser; every output must match bit for bit.
test('결정적 수학: 비트 출력 표 (실행 환경)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#result, #error')).toBeAttached();
  await expect(page.locator('#error')).toHaveCount(0);
  const outputs = JSON.parse((await page.locator('#math').textContent()) ?? '{}');
  for (const fn of FNS) expect(outputs[fn], fn).toEqual(BITS[fn].map(([, out]) => out));
});
