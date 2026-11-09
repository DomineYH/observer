import { expect, test, type Page } from '@playwright/test';

/** What the page asked the browser's speech synthesis to do. The browser API is stubbed, not the app. */
type Heard = { spoken: { text: string; lang: string }[]; cancels: number };
const heard = (page: Page) => page.evaluate(() => (window as unknown as { heard: Heard }).heard);

/** On the practice seed's prep screen, picks the open field north of 1번 고지 and starts; waits for 감명 양호. */
async function start(page: Page) {
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect(page.getByRole('region', { name: '무전 기록' })).toContainText('감명 양호', { timeout: 15_000 });
}

test('F-28: 음성 켬과 끔', async ({ page }) => {
  await page.addInitScript(() => {
    const heard: Heard = { spoken: [], cancels: 0 };
    (window as unknown as { heard: Heard }).heard = heard;
    speechSynthesis.speak = (u) => void heard.spoken.push({ text: u.text, lang: u.lang });
    speechSynthesis.cancel = () => void heard.cancels++;
  });
  const voice = page.getByRole('button', { name: '음성' });

  // Off by default: 기러기's 감명 보고 is shown but not read.
  await page.goto('/?seed=20261106');
  await start(page);
  await expect(voice).toHaveAttribute('aria-pressed', 'false');
  expect(await heard(page)).toEqual({ spoken: [], cancels: 0 });

  // On: 기러기's line is read once in Korean; the observer's 감명 양호 is not.
  await page.goto('/?seed=20261106');
  await voice.click();
  await expect(voice).toHaveAttribute('aria-pressed', 'true');
  await start(page);
  expect(await heard(page)).toEqual({ spoken: [{ text: '갈매기, 여기는 기러기, 감명 보고, 이상.', lang: 'ko-KR' }], cancels: 0 });

  // Off again: speaking stops.
  await voice.click();
  await expect(voice).toHaveAttribute('aria-pressed', 'false');
  expect((await heard(page)).cancels).toBe(1);
});
