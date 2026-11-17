import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { CLEAR_WEATHER, mockWeather } from '@adapters/mock/weather';
import { BASE_GUNS } from '@content/guns';
import { GUNS } from '@content/lookup';
import { inRange } from '@content/range';
import type { Scenario, SeedKind, SimInit } from '@sim';
import { gunChoices, InfoCard } from '@ui/InfoCard';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { NO_ENEMY } from '../../tests/acceptance/session';
import { newGame, regunned } from './game';
import { submissionOf } from './records';

const profile = (id: string) => GUNS.find((g) => g.profile.id === id)!.profile;
const at = async (seedKind: SeedKind, scenario: Scenario = NO_ENEMY): Promise<SimInit> => ({
  seed: seedKind === 'daily' ? 20261106 : 1234,
  seedKind,
  scenario,
  guns: BASE_GUNS,
  weather: await mockWeather.load(1234, seedKind, seedKind === 'practice' ? 'fog' : undefined),
  mode: 'standard',
  terrain: flatTerrain(),
});
const card = (seedKind: SeedKind, gun: string, scenario: Scenario = NO_ENEMY) =>
  renderToStaticMarkup(
    <InfoCard
      seed={1234}
      seedKind={seedKind}
      weather={CLEAR_WEATHER}
      preset={seedKind === 'practice' ? 'clear' : null}
      onPreset={() => {}}
      scenario="이름"
      scenarios={[]}
      mode="training"
      onMode={() => {}}
      gun={gun}
      guns={gunChoices(scenario)}
      onGun={() => {}}
    />,
  );

test('F-30: 연습의 포 고르기 — 작전 준비에서만 바꾸고 판을 새로 만든다', async () => {
  const a = newGame({ ...(await at('practice')), scenario: { ...NO_ENEMY, timeLimitS: 30 } });
  a.session.send({ a: 'pick', v: [300, 340] });
  a.session.send({ a: 'mode', v: ['training'] });
  a.session.step();
  // A new simulation and an empty 입력 기록 with the chosen gun; the 관측소 후보 and the mode are put in again.
  const b = regunned(a, 'k9')!;
  expect(b.sim).not.toBe(a.sim);
  expect(b.init).toEqual({ ...a.init, guns: profile('k9') });
  expect(b.session.log).toEqual([]);
  b.session.step();
  expect(b.session.log).toEqual([
    { t: 0, a: 'pick', v: [300, 340] },
    { t: 0, a: 'mode', v: ['training'] },
  ]);
  expect([b.sim.state.picked, b.sim.state.mode]).toEqual([true, 'training']);
  // The card shows the gun in use with its select, and every gun on offer.
  const html = card('practice', 'k9');
  expect(html).toContain('<b>포</b> K9 155mm 자주포');
  expect(html).toMatch(/<label>포 바꾸기 <select>/);
  expect(html.indexOf('<b>시나리오</b>')).toBeLessThan(html.indexOf('<b>포</b>')); // 시나리오 → 포 → 모드 (#130 Q2)
  expect(html.indexOf('<b>포</b>')).toBeLessThan(html.indexOf('<b>모드</b>'));
  for (const g of GUNS) expect(html).toContain(`<option value="${g.profile.id}"${g.profile.id === 'k9' ? ' selected=""' : ''}>${g.name}</option>`);
  // After 작전 개시 the gun stays.
  b.session.send({ a: 'start', v: [300, 340] });
  b.session.step();
  expect(b.sim.state.phase).toBe('live');
  expect(regunned(b, 'kh179')).toBeNull();
  // The ended game's 재생 자료 carries the chosen gun's id and version.
  while (b.sim.state.phase !== 'ended') b.session.step();
  expect(submissionOf('참새12', b.sim, b.init, b.session.log).replay.guns).toEqual({ id: 'k9', version: 1 });
});

test('F-30: 일일 판의 포는 기본 포이고 읽기만이다', async () => {
  const daily = newGame(await at('daily'));
  expect(daily.init.guns).toBe(BASE_GUNS);
  for (const g of GUNS) expect(regunned(daily, g.profile.id)).toBeNull();
  // The gun's name with the dotted tag, and no place to choose one.
  const html = card('daily', 'base');
  expect(html).toMatch(/<b>포<\/b> 155mm 견인포 <span class="info-tag">일일 · 읽기만<\/span>/);
  expect(html).not.toContain('포 바꾸기');
  expect(html).not.toContain('<select');
});

test('포 프로파일: 사거리 밖의 포는 고를 수 없다', async () => {
  // The battery 3 km further back: 105mm no longer reaches the 싸움터, the 기본 포 still does.
  const far: Scenario = { ...NO_ENEMY, battery: { ...NO_ENEMY.battery, y: NO_ENEMY.battery.y - 3000 } };
  expect([inRange(far, profile('kh178')), inRange(far, BASE_GUNS)]).toEqual([false, true]);
  expect(gunChoices(far).map((g) => [g.id, g.out])).toEqual(GUNS.map((g) => [g.profile.id, g.profile.id === 'kh178']));
  expect(card('practice', 'base', far)).toContain('<option value="kh178" disabled="">KH178 105mm 견인포 — 사거리 밖</option>');
  expect(gunChoices(NO_ENEMY).some((g) => g.out)).toBe(false);
  // A pair from outside that does not meet the check, or an unknown gun, goes back to the 기본 포.
  const game = regunned(newGame(await at('practice', far)), 'k9')!;
  expect(game.init.guns).toBe(profile('k9'));
  expect(regunned(game, 'kh178')!.init.guns).toBe(BASE_GUNS);
  expect(regunned(game, 'm777')!.init.guns).toBe(BASE_GUNS);
  expect(regunned(newGame(await at('practice', far)), 'kh178')).toBeNull(); // already on the 기본 포: no new game
});
