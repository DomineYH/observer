// The real build (VITE_OBSERVER_BACKEND=real, its own preview port): the 받는 중 line, then 작전 준비 on the 문경 지형.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

/** The committed 지형 파일's credit lines, read from its JSON header. */
function credits(): string[] {
  const body = gunzipSync(readFileSync('src/adapters/realTerrain/mungyeong/terrain.bin'));
  return JSON.parse(body.subarray(4, 4 + body.readUInt32LE(0)).toString('utf8')).credits;
}

test('스모크: real 빌드', async ({ page }) => {
  test.setTimeout(60_000);
  // Hold the terrain file until the 받는 중 line has been seen.
  let requests = 0;
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/assets/terrain-*.bin', async (route) => {
    requests++;
    await held;
    await route.continue();
  });
  await page.goto('/?seed=20261106');
  const loading = page.getByText('지형 자료를 받는 중…');
  await expect(loading).toBeVisible();
  release();

  // 작전 준비 on the 문경 배치: its reserve posts, and the terrain's credit lines at the bottom.
  const prep = page.getByRole('region', { name: '작전 준비' });
  await expect(prep).toContainText('예비 관측소 예비 1');
  const lines = credits();
  expect(lines).toHaveLength(3);
  for (const line of lines) await expect(prep.getByText(line, { exact: true })).toBeVisible();
  const planned = (await prep.textContent())!.match(/계획된 관측소 1번 고지 (\S+ \d{4} \d{4})/)![1]!;

  // No pick: 작전 개시 occupies the 계획 관측소, and the clock runs.
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect(prep).toHaveText(`작전 개시 — ${planned} 점령.`);
  const tick = page.getByRole('status', { name: '틱' });
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  await expect(loading).toHaveCount(0);
  expect(requests).toBe(1);
});
