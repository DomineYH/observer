import { expect, test, type Page } from '@playwright/test';
import { replay, validateReplay } from '../../src/sim/index';
import { mockTerrain } from '../../src/adapters/mock/terrain/index';
import { BASE_SCENARIO } from '../../src/content/scenario';
import { fireOnOwnPost, mapPixels, settledMap, speedTo, standardGame } from './helpers';

// A real 재생 자료 and 임무 요약 (one 바로 효력사 on the flat test terrain, built once with tests/acceptance/session.ts).
const REPLAY = {"format":1,"simVersion":15,"seed":20261106,"seedKind":"daily","scenario":{"id":"base","version":1},"guns":{"id":"base","version":1},"weather":{"visibilityM":24000,"cloudPct":15,"windFromDeg":285,"windSpeedTenthMs":26,"tempTenthC":94,"precipTenthMmH":0,"pressureHpa":1023,"humidityPct":48},"mode":"standard","stepMs":50,"inputs":[{"t":0,"a":"start","v":[320,320]},{"t":1,"a":"pos_skip"},{"t":110,"a":"call","v":["ffe"]},{"t":186,"a":"loc","v":["grid",4080,3080]},{"t":241,"a":"desc","v":[3,"none","ready",0,"unknown"]},{"t":1861,"a":"eom","v":["ineffective"]}],"totalTicks":1862};
const MISSIONS = [{"targetNumber":1001,"corrections":0,"rounds":18,"firstError":null,"directionError":null,"rangeCorrections":[],"report":"ineffective"}];

/** A run as 기록 보관소 keeps it in this browser (the stored shape), standard · daily unless `record` says otherwise. */
const stored = (callsign: string, record: object = {}, createdAt = '2026-11-01T09:00:00.000Z') => ({
  callsign,
  record: {
    ticks: 30000, seed: 20261101, seedKind: 'daily', cleared: true, clearTick: 20000, roundsTotal: 30, missions: 2,
    adjustRounds: 3, firstErrorAvg: 20, directionErrorAvg: 5, reportAccuracyPct: 100, roundsPerUnit: 7.5, neutralized: 4,
    combatUnits: 4, earlyDefeats: 1, friendlyHits: 0, friendlyLosses: 0, dangerCloseMissed: 0, observerLost: false,
    postMoves: 0, compromised: false, score: 5000, mode: 'standard', ...record,
  },
  missions: MISSIONS,
  replay: REPLAY,
  createdAt,
  ranked: true, // the board does not trust it
});
/** Storage as it is before the page loads. */
const seed = (page: Page, runs: unknown) =>
  page.addInitScript((json) => localStorage.setItem('observer.runs', json), JSON.stringify(runs));
const openRanking = async (page: Page) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto('/?seed=20261106');
  await page.getByRole('button', { name: '랭킹' }).click();
  const dialog = page.getByRole('dialog', { name: '랭킹' });
  await expect(dialog).toBeVisible();
  return { dialog, errors };
};
const cells = (row: ReturnType<Page['getByRole']>) => row.getByRole('cell').allTextContents();

test('F-08: 호출부호 반영', async ({ page }) => {
  await page.goto('/?seed=20261106');
  const field = page.getByRole('textbox', { name: '호출부호', exact: true });
  const set = page.getByRole('button', { name: '정하기' });
  const current = page.getByRole('status', { name: '현재 호출부호' });
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
  await expect(composer.getByRole('status', { name: '보낼 문장' })).toHaveText('기러기, 여기는 참새12, 조정, 이상.');

  // The same browser is not asked again.
  await page.reload();
  await expect(page.getByRole('status', { name: '현재 호출부호' })).toHaveText('참새12');
  await expect(page.getByRole('textbox', { name: '호출부호', exact: true })).toHaveValue('참새12');
});

/** From a fresh page: pick the 관측소 후보 north of 1번 고지, run `prep`, start, and end the game on our own post. */
const endOnOwnPost = async (page: Page, prep: () => Promise<void> = async () => {}) => {
  await page.goto('/?seed=20261106');
  await standardGame(page);
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await prep();
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  return fireOnOwnPost(page);
};

/** A daily game ended on our own post. The clock is fixed so that today's seed is 20261106: the terrain and post
 * `fireOnOwnPost` is written for, under the weather that seed draws. `prep` runs after the pick; ×8 once it has started. */
const endDaily = async (page: Page, prep: () => Promise<void> = async () => {}) => {
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'));
  await page.goto('/');
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보: 찰리호텔 4512 3256');
  await prep();
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await speedTo(page, 8);
  return fireOnOwnPost(page);
};

/** The 랭킹 window's first board and 내 기록. */
const openBoards = async (page: Page) => {
  await page.getByRole('button', { name: '랭킹' }).click();
  const dialog = page.getByRole('dialog', { name: '랭킹' });
  await expect(dialog).toBeVisible();
  return { board: dialog.getByRole('table').first().getByRole('row').filter({ hasText: '갈매기' }), mine: dialog.getByRole('table').nth(1).getByRole('row').nth(1) };
};

test('랭킹: 표준을 눌러 시작한 일일 판은 집계된다', async ({ page }) => {
  test.setTimeout(180_000);
  const debrief = await endDaily(page, async () => {
    const standard = page.getByRole('button', { name: '표준', exact: true });
    await standard.click();
    await expect(standard).toHaveAttribute('aria-pressed', 'true');
  });
  await expect(debrief).toContainText('저장했습니다 · 표준 모드 · 일일 시드: 랭킹 집계');
  const { board, mine } = await openBoards(page);
  await expect(board).toHaveCount(1);
  expect((await cells(mine)).slice(1, 3)).toEqual(['갈매기', '표준']);
});

test('랭킹: 손대지 않은 일일 판은 훈련 기록이다', async ({ page }) => {
  test.setTimeout(180_000);
  const debrief = await endDaily(page);
  await expect(debrief).toContainText('저장했습니다 · 훈련 모드를 썼으므로 랭킹에서는 제외');
  const { board, mine } = await openBoards(page);
  await expect(board).toHaveCount(0);
  expect((await cells(mine)).slice(1, 3)).toEqual(['갈매기', '훈련']);
});

test('F-31: 미리보기는 재생 자료 형식 그대로 — 실제 화면', async ({ page }) => {
  test.setTimeout(300_000);
  const debrief = await endOnOwnPost(page);
  await expect(debrief).toContainText('저장했습니다 · 연습 시드: 랭킹에서는 제외');
  const [, rounds, score] = (await debrief.textContent())!.match(/사용 탄 (\d+)발 · 점수 (-?\d+) · 시드 연습 20261106/)!;
  await debrief.getByText('전송 데이터 미리보기').click();
  const preview = debrief.getByRole('group', { name: '전송 데이터' });
  await expect(preview).toBeVisible();

  // In Node: the text is 재생 자료 as it is, and replaying it gives this game with nothing ignored.
  const checked = validateReplay(JSON.parse((await preview.textContent())!));
  expect(checked.ok && checked.data.seed).toBe(20261106);
  if (!checked.ok) return;
  const again = replay(checked.data, await mockTerrain.load(checked.data.seed), BASE_SCENARIO);
  expect(again.ignored).toBe(0);
  expect(again.record.observerLost).toBe(true);
  expect([again.record.roundsTotal, again.record.score]).toEqual([Number(rounds), Number(score)]);
  expect(checked.data.inputs.map((i) => i.a)).toEqual(expect.arrayContaining(['pick', 'start', 'pos_skip', 'call', 'loc', 'desc', 'corr']));

  // The game is kept in this browser: 내 기록 shows it as a 연습 game.
  await page.getByRole('button', { name: '랭킹' }).click();
  const mine = page.getByRole('dialog', { name: '랭킹' }).getByRole('row').filter({ hasText: '관측반 손실' });
  await expect(mine).toHaveCount(1);
  expect((await cells(mine)).slice(1)).toEqual(['갈매기', '연습', '관측반 손실', '—', rounds, String(again.record.firstErrorAvg ?? '—'), score]);
});

test('F-30: 랭킹 자격 — 실제 화면', async ({ page }) => {
  await seed(page, [
    stored('표준병'),
    stored('훈련병', { mode: 'training' }, '2026-11-02T09:00:00.000Z'),
    stored('연습생', { seedKind: 'practice' }, '2026-11-03T09:00:00.000Z'),
  ]);
  const { dialog, errors } = await openRanking(page);
  const boardRow = (name: string) => dialog.getByRole('table').first().getByRole('row').filter({ hasText: name });
  // Each board: the standard · daily run tops it with its value; the training and practice runs are on none.
  const tabs: [string, string][] = [['종합', '5000점'], ['섬멸 시간', '16:40'], ['사용 탄', '30발'], ['정확도', '20 m · 보고 100%']];
  for (const [tab, value] of tabs) {
    await dialog.getByRole('button', { name: tab }).click();
    await expect(dialog.getByRole('button', { name: tab })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('columnheader', { name: tab })).toBeVisible();
    await expect(boardRow('표준병')).toHaveCount(1);
    expect(await cells(boardRow('표준병'))).toEqual(['1', '표준병', value, '30', '20 m', '11-01']);
    await expect(boardRow('훈련병')).toHaveCount(0);
    await expect(boardRow('연습생')).toHaveCount(0);
  }
  // 내 기록: all three, newest first, with their 모드.
  const mine = dialog.getByRole('table').nth(1).getByRole('row');
  await expect(mine).toHaveCount(4);
  const rows = await Promise.all([1, 2, 3].map(async (i) => (await cells(mine.nth(i))).slice(1, 3)));
  expect(rows).toEqual([['연습생', '연습'], ['훈련병', '훈련'], ['표준병', '표준']]);
  expect(errors).toEqual([]);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 모양이 틀린 저장 기록', async ({ page }) => {
  await seed(page, [
    { callsign: 'x', record: {} },
    null,
    7,
    { ...stored('깨진'), createdAt: 3 },
    { ...stored('빈칸'), record: { score: 1 } },
    { ...stored('겉만'), replay: {} }, // the nested 재생 자료 and 임무 요약 are checked too
    { ...stored('임무만'), missions: [null] },
    stored('멀쩡'),
  ]);
  const { dialog, errors } = await openRanking(page);
  await expect(dialog.getByRole('table').first().getByRole('row').filter({ hasText: '멀쩡' })).toHaveCount(1);
  await expect(dialog.getByRole('table').nth(1).getByRole('row')).toHaveCount(2); // header + the one valid run
  await expect(dialog).not.toContainText('깨진');
  await expect(dialog).not.toContainText('빈칸');
  await expect(dialog).not.toContainText('겉만');
  await expect(dialog).not.toContainText('임무만');
  expect(errors).toEqual([]);
});

test('F-31: 제출한 기록이 랭킹에 보인다 — 저장된 문자열은 글자로 보인다', async ({ page }) => {
  // Storage edited by hand: a run under a callsign with markup, which the rules never let through.
  await seed(page, [stored('<b>x</b>')]);
  const { dialog } = await openRanking(page);
  const rows = dialog.getByRole('row');
  await expect(rows.filter({ hasText: '<b>x</b>' })).toHaveCount(2); // on the board and in 내 기록, as characters
  await expect(rows.filter({ hasText: '<b>x</b>' }).first()).toContainText('1<b>x</b>5000점');
  await expect(dialog.locator('b')).toHaveCount(0);
});

test('F-30: 기상 변경은 판을 새로 만든다 — 전송 데이터', async ({ page }) => {
  // In 작전 준비: the sight turned and the binoculars on (cam and bino inputs of that game), then 안개.
  test.setTimeout(300_000);
  const debrief = await endOnOwnPost(page, async () => {
    // Each must reach the old game's simulation first: the map draws its sight wedge from the sim's aim and its width
    // from the sim's binoculars, so the map changing is the input taken.
    const map = page.getByRole('img', { name: '지도' });
    const still = await settledMap(page, map);
    for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => mapPixels(map)).not.toBe(still);
    const turned = await settledMap(page, map);
    await page.keyboard.press('b');
    await expect(page.getByRole('button', { name: '쌍안경' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => mapPixels(map)).not.toBe(turned);
    await page.getByRole('combobox', { name: '기상 바꾸기' }).selectOption({ label: '안개' });
    await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('기상 시정 2.5 km');
  });
  await debrief.getByText('전송 데이터 미리보기').click();
  const preview = debrief.getByRole('group', { name: '전송 데이터' });
  await expect(preview).toBeVisible();
  const checked = validateReplay(JSON.parse((await preview.textContent())!));
  expect(checked.ok).toBe(true);
  if (!checked.ok) return;
  // The header carries 안개 (the preset's values, written out), and the 입력 기록 is the new game's: the candidate and the
  // chosen 표준 put in again, then 작전 개시; none of the old game's sight or binocular inputs.
  expect(checked.data.weather).toEqual({
    visibilityM: 2500, cloudPct: 100, windFromDeg: 180, windSpeedTenthMs: 7, tempTenthC: 40, precipTenthMmH: 0,
    pressureHpa: 1020, humidityPct: 99,
  });
  const acts = checked.data.inputs.map((i) => i.a);
  expect(acts.slice(0, 3)).toEqual(['pick', 'mode', 'start']);
  expect(acts).not.toContain('cam');
  expect(acts).not.toContain('bino');
  // And it is this game: replayed, it ends as the screen says, nothing ignored.
  const again = replay(checked.data, await mockTerrain.load(checked.data.seed), BASE_SCENARIO);
  expect(again.ignored).toBe(0);
  expect(again.record.observerLost).toBe(true);
});
