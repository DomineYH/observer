import { expect, test } from '@playwright/test';
import { goldenFiles, readGolden } from '../golden/golden';

// 결정성 관문: the page replays every golden record in this browser; the result must match the file exactly.
// ③ runs 48 000 ticks with a state hash each: minutes, not seconds, in the slower engines.
const LONG = { test: 240_000, page: 200_000 };
for (const [file, name, long] of [
  ['0-empty.json', '골든: 0번 빈 판 (실행 환경)', false],
  ['1-grid-eom.json', '골든: ① 좌표법 조정에서 임무끝까지 (실행 환경)', false],
  ['2-polar-move.json', '골든: ② 극좌표·레이저·전이·위험근접·이동 (실행 환경)', false],
  ['3-time-limit.json', '골든: ③ 사격 없이 시간 한도까지 (실행 환경)', true],
] as const) {
  test(name, async ({ page }) => {
    if (long) test.setTimeout(LONG.test);
    await page.goto(`/?golden=${file}`);
    await expect(page.locator('#result, #error')).toBeAttached(long ? { timeout: LONG.page } : {});
    await expect(page.locator('#error')).toHaveCount(0);
    const results = JSON.parse((await page.locator('#result').textContent()) ?? '{}');
    expect(goldenFiles()).toContain(file);
    const { checkpoints, chain, record, ignored } = readGolden(file);
    expect(results[file], file).toEqual({ checkpoints, chain, record, ignored });
  });
}

// Every golden file has its test above.
test('골든: 모든 골든 기록이 실행 환경 검사에 걸린다', () => {
  expect(goldenFiles()).toEqual(['0-empty.json', '1-grid-eom.json', '2-polar-move.json', '3-time-limit.json']);
});

// The page generates each golden record's terrain in this browser; its hash must equal the golden header.
test('F-15: 지형 해시는 시드로 정해진다 (실행 환경)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#result, #error')).toBeAttached();
  await expect(page.locator('#error')).toHaveCount(0);
  const hashes = JSON.parse((await page.locator('#terrain').textContent()) ?? '{}');
  for (const file of goldenFiles()) expect(hashes[file], file).toBe(readGolden(file).terrainHash);
});
