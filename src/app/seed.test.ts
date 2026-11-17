import { expect, test } from 'vitest';
import { MODES, type SimInit } from '@sim';
import { mockWeather } from '@adapters/mock/weather';
import { COMBAT } from '@content/combat';
import { BASE_GUNS } from '@content/guns';
import { PLACEMENTS } from '@content/lookup';
import type { Placement } from '@content/placement';
import { BASE } from '@content/scenarios/base';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { battlefieldOf, placementOf } from './backend';
import { newGame } from './game';
import { replayOf } from './records';
import { chooseSeed, dailyScenario, dailySeed, kstDate, placementFor } from './seed';

test('F-30: 일일 시드와 연습 시드', () => {
  // The daily seed is the KST calendar date: KST runs 9 hours ahead of UTC.
  expect(dailySeed(2026, 11, 6)).toBe(20261106);
  expect(kstDate(Date.UTC(2026, 10, 5, 15, 0))).toEqual({ y: 2026, m: 11, d: 6 });
  expect(kstDate(Date.UTC(2026, 10, 6, 14, 59, 59, 999))).toEqual({ y: 2026, m: 11, d: 6 });
  expect(kstDate(Date.UTC(2026, 10, 6, 15, 0))).toEqual({ y: 2026, m: 11, d: 7 });
  expect(kstDate(Date.UTC(2026, 11, 31, 15, 0))).toEqual({ y: 2027, m: 1, d: 1 });

  // Without ?seed= the same KST date gives the same daily seed all day long.
  for (const now of [Date.UTC(2026, 10, 5, 15, 0), Date.UTC(2026, 10, 6, 3, 30), Date.UTC(2026, 10, 6, 14, 59, 59, 999)])
    expect(chooseSeed('', now)).toEqual({ seed: 20261106, seedKind: 'daily' });
  expect(chooseSeed('?fps=1', Date.UTC(2026, 10, 6, 15, 0))).toEqual({ seed: 20261107, seedKind: 'daily' });

  // ?seed= with 1–9 digits is a practice seed; anything else falls back to the daily seed (demo line 188).
  const now = Date.UTC(2026, 10, 6, 0, 0);
  expect(chooseSeed('?seed=1234', now)).toEqual({ seed: 1234, seedKind: 'practice' });
  expect(chooseSeed('?fps=1&seed=999999999', now)).toEqual({ seed: 999999999, seedKind: 'practice' });
  for (const q of ['?seed=', '?seed=abc', '?seed=-5', '?seed=12.5', '?seed=1234567890'])
    expect(chooseSeed(q, now), q).toEqual({ seed: 20261106, seedKind: 'daily' });
});

// A 배치 list made in the test: the mock 기본 시나리오, two daily candidates from D1 and D2, one practice-only 배치 and
// one 배치 on another 전장 that is a candidate there from long ago.
const D1 = 20261201; // 일수 20788
const D2 = 20261210; // 일수 20797
const laid = (id: string, field: string, dailyFrom?: number) => ({
  ...BASE,
  scenario: { ...BASE.scenario, id },
  terrain: { id: field, version: 1 },
  ...(dailyFrom === undefined ? {} : { dailyFrom }),
});
const LIST = [laid('base', 'mock'), laid('d1', 'mock', D1), laid('d2', 'mock', D2), laid('practice-only', 'mock'), laid('elsewhere', 'mungyeong', 20260101)];
const ids = (list: readonly { scenario: { id: string } }[]) => list.map((p) => p.scenario.id);

/** Every calendar date from `from` up to and not including `to`, as 8-digit numbers. */
function datesBetween(from: number, to: number): number[] {
  const out: number[] = [];
  const at = (n: number) => Date.UTC(Math.trunc(n / 10000), (Math.trunc(n / 100) % 100) - 1, n % 100);
  for (let ms = at(from); ms < at(to); ms += 86400e3) {
    const t = new Date(ms);
    out.push(dailySeed(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()));
  }
  return out;
}

test('F-30: 일일 판의 시나리오 — 후보가 하나면 기본 시나리오다', () => {
  // The repository's list as it is: no 배치 has a 일일 시작일, so every date gives the 전장's 기본 시나리오. Once one
  // comes in with a start date, the scan stops the day before the first one.
  const starts = PLACEMENTS.map((p) => p.dailyFrom).filter((d) => d !== undefined);
  const dates = datesBetween(20260101, Math.min(20310101, ...starts));
  for (const [backend, id] of [['mock', 'base'], ['real', 'base-mungyeong']] as const) {
    expect(placementOf(backend).scenario.id).toBe(id);
    for (const date of dates) {
      expect(dailyScenario(date, battlefieldOf(backend), PLACEMENTS).scenario.id, `${backend} ${date}`).toBe(id);
      expect(placementFor('', date, 'daily', battlefieldOf(backend), PLACEMENTS).scenario.id, `${backend} ${date}`).toBe(id);
    }
  }
});

test('F-30: 일일 판의 시나리오 — 날짜의 일수 mod 후보 수, 배치 목록의 차례', () => {
  const pick = (date: number) => dailyScenario(date, 'mock', LIST).scenario.id;
  const table: [number, string][] = [
    // before D1: the 기본 시나리오 alone
    [20261106, 'base'],
    [20261130, 'base'],
    // from D1 two candidates, one a day: 일수 20788 is even
    [20261201, 'base'],
    [20261202, 'd1'],
    [20261203, 'base'],
    [20261208, 'd1'],
    [20261209, 'base'], // 20796, even
    // from D2 three candidates in list order, a three-day round: 20797 mod 3 = 1
    [20261210, 'd1'],
    [20261211, 'd2'],
    [20261212, 'base'],
    [20261213, 'd1'],
    [20261231, 'd1'], // 20818 mod 3 = 1
    [20270101, 'd2'], // the year turns: 20819 mod 3 = 2
  ];
  for (const [date, id] of table) expect(pick(date), String(date)).toBe(id);
  // The practice-only 배치 and the other 전장's never come up on the mock 전장, on any date.
  const seen = new Set(datesBetween(20260101, 20280101).map(pick));
  expect([...seen].sort()).toEqual(['base', 'd1', 'd2']);
  // On the other 전장 its own first 배치 is the 기본 시나리오, a candidate alone.
  expect(dailyScenario(20261202, 'mungyeong', LIST).scenario.id).toBe('elsewhere');
});

test('F-30: 일일 판의 시나리오 — 배치를 더해도 시작일 전 날짜의 답은 같다', () => {
  for (const D of [20261215, 20270301]) {
    const more = [...LIST, laid('new', 'mock', D)];
    for (const date of datesBetween(20260101, D)) expect(ids([dailyScenario(date, 'mock', more)]), String(date)).toEqual(ids([dailyScenario(date, 'mock', LIST)]));
    expect(datesBetween(D, 20280101).some((date) => dailyScenario(date, 'mock', more).scenario.id === 'new')).toBe(true);
  }
});

test('F-30: 일일 판의 시나리오는 모드와 무관하다', async () => {
  // A day with three candidates on the test list (D2 + 1 picks d2) and a repository day on both 전장.
  const days: [number, string, readonly Placement[]][] = [
    [20261211, 'mock', LIST],
    [20261106, battlefieldOf('mock'), PLACEMENTS],
    [20261106, battlefieldOf('real'), PLACEMENTS],
  ];
  for (const [date, field, list] of days) {
    const now = Date.UTC(Math.trunc(date / 10000), (Math.trunc(date / 100) % 100) - 1, date % 100, 3); // noon in KST
    const heads = await Promise.all(
      MODES.map(async (mode) => {
        const { seed, seedKind } = chooseSeed('', now);
        const { scenario } = placementFor('', seed, seedKind, field, list);
        const init: SimInit = { seed, seedKind, scenario, guns: BASE_GUNS, weather: await mockWeather.load(seed, seedKind), mode, terrain: flatTerrain(), ...(mode === 'combat' ? { combat: COMBAT } : {}) };
        const game = newGame(init);
        game.session.step();
        const head = replayOf(game.init, game.session.log, game.sim.state.tick);
        expect(head.mode).toBe(mode);
        return { seed: head.seed, seedKind: head.seedKind, scenario: head.scenario };
      }),
    );
    expect(heads[0]!.seed, String(date)).toBe(date);
    expect(heads[0]!.scenario.id, String(date)).toBe(dailyScenario(date, field, list).scenario.id);
    expect(heads, String(date)).toEqual([heads[0], heads[0], heads[0]]);
  }
});

test('F-30: 연습의 시나리오 — scenario 인자', () => {
  const now = Date.UTC(2026, 11, 11, 3); // 2026-12-11 in KST: d2 is the mock 전장's daily scenario on the test list
  const open = (search: string, field = 'mock', list: readonly Placement[] = LIST) => {
    const { seed, seedKind } = chooseSeed(search, now);
    return { seed, seedKind, id: placementFor(search, seed, seedKind, field, list).scenario.id };
  };
  // ?seed=N alone: the 기본 시나리오, on the test list and on the repository's for both builds.
  expect(open('?seed=1234')).toEqual({ seed: 1234, seedKind: 'practice', id: 'base' });
  expect(open('?seed=1234', battlefieldOf('mock'), PLACEMENTS).id).toBe('base');
  expect(open('?seed=1234', battlefieldOf('real'), PLACEMENTS).id).toBe('base-mungyeong');
  // A 배치 of this 전장, practice-only included, and the 기본 시나리오 by its own id.
  for (const id of ['d1', 'd2', 'practice-only', 'base']) expect(open(`?seed=1234&scenario=${id}`).id, id).toBe(id);
  expect(open('?scenario=d1&fps=1&seed=99')).toEqual({ seed: 99, seedKind: 'practice', id: 'd1' });
  expect(open('?seed=1234&scenario=base-mungyeong', battlefieldOf('real'), PLACEMENTS).id).toBe('base-mungyeong');
  // A wrong form, an id not on the list, another 전장's 배치: silently the 기본 시나리오.
  for (const q of ['', 'D1', 'd1 ', '%20d1', 'd1/', 'nope', 'elsewhere', 'base-mungyeong'])
    expect(open(`?seed=1234&scenario=${q}`).id, q).toBe('base');
  expect(open('?seed=1234&scenario=base', battlefieldOf('real'), PLACEMENTS).id).toBe('base-mungyeong');
  // No seed or a wrong one: `scenario` is not read and it is the day's daily game.
  for (const q of ['?scenario=practice-only', '?seed=abc&scenario=practice-only', '?seed=&scenario=d1', '?seed=1234567890&scenario=d1'])
    expect(open(q), q).toEqual({ seed: 20261211, seedKind: 'daily', id: 'd2' });
});
