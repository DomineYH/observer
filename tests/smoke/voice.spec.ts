import { expect, test } from '@playwright/test';
import { skipReport } from './helpers';

// 음성 스모크 (M4-6): the built mock app's 가짜 인식기 hears the address's ?heard=. No microphone, no 음성 모델.
test('스모크: 음성 — 말로 호출한다', async ({ page }) => {
  const said = '기러기, 여기는 갈매기, 효력사, 이상';
  await page.goto(`/?seed=20261106&heard=${encodeURIComponent(said)}`);
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('감명 양호', { timeout: 15_000 });

  const composer = page.getByRole('region', { name: '입력기' });
  await skipReport(composer); // the post is not the planned one: the 위치 보고 comes before a call

  // Off: no button, and V and Enter do nothing.
  const talk = composer.getByRole('button', { name: '눌러서 말하기' });
  await expect(talk).toHaveCount(0);
  await page.keyboard.press('v');
  await page.keyboard.press('Enter');
  await expect(log).not.toContainText('효력사');

  // On: held, it listens; let go, the 호출 form holds what was heard, and nothing is sent yet.
  await page.getByRole('button', { name: '음성 입력' }).click();
  await expect(talk).toBeEnabled();
  const line = composer.getByRole('status', { name: '들린 글' });
  await page.keyboard.down('v');
  await expect(line).toHaveText('듣는 중');
  await page.keyboard.up('v');
  await expect(line).toHaveText(`들린 글: ${said}`);
  await expect(composer.getByRole('combobox', { name: '경고명령' })).toHaveValue('ffe');
  await expect(composer.getByRole('status', { name: '보낼 문장' })).toHaveText('기러기, 여기는 갈매기, 효력사, 이상.');
  await expect(log).not.toContainText('효력사');

  // Enter sends it, as the form's 송신 would.
  await page.keyboard.press('Enter');
  await expect(log).toContainText('갈매기 기러기, 여기는 갈매기, 효력사, 이상.');
});
