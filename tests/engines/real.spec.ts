import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const EXPECTED = JSON.parse(readFileSync('src/adapters/realTerrain/mungyeong/expected.json', 'utf8'));

// The page loads the 문경 지형 through the app's own loadTerrain (fetch, 풀기, 지형 해시 and boot screen) in this browser.
test('실제 지형 원천: 받아 푼 해시 (실행 환경)', async ({ page }) => {
  // The terrain fetch only: in the dev server the `?url` module request has the same path and must pass.
  const terrainFetch = (r: { url(): string; resourceType(): string }) => r.url().includes('terrain.bin') && r.resourceType() === 'fetch';
  let blocked = 0;
  await page.route(
    (url) => url.pathname.includes('terrain.bin'),
    (route) => (terrainFetch(route.request()) ? (blocked++, route.abort()) : route.continue()),
  );
  await page.goto('/real.html');
  await expect(page.getByRole('alert')).toHaveText(/지형 자료를 받지 못했습니다\. 연결을 확인하고 다시 시도하십시오\./);
  await expect(page.locator('#terrain')).toHaveCount(0);
  expect(blocked).toBe(1);

  await page.unrouteAll();
  await page.getByRole('button', { name: '다시 시도' }).click(); // reloads the page
  await expect(page.locator('#terrain')).toBeAttached({ timeout: 60_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(JSON.parse((await page.locator('#terrain').textContent()) ?? '{}')).toEqual(EXPECTED);
});
