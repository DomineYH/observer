// 시나리오가 푸는 값 (#136): the numbers a scenario sets, through the simulation's public interface (the 접근로 번호 rule
// from its pure function).
import { expect, test } from 'vitest';
import { createSim, type Scenario, type UnitDef } from '@sim';
import { routeNumber } from '@sim/stateHash';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { unitName } from '@ui/debrief';
import { mortarAt, RESERVE, started } from './enemy';
import { init, START } from './init';

test('상태 해시: 접근로는 글자 차례의 번호다', () => {
  expect((['A', 'B', 'C', 'D', 'Z'] as const).map(routeNumber)).toEqual([1, 2, 3, 4, 26]); // base: 1·2·3 as before
  expect(routeNumber(null)).toBe(0);
  // The same scenario with its routes written in another order: the same state hash, tick after tick.
  const { A, B, C } = BASE_SCENARIO.routes;
  const sims = [BASE_SCENARIO, { ...BASE_SCENARIO, routes: { C, A, B } }].map((scenario) => createSim({ ...init(20261106), scenario }));
  for (let k = 0; k < 400; k++) {
    for (const sim of sims) sim.step(k ? [] : [START]);
    expect(sims[1]!.hash(), `tick ${k}`).toBe(sims[0]!.hash());
  }
  // The letter is what counts: the same unit on the same points under another key hashes apart.
  const P = [{ x: 320, y: 2320 }, { x: 320, y: 1500 }, { x: 320, y: 920 }];
  const on = (k: 'A' | 'D' | 'Z') => createSim({ ...init(7), scenario: { ...BASE_SCENARIO, routes: { [k]: P }, intelRoutes: [], units: [{ type: 'inf', route: k, t0: 0 }], friends: [] } }).hash();
  expect(new Set([on('A'), on('D'), on('Z')]).size).toBe(3);
});

test('시나리오: 작전 시간 한도와 박격포 사격 개시는 시나리오 자료에서 읽는다', () => {
  // Two mortar sections 1 km north of the flat terrain's post with their own 사격 개시 (100 s, 150 s), and a 5분 한도.
  const tube = (fireFromS: number): UnitDef => ({ type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0, fireFromS });
  const scenario: Scenario = { ...mortarAt({ x: 320, y: 1320 }), timeLimitS: 300, units: [tube(100), tube(150), RESERVE] };
  const sim = started(scenario);
  const first = [-1, -1];
  while (sim.state.phase === 'live') {
    sim.step([]);
    sim.state.platoons.slice(0, 2).forEach((p, i) => {
      if (first[i] === -1 && p.lastFire >= 0) first[i] = p.lastFire;
    });
  }
  expect(first).toEqual([2000, 3000]); // each from its own second, not 210 s
  expect(sim.state.tick).toBe(6000); // 300 s, not 40분
  expect(sim.record().ticks).toBe(6000);
});

test('시나리오: 같은 종류의 부대가 둘 이상이면 이름에 번호가 붙는다', () => {
  const names = (units: readonly UnitDef[]) => {
    const { platoons } = createSim({ ...init(7), scenario: { ...BASE_SCENARIO, units } }).state;
    return platoons.map((_, pid) => unitName(platoons, pid));
  };
  // One of a kind keeps today's name; infantry is always numbered.
  expect(names(BASE_SCENARIO.units)).toEqual(['적 정찰조', '적 1소대', '적 2소대', '적 장갑차', '적 박격포반']);
  expect(names([{ type: 'inf', route: 'B', t0: 0 }])).toEqual(['적 1소대']);
  // Two of a kind: numbered in list order, the other kinds as before.
  const apc: UnitDef = { type: 'apc', route: 'A', t0: 0 };
  const mortar: UnitDef = { type: 'mortar', nai: 2, spread: { x: 700, y: 500 }, t0: 0, fireFromS: 210 };
  expect(names([{ type: 'recon', route: 'A', t0: 0 }, apc, apc, { type: 'inf', route: 'A', t0: 0 }, mortar])).toEqual(['적 정찰조', '적 장갑차 1', '적 장갑차 2', '적 1소대', '적 박격포반']);
  expect(names([mortar, { type: 'recon', route: 'A', t0: 0 }, mortar, { type: 'recon', route: 'B', t0: 0 }])).toEqual(['적 박격포반 1', '적 정찰조 1', '적 박격포반 2', '적 정찰조 2']);
});
