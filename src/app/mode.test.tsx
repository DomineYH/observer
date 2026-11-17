// 모드 고르기와 작전 준비 시간 제한 (M3-10, #115 ⑪·⑫): choosing 실전 makes a new game; 실전's 작전 준비 runs out at 300 s.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { COMBAT } from '@content/combat';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { mockWeather } from '@adapters/mock/weather';
import type { Mode, Phase, SimInit } from '@sim';
import { HeadBand, ModeSwitch } from '@ui/HeadBand';
import { InfoCard } from '@ui/InfoCard';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { newGame, remade, type Game } from './game';
import { prepLimit } from './prepLimit';

const practice = async (mode: Mode = 'training'): Promise<SimInit> => ({
  seed: 1234,
  seedKind: 'practice',
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: await mockWeather.load(1234, 'practice', 'clear'),
  mode, // a new game opens in 훈련 (main.tsx)
  terrain: flatTerrain(),
});
const PICK = { a: 'pick', v: [300, 340] } as const;
const START = { a: 'start', v: [300, 340] } as const;
/** Steps until the game is live. */
const begin = (g: Game) => {
  g.session.send(START);
  for (let k = 0; k < 3; k++) g.session.step();
  expect(g.sim.state.phase).toBe('live');
};

test('실전: 모드 고르기 — 작전 준비에서 고르면 판을 새로 만들고 관측소 후보를 남기며 작전 개시 뒤에는 잠긴다', async () => {
  const a = newGame(await practice());
  a.session.send(PICK);
  a.session.step();

  // Into 실전 in 작전 준비: a new simulation and an empty 입력 기록, made combat, with the 관측소 후보 put in again.
  const b = remade(a, 'combat', COMBAT)!;
  expect(b.sim).not.toBe(a.sim);
  expect(b.session.log).toEqual([]);
  expect(b.init.mode).toBe('combat');
  expect(b.init.combat).toBe(COMBAT);
  b.session.step();
  expect(b.sim.state.mode).toBe('combat');
  expect(b.sim.state.op).toEqual({ x: 300, y: 340 });
  expect(b.session.log).toEqual([{ t: 0, ...PICK }]);

  // Out of 실전 into 표준: the same, a standard game by its 생성 인자 with no mode input and no 실전 자료.
  const c = remade(b, 'standard', COMBAT)!;
  expect(c.sim).not.toBe(b.sim);
  expect(c.session.log).toEqual([]);
  expect(Object.hasOwn(c.init, 'combat')).toBe(false);
  c.session.step();
  expect(c.sim.state.mode).toBe('standard');
  expect(c.sim.state.op).toEqual({ x: 300, y: 340 });
  expect(c.session.log).toEqual([{ t: 0, ...PICK }]);

  // 훈련↔표준 stays the mode input: no new game. Nor is choosing the mode the game is in.
  expect(remade(c, 'training', COMBAT)).toBeNull();
  expect(remade(c, 'standard', COMBAT)).toBeNull();
  expect(remade(b, 'combat', COMBAT)).toBeNull();

  // After 작전 개시 nothing makes a new game.
  begin(b);
  begin(c);
  for (const m of ['training', 'standard'] as const) expect(remade(b, m, COMBAT)).toBeNull();
  expect(remade(c, 'combat', COMBAT)).toBeNull();

  // The 머리띠 메뉴's three buttons: free in 작전 준비; after 작전 개시 a combat game locks all three, a training or
  // standard game 실전 only.
  const locked = (mode: Mode, phase: Phase) =>
    [
      ...renderToStaticMarkup(<ModeSwitch mode={mode} paused={false} phase={phase} onMode={() => {}} />).matchAll(
        /<button[^>]*?( disabled="")?>(.+?)<\/button>/g,
      ),
    ].map((m) => [m[2], !!m[1]]);
  for (const m of ['training', 'standard', 'combat'] as const)
    expect(locked(m, 'prep'), m).toEqual([
      ['훈련', false],
      ['표준', false],
      ['실전', false],
    ]);
  expect(locked('combat', 'live')).toEqual([
    ['훈련', true],
    ['표준', true],
    ['실전', true],
  ]);
  for (const m of ['training', 'standard'] as const)
    expect(locked(m, 'live'), m).toEqual([
      ['훈련', false],
      ['표준', false],
      ['실전', true],
    ]);

  // The 판 정보 카드's 모드 row: the three, the one in use checked, and 실전's 소개 글 under them.
  const card = (mode: Mode) =>
    renderToStaticMarkup(
      <InfoCard seed={1234} seedKind="practice" weather={a.init.weather} preset="clear" onPreset={() => {}} scenario="보병 중대" scenarios={[]} mode={mode} onMode={() => {}} />,
    );
  const choices = (html: string) => [...html.matchAll(/<input type="radio" name="mode"( checked="")?\/> ?(.+?)<\/label>/g)].map((m) => [m[2], !!m[1]]);
  expect(choices(card('combat'))).toEqual([
    ['훈련', false],
    ['표준', false],
    ['실전', true],
  ]);
  expect(choices(card('training')).map(([, on]) => on)).toEqual([true, false, false]);
  expect(card('training')).toContain(
    '실전: 적이 더 오고 적 포병이 쏜다. 보조 정보와 일시정지가 없고 작전 준비에 시간 제한이 있으며, 작전 개시 뒤에는 모드를 바꿀 수 없다.',
  );
  // Above the 기상 row (시나리오 → 포 → 모드 → 기상).
  expect(card('training').indexOf('모드')).toBeLessThan(card('training').indexOf('<b>기상</b>'));
});

afterEach(() => void vi.useRealTimers());

test('실전: 작전 준비 시간 제한 — 300초가 지나면 관측소 후보로 작전 개시가 되고 훈련·표준에는 없다', async () => {
  vi.useFakeTimers();
  const limit = prepLimit();
  /** What the 머리띠's 경과 자리 shows for the game. */
  const shown = (g: Game) => {
    const s = g.sim.state;
    const html = renderToStaticMarkup(
      <HeadBand
        tick={s.tick}
        score={0}
        rounds={0}
        mode={s.mode}
        speed={2}
        paused={false}
        phase={s.phase}
        prepLeft={limit.left(s)}
        onSpeed={() => {}}
        onPause={() => {}}
      />,
    );
    return html
      .match(/<output aria-live="off" aria-label="(경과|준비 남은 시간)">(.*?)<\/output>/)!
      .slice(1)
      .join(' ');
  };
  /** The app's loop for `ms` of real time: before each step the limit is checked. */
  const run = (g: Game, ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      limit.check(g);
      g.session.step();
      vi.advanceTimersByTime(50);
    }
  };
  const starts = (g: Game) => g.session.log.filter((i) => i.a === 'start');

  // 훈련 and 표준: no limit, no 남은 시간, no 작전 개시 however long 작전 준비 lasts.
  let g = newGame(await practice());
  g.session.send(PICK);
  run(g, 400_000);
  expect([g.sim.state.phase, starts(g), shown(g)]).toEqual(['prep', [], '경과 00:00']);
  g = newGame(await practice('standard'), g);
  run(g, 400_000);
  expect([g.sim.state.phase, starts(g), shown(g)]).toEqual(['prep', [], '경과 00:00']);

  // 실전: counted from the first time it is chosen, in real time, on through leaving and coming back and new games.
  g = remade(g, 'combat', COMBAT)!;
  limit.chose('combat');
  expect(shown(g)).toBe('준비 남은 시간 준비 5:00');
  run(g, 100_000);
  expect(shown(g)).toBe('준비 남은 시간 준비 3:20');
  g = remade(g, 'standard', COMBAT)!;
  expect(shown(g)).toBe('경과 00:00');
  run(g, 150_000);
  g = remade(g, 'combat', COMBAT)!;
  limit.chose('combat'); // a second choice does not start it again
  expect(shown(g)).toBe('준비 남은 시간 준비 0:50');
  g = newGame({ ...g.init, weather: await mockWeather.load(1234, 'practice', 'fog') }, g); // a weather change
  run(g, 49_950);
  expect([g.sim.state.phase, starts(g), shown(g)]).toEqual(['prep', [], '준비 남은 시간 준비 0:01']);
  // Out: one 작전 개시 at the 관측소 후보, as the button sends it; then the 경과 as before.
  run(g, 1_000);
  expect(starts(g)).toEqual([{ t: 0, ...START }]);
  expect(g.sim.state.phase).toBe('live');
  expect(shown(g)).toMatch(/^경과 00:0\d$/);

  // Without a 후보, the planned post. Run out while in 표준: nothing, until 실전 is chosen again, then at once.
  const other = prepLimit();
  let h = newGame({ ...(await practice()), terrain: flatTerrain({ n: 600 }) }); // holds the planned post (5120, 1800)
  h = remade(h, 'combat', COMBAT)!;
  other.chose('combat');
  h = remade(h, 'standard', COMBAT)!;
  for (let t = 0; t < 301_000; t += 50) {
    other.check(h);
    h.session.step();
    vi.advanceTimersByTime(50);
  }
  expect([h.sim.state.phase, starts(h)]).toEqual(['prep', []]);
  h = remade(h, 'combat', COMBAT)!;
  other.check(h);
  other.check(h); // twice before the step: still one
  h.session.step();
  const { x, y } = BASE_SCENARIO.plannedOp;
  expect(starts(h)).toEqual([{ t: 0, a: 'start', v: [x, y] }]);
  expect(h.sim.state.phase).toBe('live');
});
