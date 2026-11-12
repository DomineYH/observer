import { expect, test } from '@playwright/test';
import { goldenFiles, readGolden } from '../golden/golden';

// 결정성 관문: the page replays every golden record in this browser; the result must match the file exactly.
// ③ and ④ run 48 000 ticks with a state hash each: minutes, not seconds, in the slower engines.
const LONG = { test: 240_000, page: 200_000 };
for (const [file, name, long] of [
  ['0-empty.json', '골든: 0번 빈 판 (실행 환경)', false],
  ['1-grid-eom.json', '골든: ① 좌표법 조정에서 임무끝까지 (실행 환경)', false],
  ['2-polar-move.json', '골든: ② 극좌표·레이저·전이·위험근접·이동 (실행 환경)', false],
  ['3-time-limit.json', '골든: ③ 사격 없이 시간 한도까지 (실행 환경)', true],
  ['4-desktop-play.json', '골든: ④ 데스크톱 한 판 (실행 환경)', true],
  ['5-real-laser-move.json', '골든: ⑤ 실제 지형의 레이저·효력사·이동 (실행 환경)', false],
] as const) {
  test(name, async ({ page }) => {
    if (long) test.setTimeout(LONG.test);
    await page.goto(`/?golden=${file}`);
    await expect(page.locator('#result, #error')).toBeAttached(long ? { timeout: LONG.page } : {});
    await expect(page.locator('#error')).toHaveCount(0);
    const results = JSON.parse((await page.locator('#result').textContent()) ?? '{}');
    expect(goldenFiles()).toContain(file);
    const { checkpoints, chain, record, ignored, terrainHash, replay } = readGolden(file);
    expect(results[file], file).toEqual({ checkpoints, chain, record, ignored });
    // A golden on a real land: the page fetched and unpacked it with the app's own 지형 원천; its hash is the header's.
    if (replay.terrain) expect(JSON.parse((await page.locator('#terrain').textContent()) ?? '{}')[file], file).toBe(terrainHash);
  });
}

// Every golden file has its test above.
test('골든: 모든 골든 기록이 실행 환경 검사에 걸린다', () => {
  expect(goldenFiles()).toEqual(['0-empty.json', '1-grid-eom.json', '2-polar-move.json', '3-time-limit.json', '4-desktop-play.json', '5-real-laser-move.json']);
});

// The page generates each mock golden record's terrain in this browser; its hash must equal the golden header. The seed
// picks the mock land only: ⑤'s real land is checked on its own page above.
test('F-15: 지형 해시는 시드로 정해진다 (실행 환경)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#result, #error')).toBeAttached();
  await expect(page.locator('#error')).toHaveCount(0);
  const hashes = JSON.parse((await page.locator('#terrain').textContent()) ?? '{}');
  for (const file of goldenFiles().filter((f) => !readGolden(f).replay.terrain)) expect(hashes[file], file).toBe(readGolden(file).terrainHash);
});
