import { expect, test } from '@playwright/test';

// 기러기's numbers as the log reads them (발수 one digit).
const DIGITS: Record<string, number> = { 하나: 1, 둘: 2, 삼: 3, 넷: 4, 오: 5, 여섯: 6, 칠: 7, 팔: 8, 아홉: 9 };

test('스모크: 실전 — 실전으로 개시하고 복창 한 번 뒤 시간이 흐른다', async ({ page }) => {
  test.setTimeout(90_000); // 통신 점검 and three transmissions with 기러기's answers, about 30 s of game time
  await page.goto('/?seed=20261106');
  await expect(page.getByRole('banner')).toBeVisible();
  // 작전 준비: 실전 is chosen on the 판 정보 카드, and the 머리띠 shows it.
  await page.getByRole('radiogroup', { name: '모드' }).getByRole('radio', { name: '실전' }).check();
  await expect(page.getByRole('status', { name: '모드' })).toHaveText('실전');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click(); // no pick: the planned post
  const tick = page.getByRole('status', { name: '틱' });
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '일시정지' })).toBeDisabled(); // 실전 has no pause

  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('감명 양호', { timeout: 15_000 });
  const composer = page.getByRole('region', { name: '입력기' });
  const send = composer.getByRole('button', { name: '송신' });
  await send.click(); // 조정
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await composer.getByRole('textbox', { name: '동', exact: true }).fill('4720');
  await composer.getByRole('textbox', { name: '북', exact: true }).fill('3150');
  await send.click();
  await expect(composer.getByRole('combobox', { name: '표적성질' })).toBeVisible();
  await send.click(); // 미상 표적, 포대 삼발
  // 사격지휘통보: shown for 4 s, then covered; read it as it comes.
  const mto = log.getByText(/사격지휘통보, 포대, .*표적번호 알파브라보 하나공공하나/);
  await expect(mto).toBeVisible({ timeout: 20_000 });
  const said = (await mto.textContent())!;
  const rounds = DIGITS[said.match(/, (\S+)발,/)![1]!]!;

  // 복창 한 번: the box asks the 사격지휘통보; it goes out as put in and is taken.
  const box = page.getByRole('region', { name: '복창' });
  await expect(box).toContainText('복창: 사격지휘통보');
  await box.getByRole('group', { name: '신관' }).getByRole('button', { name: said.includes('접근신관') ? '접근신관' : '순발신관' }).click();
  await box.getByRole('textbox', { name: '발수' }).fill(String(rounds));
  await box.getByRole('textbox', { name: '표적번호' }).fill('1001');
  await box.getByRole('button', { name: '복창 송신' }).click();
  await expect(log.locator('li').filter({ hasText: '사격지휘통보, 포대' })).toHaveCount(2); // 기러기's, back in view, and ours
  await expect(page.getByText('복창: 사격지휘통보')).toHaveCount(0); // taken and right: no 정정 owed
  const after = Number(await tick.textContent());
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(after + 20); // time flows on
  await expect(log).not.toContainText('정정');
});
