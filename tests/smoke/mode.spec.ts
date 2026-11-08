import { expect, test, type Page } from '@playwright/test';
import { createSim, heightAt, type Input } from '../../src/sim/index';
import { DEFAULT_QUALITY, eyeAt, focalOf, MIL, project, QUALITIES } from '../../src/render/projection';
import { mockTerrain } from '../../src/adapters/mock/terrain/index';
import { CLEAR_WEATHER } from '../../src/adapters/mock/weather';
import { BASE_GUNS } from '../../src/content/guns';
import { BASE_SCENARIO } from '../../src/content/scenario';
import { mapPixels, settledMap, speedTo, toReady } from './helpers';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** A fresh page on the fixed practice seed with the 관측소 후보 picked (찰리호텔 4512 3256, off the planned post). */
async function picked(page: Page) {
  await page.goto('/?seed=20261106');
  const map = page.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height * 0.75 } });
  await expect(page.getByRole('region', { name: '작전 준비' })).toContainText('관측소 후보: 찰리호텔 4512 3256');
}

/** 작전 개시, and the clock running. */
async function start(page: Page) {
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  const tick = page.getByRole('status', { name: '틱' });
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(0);
  return tick;
}

/** Answers every confirm with `answer.accept` and keeps the messages. */
function dialogs(page: Page) {
  const seen: string[] = [];
  const answer = { accept: true };
  page.on('dialog', (d) => {
    seen.push(d.message());
    void (answer.accept ? d.accept() : d.dismiss());
  });
  return { seen, answer };
}

/** The lower view's distinct colours: a dark view has one or two, a drawn one many. */
const shades = (page: Page) =>
  page.getByRole('img', { name: '관측 화면' }).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, (c.height * 0.6) | 0, c.width, (c.height * 0.4) | 0).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return seen.size;
  });

test('F-14: 훈련 전환 경고', async ({ page }) => {
  const { seen, answer } = dialogs(page);
  await picked(page);
  // 작전 준비: switching is free, no warning.
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await button(page, '표준').click();
  await expect(button(page, '표준')).toHaveAttribute('aria-pressed', 'true');
  expect(seen).toEqual([]);

  await start(page);
  // A standard operation under way: training asks first. Declined, nothing changes.
  answer.accept = false;
  await button(page, '훈련').click();
  expect(seen).toHaveLength(1);
  expect(seen[0]).toContain('랭킹에서 제외');
  await page.waitForTimeout(300);
  await expect(button(page, '표준')).toHaveAttribute('aria-pressed', 'true');
  // Accepted: training.
  answer.accept = true;
  await button(page, '훈련').click();
  expect(seen).toHaveLength(2);
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  // Once used, the game is a training one: back and forth without asking again.
  await button(page, '표준').click();
  await expect(button(page, '표준')).toHaveAttribute('aria-pressed', 'true');
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  expect(seen).toHaveLength(2);
});

test('F-14: 표준 일시정지 가림', async ({ page }) => {
  dialogs(page);
  const view = page.getByRole('img', { name: '관측 화면' });
  const map = page.getByRole('img', { name: '지도' });
  const composer = page.getByRole('region', { name: '입력기' });
  await picked(page);
  await expect(button(page, '일시정지')).toBeDisabled(); // only once live
  const tick = await start(page);
  await expect(composer.getByRole('button', { name: '보고하지 않고 계속' })).toBeVisible({ timeout: 15_000 });

  await button(page, '일시정지').click();
  const at = await tick.textContent();
  await page.waitForTimeout(500);
  await expect(tick).toHaveText(at!);
  await expect(view).toBeHidden();
  await expect(map).toBeHidden();
  await expect(composer).toContainText('일시정지 — 표준 모드에서는 정지 중에 관측 화면·지도·교신을 쓸 수 없습니다.');
  await expect(composer.getByRole('button', { name: '보고하지 않고 계속' })).toHaveCount(0);
  await expect(button(page, '훈련')).toBeDisabled();

  await button(page, '재개').click();
  await expect(view).toBeVisible();
  await expect(map).toBeVisible();
  await expect(composer.getByRole('button', { name: '보고하지 않고 계속' })).toBeVisible();
  await expect.poll(async () => tick.textContent()).not.toBe(at);

  // Training pauses without hiding anything.
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await button(page, '일시정지').click();
  const still = await tick.textContent();
  await page.waitForTimeout(500);
  await expect(tick).toHaveText(still!);
  await expect(view).toBeVisible();
  await expect(map).toBeVisible();
  await expect(composer.getByRole('button', { name: '보고하지 않고 계속' })).toBeVisible();
  await button(page, '재개').click();
});

test('F-14: 훈련 숫자 병기', async ({ page }) => {
  dialogs(page);
  await picked(page);
  await start(page);
  const log = page.getByRole('region', { name: '무전 기록' });
  const composer = page.getByRole('region', { name: '입력기' });
  const preview = composer.getByRole('status', { name: '보낼 문장' });
  const send = composer.getByRole('button', { name: '송신' });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click({ timeout: 15_000 });
  await send.click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await composer.getByRole('textbox', { name: '동', exact: true }).fill('4720');
  await composer.getByRole('textbox', { name: '북', exact: true }).fill('3150');
  // Standard: words only.
  await expect(preview).toHaveText('좌표 찰리호텔 넷칠둘공 삼하나오공, 이상.');
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  // The switch rebuilt the form (demo 1408–1409), so the grid goes in again.
  await composer.getByRole('textbox', { name: '동', exact: true }).fill('4720');
  await composer.getByRole('textbox', { name: '북', exact: true }).fill('3150');
  // Training: the arabic numerals beside them, dimmed.
  await expect(preview).toHaveText('좌표 찰리호텔 넷칠둘공(4720) 삼하나오공(3150), 이상.');
  const gloss = preview.getByText('(4720)');
  expect(Number(await gloss.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(1);
  await send.click();
  const line = log.locator('li', { hasText: '갈매기 좌표 찰리호텔' });
  await expect(line).toContainText('넷칠둘공(4720) 삼하나오공(3150)');
  // Back to standard: the same line without them.
  await button(page, '표준').click();
  await expect(line).toContainText('좌표 찰리호텔 넷칠둘공 삼하나오공, 이상.');
});

test('F-24: 가시권은 훈련 전용', async ({ page }) => {
  await picked(page);
  const vs = page.getByRole('checkbox', { name: /가시권 표시/ });
  const map = page.getByRole('img', { name: '지도' });
  // Standard: no 가시권, and the view stays dark until the post is occupied.
  await expect(vs).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await shades(page)).toBeLessThanOrEqual(3);

  // Training: the 관측소 후보 preview in the view, and the 가시권 switch on the map.
  await button(page, '훈련').click();
  await expect.poll(() => shades(page)).toBeGreaterThan(32);
  await expect(vs).toBeVisible();
  await expect(vs).not.toBeChecked();
  const plain = await settledMap(page, map);
  await vs.check();
  await expect.poll(() => mapPixels(map), { timeout: 10_000 }).not.toBe(plain);

  // Standard again: both gone; back in training the switch starts off and the map has no 가시권.
  await button(page, '표준').click();
  await expect(vs).toHaveCount(0);
  await expect.poll(() => shades(page)).toBeLessThanOrEqual(3);
  await button(page, '훈련').click();
  await expect(vs).not.toBeChecked();
  await expect.poll(() => settledMap(page, map)).toBe(plain);
});

test('F-14: 훈련 아군 표시 — 화면', async ({ page }) => {
  // #34: training names our positions in the view, "▼ 아군 n소대" 12 m above each one's ground (demo 1217). From the
  // planned post, looking where a game starts (20.4 mils, 22 mils down), the places come from the view's projection;
  // the canvas there must hold that text, drawn as the view draws it, and not another platoon's number.
  await page.goto('/?seed=20261106');
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect.poll(async () => Number(await page.getByRole('status', { name: '틱' }).textContent())).toBeGreaterThan(0);

  const terrain = await mockTerrain.load(20261106);
  const w = QUALITIES[DEFAULT_QUALITY];
  const h = Math.round((w * 9) / 16);
  const aim = { h: 20.4, p: -22 };
  const focal = focalOf(w, false);
  const geom = { eye: eyeAt(terrain, BASE_SCENARIO.plannedOp), h: aim.h, focal, cx: w / 2, hor: h / 2 + Math.tan(aim.p / MIL) * focal };
  const places = BASE_SCENARIO.friends.flatMap((f, i) => {
    const p = project(geom, { x: f.x, y: f.y, z: heightAt(terrain, f.x, f.y) + 12 });
    return p && p.sx > 0 && p.sx < w ? [{ n: i + 1, sx: p.sx, sy: p.sy }] : [];
  });
  expect(places.map((p) => p.n)).toEqual([1, 2, 3]); // all three in the opening view

  const view = page.getByRole('img', { name: '관측 화면' });
  /** How well the label-blue pixels around `at` match `text` drawn there in the view's font (intersection over union). */
  const match = (at: { sx: number; sy: number }, text: string) =>
    view.evaluate(
      (c: HTMLCanvasElement, { at, text, w }) => {
        const dpr = window.devicePixelRatio || 1;
        const k = c.width / w;
        const [x, y] = [at.sx * k, at.sy * k];
        const [bw, bh] = [Math.round(160 * dpr), Math.round(24 * dpr)];
        const [x0, y0] = [Math.round(x - bw / 2), Math.round(y - 18 * dpr)];
        const seen = c.getContext('2d')!.getImageData(x0, y0, bw, bh).data;
        const ref = new OffscreenCanvas(bw, bh).getContext('2d')!;
        ref.font = `${Math.round(12 * dpr)}px monospace`;
        ref.textAlign = 'center';
        ref.fillText(text, x - x0, y - y0);
        const ink = ref.getImageData(0, 0, bw, bh).data;
        const near = (v: number, c0: number) => Math.abs(v - c0) <= 30;
        let both = 0;
        let either = 0;
        for (let i = 0; i < bw * bh; i++) {
          const a = ink[i * 4 + 3]! > 200;
          const b = near(seen[i * 4]!, 98) && near(seen[i * 4 + 1]!, 174) && near(seen[i * 4 + 2]!, 230);
          if (a && b) both++;
          if (a || b) either++;
        }
        return either ? both / either : 0;
      },
      { at, text, w },
    );
  const label = (n: number) => `▼ 아군 ${n}소대`;
  for (const p of places) {
    await expect.poll(() => match(p, label(p.n))).toBeGreaterThan(0.5);
    for (const other of [1, 2, 3, 4].filter((n) => n !== p.n)) expect(await match(p, label(other))).toBeLessThan(await match(p, label(p.n)));
  }

  // Standard, the same view: no label anywhere.
  await button(page, '표준').click();
  await expect(button(page, '표준')).toHaveAttribute('aria-pressed', 'true');
  for (const p of places) await expect.poll(() => match(p, label(p.n))).toBeLessThan(0.05);
});

test('F-12: 훈련 모드의 실제 사상 — 화면', async ({ page }) => {
  // #29: after 효력사 in training, the 입력기 shows the real casualties of the unit hit hardest. 바로 효력사 on the 82 mm
  // mortar section, dug in at 찰리호텔 4567 3752 on this seed (golden ①), from the planned post. Each input goes in
  // while paused, so it applies at the tick the counter shows: the same game is then played again in Node through the
  // simulation's public interface, and its casualties are the ones the page must show.
  test.setTimeout(180_000);
  const tick = page.getByRole('status', { name: '틱' });
  const composer = page.getByRole('region', { name: '입력기' });
  const log = page.getByRole('region', { name: '무전 기록' });
  const send = composer.getByRole('button', { name: '송신' });
  const inputs = new Map<number, Input[]>();
  /** Pauses, does `act` (which sends `input`), notes the tick it will apply at, resumes. */
  const paused = async (input: Input, act: () => Promise<void>) => {
    await button(page, '일시정지').click();
    await page.waitForTimeout(300); // the counter catches up with the stopped clock
    const t = Number(await tick.textContent());
    await act();
    inputs.set(t, [...(inputs.get(t) ?? []), input]);
    await button(page, '재개').click();
  };
  await page.goto('/?seed=20261106');
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '관측소 점령 · 작전 개시' }).click();
  await expect(composer.getByRole('combobox', { name: '경고명령' })).toBeVisible({ timeout: 15_000 }); // 통신 점검 done, no 위치 보고 owed
  await paused({ a: 'call', v: ['ffe'] }, async () => {
    await composer.getByRole('combobox', { name: '경고명령' }).selectOption('ffe');
    await send.click();
  });
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await paused({ a: 'loc', v: ['grid', 4567, 3752] }, async () => {
    await composer.getByRole('textbox', { name: '동', exact: true }).fill('4567');
    await composer.getByRole('textbox', { name: '북', exact: true }).fill('3752');
    await send.click();
  });
  await expect(composer.getByRole('combobox', { name: '표적성질' })).toBeVisible({ timeout: 15_000 });
  await paused({ a: 'desc', v: [3, 'none', 'ready', 0, 'unknown'] }, () => send.click()); // the form's defaults: 미상 표적, 포대 삼발
  await speedTo(page, 8);
  await expect(composer).toContainText('효과를 관측하십시오.', { timeout: 60_000 });
  await button(page, '일시정지').click();
  await page.waitForTimeout(300);
  const end = Number(await tick.textContent());
  const shown = (await composer.textContent())!.match(/\(훈련\) (.+?) 실제 사상 (\d+)\/(\d+) \((\d+)%\)/);
  expect(shown).not.toBeNull();
  const [, name, dead, size, pct] = shown!;

  // The same game in Node: 연습 시드, clear weather, 훈련 then 작전 개시 at the planned post in 작전 준비.
  const sim = createSim({ seed: 20261106, seedKind: 'practice', scenario: BASE_SCENARIO, guns: BASE_GUNS, weather: CLEAR_WEATHER, mode: 'standard', terrain: await mockTerrain.load(20261106) });
  expect(sim.step([{ a: 'mode', v: ['training'] }]).accepted).toEqual([true]);
  expect(sim.step([{ a: 'start', v: [BASE_SCENARIO.plannedOp.x, BASE_SCENARIO.plannedOp.y] }]).accepted).toEqual([true]);
  while (sim.state.tick < end) {
    const batch = inputs.get(sim.state.tick) ?? [];
    expect(sim.step(batch).accepted, `inputs at tick ${sim.state.tick}`).toEqual(batch.map(() => true));
  }
  const unit = sim.state.platoons.find((p) => (p.intel.stage > 0 ? `표적 ${p.intel.tnum}` : null) === name) ?? sim.state.platoons.find((p) => p.type === 'mortar')!;
  const lost = unit.members.filter((m) => !m.alive).length;
  expect([Number(dead), Number(size), Number(pct)]).toEqual([lost, unit.members.length, Math.round((100 * lost) / unit.members.length)]);
  expect(lost).toBeGreaterThan(0); // the volley did hit the section

  // Standard, same situation: no casualty line.
  await button(page, '재개').click();
  await button(page, '표준').click();
  await expect(button(page, '표준')).toHaveAttribute('aria-pressed', 'true');
  await expect(composer).toContainText('효과를 관측하십시오.');
  await expect(composer).not.toContainText('실제 사상');
});

test('F-21: 위치 보고 훈련 미리 채움 — 화면', async ({ page }) => {
  // #33: training fills the 위치 보고 with where the post really stands, after 작전 개시 and after a move.
  test.setTimeout(180_000);
  await picked(page);
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await start(page);
  const composer = page.getByRole('region', { name: '입력기' });
  const log = page.getByRole('region', { name: '무전 기록' });
  const report = composer.getByRole('region', { name: '위치 보고' });
  await expect(report.getByRole('textbox', { name: '동', exact: true })).toHaveValue('4512', { timeout: 15_000 });
  await expect(report.getByRole('textbox', { name: '북', exact: true })).toHaveValue('3256');
  await report.getByRole('button', { name: '보고하지 않고 계속' }).click();
  await expect(log).toContainText('위치 보고 생략');

  // Walk a few metres east (as the F-21 smoke step does), at ×8.
  const mapPanel = page.getByRole('region', { name: '지도 패널' });
  await mapPanel.getByRole('button', { name: '관측소로' }).click();
  const map = mapPanel.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2 + 1, y: box.height / 2 } });
  const [, e, n] = (await mapPanel.getByText(/^좌표자:/).textContent())!.match(/(\d{4}) (\d{4})/)!;
  await mapPanel.getByRole('button', { name: /^여기로 관측소 이동 · \d+ m · 약 \d\d:\d\d/ }).click();
  await speedTo(page, 8);
  await expect(log).toContainText('관측소 설치 끝.', { timeout: 60_000 });
  await expect(report.getByRole('textbox', { name: '동', exact: true })).toHaveValue(e!);
  await expect(report.getByRole('textbox', { name: '북', exact: true })).toHaveValue(n!);
});

test('F-30: 기상 변경은 고른 모드를 남긴다 — 화면', async ({ page }) => {
  const { seen } = dialogs(page);
  await picked(page);
  await button(page, '훈련').click();
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: '기상 바꾸기' }).selectOption({ label: '안개' });
  const prep = page.getByRole('region', { name: '작전 준비' });
  await expect(prep).toContainText('기상 시정 2.5 km');
  // Still training: the mode buttons, and a training aid on the map; the 후보 kept too.
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, '표준')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('checkbox', { name: /가시권 표시/ })).toBeVisible();
  await expect(prep).toContainText('관측소 후보: 찰리호텔 4512 3256');
  // Training was chosen before 작전 개시: the warning has nothing to warn about.
  await start(page);
  expect(seen).toEqual([]);
  await expect(button(page, '훈련')).toHaveAttribute('aria-pressed', 'true');
});

/** Presses the map at a share of its width and height; returns the 좌표자's digits. */
async function pressMap(page: Page, fx: number, fy: number) {
  const panel = page.getByRole('region', { name: '지도 패널' });
  const map = panel.getByRole('img', { name: '지도' });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * fx, y: box.height * fy } });
  const read = panel.getByText(/^좌표자:/);
  await expect(read).toBeVisible();
  const [, e, n] = (await read.textContent())!.match(/(\d{4}) (\d{4})/)!;
  return { e: e!, n: n! };
}

const toFire = (page: Page) => page.getByRole('region', { name: '지도 패널' }).getByRole('button', { name: '사격요구에 입력' });
const toReport = (page: Page) => page.getByRole('region', { name: '지도 패널' }).getByRole('button', { name: '위치 보고에 입력' });

test('F-06: 좌표자를 사격요구에 넣는다 — 화면', async ({ page }) => {
  test.setTimeout(90_000);
  await picked(page);
  await start(page);
  const composer = page.getByRole('region', { name: '입력기' });
  const log = page.getByRole('region', { name: '무전 기록' });
  const east = composer.getByRole('textbox', { name: '동', exact: true });
  const north = composer.getByRole('textbox', { name: '북', exact: true });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click({ timeout: 15_000 });
  await expect(log).toContainText('위치 보고 생략');
  // Read at the call: nothing to put it in yet.
  const first = await pressMap(page, 0.6, 0.4);
  await expect(toFire(page)).toHaveCount(0);
  await expect(toReport(page)).toHaveCount(0);
  await composer.getByRole('button', { name: '송신' }).click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  // At 표적위치 the form opens with that point (demo 958–959), and the button is there.
  await expect(east).toHaveValue(first.e);
  await expect(north).toHaveValue(first.n);
  await expect(toFire(page)).toBeVisible();
  await expect(toReport(page)).toHaveCount(0);

  // A new point stays on the map until the button puts it in; pressed again it replaces a hand edit.
  const second = await pressMap(page, 0.3, 0.7);
  await expect(east).toHaveValue(first.e);
  await toFire(page).click();
  await expect(east).toHaveValue(second.e);
  await expect(north).toHaveValue(second.n);
  await east.fill('1111');
  await toFire(page).click();
  await expect(east).toHaveValue(second.e);

  // On 극좌표 it fills the grid behind it and stays there (demo 1420).
  const third = await pressMap(page, 0.4, 0.6);
  await composer.getByRole('radio', { name: '극좌표' }).check();
  await toFire(page).click();
  await expect(composer.getByRole('radio', { name: '극좌표' })).toBeChecked();
  await composer.getByRole('radio', { name: '좌표', exact: true }).check();
  await expect(east).toHaveValue(third.e);
  await expect(north).toHaveValue(third.n);

  // What goes out is that point; the step over, the button goes.
  const line = (await composer.getByRole('status', { name: '보낼 문장' }).textContent())!;
  await composer.getByRole('button', { name: '송신' }).click();
  await expect(log).toContainText(line);
  await expect(toFire(page)).toHaveCount(0);
});

test('F-06: 관측소 후보가 표적위치에 미리 들어간다 — 화면', async ({ page }) => {
  // The pick is the map's last point until the map is pressed again (demo 1427, 958–959); no button without a press.
  test.setTimeout(90_000);
  await picked(page);
  await start(page);
  const composer = page.getByRole('region', { name: '입력기' });
  const log = page.getByRole('region', { name: '무전 기록' });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click({ timeout: 15_000 });
  await expect(log).toContainText('위치 보고 생략');
  await composer.getByRole('button', { name: '송신' }).click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await expect(composer.getByRole('textbox', { name: '동', exact: true })).toHaveValue('4512');
  await expect(composer.getByRole('textbox', { name: '북', exact: true })).toHaveValue('3256');
  await expect(toFire(page)).toHaveCount(0);
});

test('F-21: 좌표자를 위치 보고에 넣는다 — 화면', async ({ page }) => {
  test.setTimeout(60_000);
  await picked(page);
  await start(page);
  const composer = page.getByRole('region', { name: '입력기' });
  const log = page.getByRole('region', { name: '무전 기록' });
  const report = composer.getByRole('region', { name: '위치 보고' });
  const east = report.getByRole('textbox', { name: '동', exact: true });
  const north = report.getByRole('textbox', { name: '북', exact: true });
  // Standard opens the report on the map's last point, here the pick (demo 942, 1427).
  await expect(east).toHaveValue('4512', { timeout: 15_000 });
  await expect(north).toHaveValue('3256');
  await expect(toReport(page)).toHaveCount(0);

  const read = await pressMap(page, 0.6, 0.4);
  await expect(toReport(page)).toBeVisible();
  await expect(toFire(page)).toHaveCount(0);
  await expect(east).toHaveValue('4512');
  await toReport(page).click();
  await expect(east).toHaveValue(read.e);
  await expect(north).toHaveValue(read.n);

  const line = (await report.getByRole('status', { name: '보낼 문장' }).textContent())!;
  await report.getByRole('button', { name: '송신' }).click();
  await expect(log).toContainText(line);
  await expect(toReport(page)).toHaveCount(0);
});

// 모드 전환 rebuilds the whole 입력기 from each field's start (demo 1408–1409 call renderComposer, which ends in
// comp.innerHTML): a typed value, a choice and a transferred point are all replaced.

/** From a fresh page on the picked post, past the 위치 보고, to the call form; `lase` first with the view's aim. */
async function toCall(page: Page, lase = false) {
  dialogs(page);
  await picked(page);
  await start(page);
  const composer = page.getByRole('region', { name: '입력기' });
  const log = page.getByRole('region', { name: '무전 기록' });
  await composer.getByRole('button', { name: '보고하지 않고 계속' }).click({ timeout: 15_000 });
  await expect(log).toContainText('위치 보고 생략');
  if (lase) {
    const view = page.getByRole('region', { name: '관측' });
    await view.getByRole('button', { name: '레이저' }).click();
    await expect(view.getByRole('group', { name: '레이저 측정' }).locator('p')).toContainText('· 거리 ');
  }
  return { composer, log, send: composer.getByRole('button', { name: '송신' }) };
}

/** 표준 · 훈련 back and forth. */
const switchTo = async (page: Page, name: '훈련' | '표준') => {
  await button(page, name).click();
  await expect(button(page, name)).toHaveAttribute('aria-pressed', 'true');
};

test('F-21: 위치 보고 미리 채움은 모드를 따른다 — 화면', async ({ page }) => {
  test.setTimeout(60_000);
  dialogs(page);
  await picked(page);
  await start(page);
  const report = page.getByRole('region', { name: '입력기' }).getByRole('region', { name: '위치 보고' });
  const east = report.getByRole('textbox', { name: '동', exact: true });
  const north = report.getByRole('textbox', { name: '북', exact: true });
  const shows = async (e: string, n: string) => {
    await expect(east).toHaveValue(e);
    await expect(north).toHaveValue(n);
  };
  await expect(east).toHaveValue('4512', { timeout: 15_000 });

  // A point away from the post, put in: 훈련 replaces it with the post's own grid, 표준 goes back to the point.
  const read = await pressMap(page, 0.6, 0.4);
  await toReport(page).click();
  await shows(read.e, read.n);
  await switchTo(page, '훈련');
  await shows('4512', '3256');
  await switchTo(page, '표준');
  await shows(read.e, read.n);

  // A typed value does not survive the switch, in either direction.
  await east.fill('1234');
  await switchTo(page, '훈련');
  await shows('4512', '3256');
  await east.fill('1234');
  await switchTo(page, '표준');
  await shows(read.e, read.n);

  // Nor does a transfer come back: the next point is on the map only, and 표준 opens on it.
  const next = await pressMap(page, 0.3, 0.7);
  await switchTo(page, '훈련');
  await shows('4512', '3256');
  await switchTo(page, '표준');
  await shows(next.e, next.n);
});

test('F-07: 호출은 모드 전환에 다시 채워진다 — 화면', async ({ page }) => {
  test.setTimeout(60_000);
  const { composer } = await toCall(page);
  const warning = composer.getByRole('combobox', { name: '경고명령' });
  await warning.selectOption('ffe');
  await switchTo(page, '훈련');
  await expect(warning).toHaveValue('adjust');
  await warning.selectOption('ffe');
  await switchTo(page, '표준');
  await expect(warning).toHaveValue('adjust');
});

test('F-07: 표적위치는 모드 전환에 다시 채워진다 — 화면', async ({ page }) => {
  test.setTimeout(60_000);
  const { composer, log, send } = await toCall(page, true);
  await send.click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  const east = composer.getByRole('textbox', { name: '동', exact: true });
  const north = composer.getByRole('textbox', { name: '북', exact: true });
  const polar = composer.getByRole('radio', { name: '극좌표' });
  const grid = composer.getByRole('radio', { name: '좌표', exact: true });

  // 표준 opens on the map's last point (here the 후보), 훈련 on the lase (demo 958–959).
  await expect(east).toHaveValue('4512');
  await east.fill('1111');
  await switchTo(page, '훈련');
  await expect(east).toHaveValue(/^\d{4}$/);
  await expect(east).not.toHaveValue('1111');
  await expect(east).not.toHaveValue('4512');
  const lased = { e: await east.inputValue(), n: await north.inputValue() };

  // 극좌표 chosen and typed over: back to 좌표, with 방위각 from the lase again.
  await polar.check();
  const azimuth = composer.getByRole('textbox', { name: '방위각' });
  const measured = await azimuth.inputValue();
  await azimuth.fill('0800');
  await switchTo(page, '표준');
  await expect(grid).toBeChecked();
  await expect(east).toHaveValue('4512');
  await expect(north).toHaveValue('3256');
  await polar.check();
  await expect(azimuth).toHaveValue(measured);
  await switchTo(page, '훈련');
  await expect(grid).toBeChecked();
  await expect(east).toHaveValue(lased.e);
  await expect(north).toHaveValue(lased.n);
});

test('F-07: 표적성질은 모드 전환에 다시 채워진다 — 화면', async ({ page }) => {
  test.setTimeout(60_000);
  const { composer, log, send } = await toCall(page);
  await send.click();
  await expect(log).toContainText('좌표 송신바람', { timeout: 15_000 });
  await composer.getByRole('textbox', { name: '동', exact: true }).fill('4720');
  await composer.getByRole('textbox', { name: '북', exact: true }).fill('3150');
  await send.click();
  const rounds = composer.getByRole('combobox', { name: '발수' });
  await expect(rounds).toBeVisible({ timeout: 15_000 });
  await rounds.selectOption('1');
  await composer.getByRole('combobox', { name: '신관' }).selectOption('vt');
  await composer.getByRole('combobox', { name: '통제' }).selectOption('amc');
  await composer.getByRole('checkbox', { name: '위험근접' }).check();
  await switchTo(page, '훈련');
  await expect(rounds).toHaveValue('3');
  await expect(composer.getByRole('combobox', { name: '신관' })).toHaveValue('none');
  await expect(composer.getByRole('combobox', { name: '통제' })).toHaveValue('ready');
  await expect(composer.getByRole('checkbox', { name: '위험근접' })).not.toBeChecked();
});

test('F-07: 수정은 모드 전환에 다시 채워진다 — 화면', async ({ page }) => {
  test.setTimeout(180_000);
  dialogs(page);
  const { composer } = await toReady(page, 'ready');
  await speedTo(page, 8);
  const direction = composer.getByRole('textbox', { name: '방향' });
  await expect(direction).toBeVisible({ timeout: 60_000 });
  await speedTo(page, 1);
  const lateral = composer.getByRole('textbox', { name: '좌우 거리' });
  const next = composer.getByRole('combobox', { name: '다음' });
  await expect(direction).toHaveValue('');
  await direction.fill('0800');
  await lateral.fill('50');
  await next.selectOption('ffe');

  // 훈련: 방향 from the view's aim and the 탄착 편의 line; what was typed and chosen is gone.
  await switchTo(page, '훈련');
  await expect(composer.getByText(/탄착 (편의|부근)/)).toBeVisible();
  await expect(direction).toHaveValue(/^\d{1,4}$/);
  await expect(direction).not.toHaveValue('0800');
  await expect(next).toHaveValue('adjust');
  await next.selectOption('ffe');

  // 표준: empty again, no help, nothing suggested.
  await switchTo(page, '표준');
  await expect(direction).toHaveValue('');
  await expect(lateral).toHaveValue('0');
  await expect(next).toHaveValue('adjust');
  await expect(composer.getByText(/탄착 (편의|부근)/)).toHaveCount(0);
});

/** 바로 효력사 on the fixed seed, at ×8, until its 효과 form opens. */
async function toEffect(page: Page) {
  dialogs(page);
  const { composer, log, send } = await toReady(page, 'ready', 'ffe');
  await speedTo(page, 8);
  await expect(composer).toContainText('효과를 관측하십시오.', { timeout: 90_000 });
  await speedTo(page, 1);
  return { composer, log, send };
}

test('F-07: 효과 보고는 모드 전환에 다시 채워진다 — 화면', async ({ page }) => {
  test.setTimeout(180_000);
  const { composer } = await toEffect(page);
  const effect = composer.getByRole('combobox', { name: '효과' });
  const action = composer.getByRole('combobox', { name: '다음 조치' });
  await effect.selectOption('ineffective');
  await action.selectOption('corr');
  const direction = composer.getByRole('textbox', { name: '방향' });
  await direction.fill('0800');
  await switchTo(page, '훈련');
  await expect(effect).toHaveValue('neutralized');
  await expect(action).toHaveValue('eom');
  await expect(direction).toHaveCount(0);
});

test('F-07: 전이사격은 모드 전환에 다시 채워진다 — 화면', async ({ page }) => {
  test.setTimeout(180_000);
  const { composer, log, send } = await toEffect(page);
  await send.click(); // 임무끝
  await expect(log).toContainText('임무끝', { timeout: 10_000 });
  const shift = page.getByRole('region', { name: '전이사격' });
  const direction = shift.getByRole('textbox', { name: '방향' });
  await expect(direction).toBeVisible({ timeout: 15_000 });
  await expect(direction).toHaveValue('');
  await direction.fill('0800');
  await shift.getByRole('textbox', { name: '좌우 거리' }).fill('104');
  await shift.getByRole('combobox', { name: '발수' }).selectOption('2');
  await shift.getByRole('checkbox', { name: '위험근접' }).check();

  await switchTo(page, '훈련');
  await expect(direction).toHaveValue(/^\d{1,4}$/);
  await expect(direction).not.toHaveValue('0800');
  await expect(shift.getByRole('textbox', { name: '좌우 거리' })).toHaveValue('0');
  await expect(shift.getByRole('combobox', { name: '발수' })).toHaveValue('3');
  await expect(shift.getByRole('checkbox', { name: '위험근접' })).not.toBeChecked();

  await direction.fill('0800');
  await switchTo(page, '표준');
  await expect(direction).toHaveValue('');
  await expect(composer.getByRole('combobox', { name: '경고명령' })).toHaveValue('adjust');
});
