// 스모크 (spec 테스트하는 이음매 5, repo_checks critical flow): one 훈련 모드 game through the UI of the built app, from
// 작전 준비 to the 사후강평, at ×8 × 4 (the hidden `timescale=4`) except for the few seconds the pick needs at ×1.
import { expect, test, type Page } from '@playwright/test';
import { everyControlNamed, lineSaid, speedTo, ticks } from './helpers';

const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
/** Polls the 틱 until it reaches `t` (at ×8 the clock runs 160 ticks a second, 640 with `timescale=4`). */
const tickAtLeast = (page: Page, t: number, timeout: number) => expect.poll(() => ticks(page), { timeout }).toBeGreaterThanOrEqual(t);

test('스모크: 훈련 모드 한 판 완주', async ({ page }) => {
  // 40 simulated minutes at ×8 × 4 are 75 s; the pick runs ~25 s at ×1 (~50 s more if it needs the second volley).
  // The timeout keeps the old ×8 room: a slow runner only loses pace, never ticks.
  test.setTimeout(480_000);
  await page.goto('/?seed=20261106');
  const prep = page.getByRole('region', { name: '작전 준비' });
  const log = page.getByRole('region', { name: '무전 기록' });
  const composer = page.getByRole('region', { name: '입력기' });
  const preview = composer.getByRole('status', { name: '보낼 문장' });
  const send = composer.getByRole('button', { name: '송신' });
  /** Sends what the preview shows; the log then holds the observer's line exactly as previewed, once. */
  const transmit = async () => {
    const said = (await preview.textContent())!;
    await send.click();
    await expect(lineSaid(log, '갈매기', said)).toHaveCount(1); // the whole line: its time, 갈매기 and the sentence
    return said;
  };

  // 작전 준비: no pick, so 작전 개시 occupies the planned 1번 고지 (no 위치 보고; > 1.1 km from every enemy objective,
  // so the 관측반 is never found: a probe of this seed ran each such game to the 40분 한도). 훈련 and 화질 보통 (the
  // lighter frame keeps ×8 at full pace).
  await expect(prep).toContainText('연습 20261106');
  await expect(prep).toContainText('고르지 않으면 계획된 1번 고지를 점령합니다.');
  const training = page.getByRole('button', { name: '훈련', exact: true });
  await training.click();
  await expect(training).toHaveAttribute('aria-pressed', 'true');
  const quality = page.getByRole('group', { name: '화질' }).getByRole('button', { name: '보통', exact: true });
  await quality.click();
  await expect(quality).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect(prep).toContainText('작전 개시 — 찰리호텔 4512 3180 점령.');
  await expect(prep).not.toContainText('위치를 보고하십시오');
  await speedTo(page, 8);
  await expect(log).toContainText('기러기, 여기는 갈매기, 감명 양호, 이상.');

  await test.step('탐지: 박격포반의 첫 사격 연기', async () => {
    // The enemy mortar section digs in at about (5676, 7520), 5.8 km north, and fires its first volley at 210 s (tick
    // 4200); its smoke rises past ridges. Through the binoculars from 20.4 mils: 4 × 20 right is 100.4, 5 × 5 up is
    // +3 mils (found with a Node run of the simulation).
    await blur(page);
    await page.keyboard.press('b');
    await expect(page.getByRole('button', { name: '쌍안경' })).toHaveAttribute('aria-pressed', 'true');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowUp');
    await page.keyboard.press('r');
    await expect(page.getByRole('region', { name: '관측' }).getByRole('group', { name: '레이저 측정' }).locator('p')).toContainText(
      '레이저: 방위각 0100 밀',
    );
    // The pick is tied to what the clock and the view show, not to timing: on this seed the mortar's volleys start at
    // ticks 4200, 5219, 6557 (its own stream: the same in every game), and from this aim a press picks the smoke 10–220
    // ticks after a volley starts. For each volley: ×1 near it, 일시정지 before it for a clear look at the aim; then, in
    // its window, again and again: 일시정지, and if the view at the aim differs from the clear look (the smoke), the press;
    // 재개 for a few ticks (the press applies on the next step), and 표적 1 or the next look. Nothing in an attempt
    // throws: a volley that gives no target leaves the game running for the next one. 표적 1 within two volleys.
    const view = page.getByRole('img', { name: '관측 화면' });
    const pause = page.getByRole('button', { name: '일시정지' });
    const resume = page.getByRole('button', { name: '재개' });
    const targets = page.getByRole('region', { name: '표적 목록' });
    /** The view's pixels around its centre, where the aim is. */
    const atAim = () =>
      view.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData((c.width / 2 - 24) | 0, (c.height / 2 - 24) | 0, 48, 48).data;
        return Array.from(d).join();
      });
    /** Whether the clock reaches `t` within `timeout` ms; never throws. */
    const reaches = (t: number, timeout = 30_000) => tickAtLeast(page, t, timeout).then(() => true, () => false);
    const found = () => targets.getByText(/^표적 1/).waitFor({ timeout: 1_000 }).then(() => true, () => false);
    const running = async () => {
      if (await resume.isVisible()) await resume.click();
    };
    const tryVolley = async (at: number) => {
      await running();
      await speedTo(page, 8);
      if (!(await reaches(at - 400, 90_000))) return false;
      await speedTo(page, 1);
      if (!(await reaches(at - 100))) return false;
      await pause.click();
      const before = await ticks(page);
      const clear = await atAim();
      await resume.click();
      if (before >= at) return false; // no clear look left before this volley
      if (!(await reaches(at + 10))) return false;
      for (;;) {
        await pause.click();
        const t = await ticks(page);
        if (t > at + 215) break; // the window is over
        if ((await atAim()) !== clear) {
          // The smoke is in the view: press it.
          const v = (await view.boundingBox())!;
          await view.click({ position: { x: v.width / 2, y: v.height / 2 } });
        }
        await resume.click();
        await reaches(t + 15, 10_000);
        if (await found()) return true;
      }
      await running();
      return false;
    };
    expect((await tryVolley(4200)) || (await tryVolley(5219))).toBe(true);
    await expect(targets).toContainText('표적 1');
    await speedTo(page, 8);
    // From here ×8 × 4: switched only after the pick, whose windows need ×1 (the loop reads the address each frame).
    await page.evaluate(() => history.replaceState(null, '', `${location.search}&timescale=4`));
  });

  await test.step('사격 임무: 조정 → 좌표 → 성질 → 수정 + 효력사 → 임무끝', async () => {
    await expect(preview).toHaveText('기러기, 여기는 갈매기, 조정, 이상.');
    await transmit();
    await expect(log).toContainText('좌표 송신바람');
    // The mortar's grid: 찰리호텔 4567 3752.
    await composer.getByRole('textbox', { name: '동', exact: true }).fill('4567');
    await composer.getByRole('textbox', { name: '북', exact: true }).fill('3752');
    await expect(preview).toHaveText('좌표 찰리호텔 넷오여섯칠(4567) 삼칠오둘(3752), 이상.') // 훈련: the digits beside the words;
    await transmit();
    // Not the composer's defaults: 포대 둘발 접근신관 (the form's values reach the line).
    await composer.getByRole('combobox', { name: '발수' }).selectOption('2');
    await composer.getByRole('combobox', { name: '신관' }).selectOption('vt');
    await expect(composer.getByRole('combobox', { name: '통제' })).toHaveValue('ready');
    // Smoke alone tells 탐지 only: 미상 표적 is the one 표적성질 on offer.
    expect(await transmit()).toBe('미상 표적, 포대 둘발(2), 접근신관, 이상.');
    await expect(log).toContainText('표적번호 알파브라보 하나공공하나', { timeout: 20_000 });
    await expect(log).toContainText('사격준비 끝.', { timeout: 20_000 });

    // The adjusting round lands; 훈련 fills 방향 from the aim and the suggested correction. Add 효력사 and send.
    const direction = composer.getByRole('textbox', { name: '방향' });
    await expect(direction).toBeVisible({ timeout: 30_000 });
    await expect(direction).toHaveValue('100'); // the aim's 100.4 mils
    await composer.getByRole('combobox', { name: '다음' }).selectOption('ffe');
    expect(await transmit()).toMatch(/효력사, 이상\.$/);
    await expect(log).toContainText('마감탄 떳다', { timeout: 30_000 });
    await expect(composer).toContainText('효과를 관측하십시오.', { timeout: 30_000 });

    // 효과 by the training display of the real casualties (PRD 6장: 60% 파괴, 30% 무력화), then 임무끝.
    const shown = (await composer.textContent())!.match(/\(훈련\) 표적 1 실제 사상 \d+\/12 \((\d+)%\)/);
    expect(shown).not.toBeNull();
    const pct = Number(shown![1]);
    await composer.getByRole('combobox', { name: '효과' }).selectOption(pct >= 60 ? 'destroyed' : pct >= 30 ? 'neutralized' : 'ineffective');
    await expect(composer.getByRole('combobox', { name: '다음 조치' })).toHaveValue('eom');
    expect(await transmit()).toMatch(/^임무끝, .+\.$/);
    await expect(composer.getByRole('combobox', { name: '경고명령' })).toBeVisible();
  });

  await test.step('종료 → 사후강평', async () => {
    // The armour halts 1.3 km out and never falls, so the game runs to the 40분 한도.
    const debrief = page.getByRole('region', { name: '사후강평' });
    await expect(debrief).toBeVisible({ timeout: 0 }); // no own limit: the test's 480 s bound the wait
    await expect(debrief).toContainText('경과 40:00');
    await expect(debrief).toContainText('저장했습니다 · 훈련 모드를 썼으므로 랭킹에서는 제외');
    await expect(debrief.getByRole('row').filter({ hasText: 'AB1001' })).toContainText('일치');
    await expect(debrief.getByRole('row').filter({ hasText: '적 박격포반' })).toContainText('표적 1');
    const at = await ticks(page);
    expect(at).toBe(48000);
    await page.waitForTimeout(500);
    expect(await ticks(page)).toBe(at);
    await everyControlNamed(page);
  });
});
