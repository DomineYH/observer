import { expect, test } from '@playwright/test';

test('F-08: 호출부호 반영', async ({ page }) => {
  await page.goto('/?seed=20261106');
  const field = page.getByLabel('호출부호', { exact: true });
  const set = page.getByRole('button', { name: '정하기' });
  const current = page.getByLabel('현재 호출부호');
  await expect(current).toHaveText('갈매기'); // the placeholder until one is set
  // Refused with its reason; the callsign stays.
  await field.fill('기러기');
  await set.click();
  await expect(page.getByRole('alert')).toHaveText('“기러기”은(는) 예약된 호출부호입니다.');
  await field.fill('참새 12');
  await set.click();
  await expect(page.getByRole('alert')).toHaveText('한글·영문·숫자 2–8자로 정하십시오 (공백·기호 불가).');
  await field.fill('참매');
  await set.click();
  await expect(page.getByRole('alert')).toHaveText('“참매”은(는) 이미 다른 관측장교가 쓰고 있습니다.');
  await expect(current).toHaveText('갈매기');
  await field.fill('참새12');
  await set.click();
  await expect(current).toHaveText('참새12');
  await expect(page.getByRole('alert')).toHaveCount(0);

  // The radio speaks with it, both ways, and so does the composer's preview.
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect(field).toBeDisabled(); // fixed once the operation starts
  const log = page.getByRole('region', { name: '무전 기록' });
  await expect(log).toContainText('참새12, 여기는 기러기, 감명 보고, 이상.', { timeout: 15_000 }); // 4 s in
  await expect(log).toContainText('기러기, 여기는 참새12, 감명 양호, 이상.', { timeout: 15_000 }); // 5.5 s in
  await expect(log).not.toContainText('갈매기');
  const composer = page.getByRole('region', { name: '입력기' });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click();
  await expect(composer.getByLabel('보낼 문장')).toHaveText('기러기, 여기는 참새12, 조정, 이상.');

  // The same browser is not asked again.
  await page.reload();
  await expect(page.getByLabel('현재 호출부호')).toHaveText('참새12');
  await expect(page.getByLabel('호출부호', { exact: true })).toHaveValue('참새12');
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장된 문자열은 글자로 보인다', async ({ page }) => {
  // Storage edited by hand: a ranked run under a callsign with markup, which the rules never let through.
  await page.addInitScript(() => {
    const record = { score: 5000, cleared: true, clearTick: 20000, roundsTotal: 30, firstErrorAvg: 20, reportAccuracyPct: 100, missions: 2,
      mode: 'standard', seedKind: 'daily', observerLost: false };
    const run = { callsign: '<b>x</b>', record, missions: [], replay: {}, createdAt: '2026-11-01T09:00:00.000Z', ranked: true };
    localStorage.setItem('observer.runs', JSON.stringify([run]));
  });
  await page.goto('/?seed=20261106');
  await page.getByRole('button', { name: '랭킹' }).click();
  const dialog = page.getByRole('dialog', { name: '랭킹' });
  await expect(dialog).toBeVisible();
  const rows = dialog.getByRole('row');
  await expect(rows.filter({ hasText: '<b>x</b>' })).toHaveCount(2); // on the board and in 내 기록, as characters
  await expect(rows.filter({ hasText: '<b>x</b>' }).first()).toContainText('1<b>x</b>5000점');
  await expect(dialog.locator('b')).toHaveCount(0);
});
