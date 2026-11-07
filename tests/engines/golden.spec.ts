import { expect, test } from '@playwright/test';
import { goldenFiles, readGolden } from '../golden/golden';

// 결정성 관문: the page replays every golden record in this browser; the result must match the file exactly.
test('골든: 0번 빈 판 (실행 환경)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#result, #error')).toBeAttached();
  await expect(page.locator('#error')).toHaveCount(0);
  const results = JSON.parse(await page.locator('#result').textContent() ?? '{}');
  const files = goldenFiles();
  expect(files).toContain('0-empty.json');
  for (const file of files) {
    const { checkpoints, chain, record, ignored } = readGolden(file);
    expect(results[file], file).toEqual({ checkpoints, chain, record, ignored });
  }
});

// The page generates each golden record's terrain in this browser; its hash must equal the golden header.
test('F-15: 지형 해시는 시드로 정해진다 (실행 환경)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#result, #error')).toBeAttached();
  await expect(page.locator('#error')).toHaveCount(0);
  const hashes = JSON.parse((await page.locator('#terrain').textContent()) ?? '{}');
  for (const file of goldenFiles()) expect(hashes[file], file).toBe(readGolden(file).terrainHash);
});
