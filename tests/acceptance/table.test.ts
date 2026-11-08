// PRD 6장 수치표 (spec 동등성 테스트): one test for every row. Most rows are tested where their feature is (ROWS names
// each one's test); the rows no earlier slice tested are here, through the simulation's public interface only.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { createSim, heightAt, signalAt, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { dist, mortarAt, oneUnit, run, started, until } from './enemy';
import { init, START } from './init';
import { flatTerrain } from './terrain';

// A straight approach from the north onto the observer's position, 3 km long (as the F-12 tests).
const NORTH = [
  { x: 320, y: 3600 },
  { x: 320, y: 2100 },
  { x: 320, y: 600 },
];
const extent = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)]!;

describe('수치표: 빠진 행', () => {
  test('수치표: 빠진 행 — 적 편제', () => {
    // Heading north: x runs across the unit, y along it.
    const sim = started(oneUnit({ type: 'inf', route: 'B', t0: 0 }, NORTH));
    run(sim, 20);
    const p = () => sim.state.platoons[0]!;
    expect(p().state).toBe('approach');
    expect(p().members.map((m) => m.kind)).toEqual(Array(30).fill('man'));
    // 접근 종대: three squad columns of ten, 80 m across × 72 m deep.
    const across = p().members.map((m) => m.x - p().x);
    const along = p().members.map((m) => m.y - p().y);
    const squads = [-1, 0, 1].map((k) => across.filter((u) => Math.round(u / 40) === k));
    const mid = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(squads.map((q) => q.length)).toEqual([10, 10, 10]);
    // The outer columns' centres are 80 m apart (each man also sways ±2 m and stands a little off his file).
    expect(Math.abs(mid(squads[2]!) - mid(squads[0]!) - 80)).toBeLessThan(4);
    expect(Math.abs(extent(along) - 72)).toBeLessThan(6);
    // 횡대 once deployed: about 150 m across × 30 m deep.
    until(sim, () => p().state === 'assault');
    expect(p().form).toBeGreaterThan(0.99);
    const wide = p().members.map((m) => m.x - p().x);
    const deep = p().members.map((m) => m.y - p().y);
    // Measured on this seed: 155 m across, the middle 80 % of the men 18 m deep (each man stands up to ±10 m off the line).
    expect(Math.abs(extent(wide) - 150)).toBeLessThan(15);
    expect(pct(deep, 0.9) - pct(deep, 0.1)).toBeGreaterThan(10);
    expect(pct(deep, 0.9) - pct(deep, 0.1)).toBeLessThan(45);
  });

  test('수치표: 빠진 행 — 목업 시나리오 편제', () => {
    // 정찰조 4명(0초) · 보병 1소대 30명(90초) · 2소대 30명(200초) · 장갑차 2대(260초) · 82mm 박격포 3문+사수 9명(고정).
    const sim: Sim = createSim(init(20261106));
    sim.step([START]);
    const first: number[] = sim.state.platoons.map(() => -1);
    const spot = { x: sim.state.platoons[4]!.x, y: sim.state.platoons[4]!.y };
    for (;;) {
      sim.state.platoons.forEach((p, i) => {
        if (first[i] === -1 && p.state !== 'wait') first[i] = sim.state.tick;
      });
      if (sim.state.tick >= 5300) break;
      sim.step([]);
    }
    // The second at which each unit sets off (or digs in): the first tick after 작전 개시 for the 0 s ones.
    expect(sim.state.platoons.map((p, i) => [p.type, p.members.length, first[i]! / 20])).toEqual([
      ['recon', 4, 0.05],
      ['inf', 30, 90],
      ['inf', 30, 200],
      ['apc', 2, 260],
      ['mortar', 12, 0.05],
    ]);
    const mortar = sim.state.platoons[4]!;
    expect(mortar.state).toBe('emplaced');
    expect([mortar.members.filter((m) => m.kind === 'tube').length, mortar.members.filter((m) => m.kind === 'man').length]).toEqual([3, 9]);
    expect({ x: mortar.x, y: mortar.y }).toEqual(spot); // 고정: the same spot 265 s on
  });

  test('수치표: 빠진 행 — 박격포 연기 약 60 m', () => {
    const sim = started(mortarAt({ x: 320, y: 1320 }));
    until(sim, () => sim.state.effects.some((e) => e.kind === 'muzzle'));
    const e = sim.state.effects.find((q) => q.kind === 'muzzle')!;
    const ground = heightAt(flatTerrain(), e.x, e.y);
    let top = 0;
    for (let t = e.tick; t < e.tick + e.life; t++) top = Math.max(top, signalAt(e, t, CLEAR_WEATHER).z - ground);
    // 11 s of 5 m/s rise from 1 m above the 1 m-high flash: about 57 m at its end.
    expect(e.life).toBe(220);
    expect(top).toBeGreaterThanOrEqual(55);
    expect(top).toBeLessThanOrEqual(60);
  });

  test('수치표: 빠진 행 — 포대 위치', () => {
    const b = BASE_SCENARIO.battery;
    // The demo's battery (demo line 210), kept over the PRD's "약 9 km" (host decision Q1): south of the planned post and
    // off the map, 6.5 km from 1번 고지 and 10.8–12.3 km from the NAIs where the targets are.
    expect(b).toEqual({ x: 4200, y: -4600 });
    expect(b.y).toBeLessThan(0);
    expect(b.y).toBeLessThan(BASE_SCENARIO.plannedOp.y);
    expect(dist(b, BASE_SCENARIO.plannedOp)).toBeCloseTo(6466, 0);
    for (const n of BASE_SCENARIO.nais) {
      expect(dist(b, n)).toBeGreaterThan(10000);
      expect(dist(b, n)).toBeLessThan(12500);
    }
  });
});

/** Every PRD 6장 row (and the 몬테카를로 paragraph under the table) with the tests that check it: [row, file, test name]. */
const ROWS: [string, string, string][] = [
  ['시뮬 · 시간 간격', 'src/app/loop.test.ts', '프레임 루프: 0.1초 자르기'],
  ['시뮬 · 시간 간격 (배속)', 'src/app/loop.test.ts', 'F-14: 배속과 일시정지는 기록되지 않는다 — 프레임당 틱'],
  ['시뮬 · 시간 간격 (최대 40스텝)', 'src/app/loop.test.ts', '수치표: 빠진 행 — 프레임당 최대 40스텝'],
  ['시뮬 · 난수 (M1은 레이저 스트림을 더한다, B6)', 'src/sim/rng.test.ts', 'six streams in fixed order, salted from the seed like the demo plus a laser stream'],
  ['시뮬 · 작전 시간 한도', 'tests/acceptance/end.test.ts', 'F-13: 시간 한도로 종료'],
  ['적 · 편제', 'tests/acceptance/table.test.ts', '수치표: 빠진 행 — 적 편제'],
  ['적 · 편제 (전개)', 'tests/acceptance/enemy.test.ts', 'F-12: 접근·전개·돌격'],
  ['적 · 접근 속도', 'tests/acceptance/enemy.test.ts', 'F-12: 접근·전개·돌격'],
  ['적 · 돌격 속도', 'tests/acceptance/enemy.test.ts', 'F-12: 접근·전개·돌격'],
  ['적 · 피격 반응', 'tests/acceptance/kills.test.ts', '소대 중심 220 m 안에 떨어지면 35–65초 엎드려 멈추고, 밖이면 계속 간다'],
  ['적 · 상태 변화', 'tests/acceptance/kills.test.ts', 'F-12: 무력화와 파괴'],
  ['적 · 상태 변화 (효과 보고 정답)', 'tests/acceptance/effect.test.ts', 'B1: 전과 보고는 받아들인 입력에 한 번'],
  ['적 · 진지 돌파', 'tests/acceptance/end.test.ts', 'F-13: 진지 돌파'],
  ['적 · 조기 격퇴', 'tests/acceptance/kills.test.ts', '효력사가 사상 60%를 넘기면 파괴, 돌격선 전이면 조기 격퇴 +50'],
  ['탄도 · 포대 (6문)', 'tests/acceptance/lethality.test.ts', '포대 방렬: 6문 W자, 횡 120 m × 종 44 m'],
  ['탄도 · 포대 (위치)', 'tests/acceptance/table.test.ts', '수치표: 빠진 행 — 포대 위치'],
  ['탄도 · 비과시간', 'tests/acceptance/fire.test.ts', '탄착은 발사 3초 + 2.6초/km 뒤다'],
  ['탄도 · 사거리 공산오차', 'tests/acceptance/fire.test.ts', '비표준 조건 오차와 공산오차는 수치표를 따르고 탄도 스트림만 쓴다'],
  ['탄도 · 편의 공산오차', 'tests/acceptance/fire.test.ts', '비표준 조건 오차와 공산오차는 수치표를 따르고 탄도 스트림만 쓴다'],
  ['탄도 · 비표준 조건 오차', 'tests/acceptance/fire.test.ts', '비표준 조건 오차와 공산오차는 수치표를 따르고 탄도 스트림만 쓴다'],
  ['탄도 · 비표준 조건 오차 (기상 잔차)', 'tests/acceptance/weather.test.ts', 'F-17: 탄도 잔차'],
  ['탄도 · 포대 방렬', 'tests/acceptance/lethality.test.ts', '포대 방렬: 6문 W자, 횡 120 m × 종 44 m'],
  ['탄도 · 수정탄', 'tests/acceptance/fire.test.ts', '수정탄은 중앙 포 한 발만 떨어진다'],
  ['탄도 · 수정탄 (중앙 포)', 'tests/acceptance/fire.test.ts', '수정탄은 포대 중앙의 조준점에 떨어진다'],
  ['탄도 · 수정탄 (순발신관)', 'tests/acceptance/ffe.test.ts', '접근신관 효력사는 공중 파열로 알려지고 수정탄은 순발이다'],
  ['탄도 · 효력사 간격', 'tests/acceptance/ffe.test.ts', 'F-07: 바로 효력사'],
  ['수정 · 단위·기준선 (단위)', 'tests/acceptance/fire.test.ts', '좌우는 10 m, 사거리는 50 m로 맞추고 0이 된 축은 뺀다'],
  ['수정 · 단위·기준선 (기준선)', 'tests/acceptance/fire.test.ts', '첫 수정은 방향이 있어야 하고 그 방향을 기준선으로 옮긴다'],
  ['수정 · 단위·기준선 (위험근접 상한)', 'tests/acceptance/danger.test.ts', 'F-07: 위험근접 100 m 상한'],
  ['살상 · 모델', 'tests/acceptance/lethality.test.ts', '사람: 0.92 × exp(−(r/R)²), 순발 R 서 있음 26 m · 엎드림 15 m'],
  ['살상 · R', 'tests/acceptance/lethality.test.ts', '사람: 접근신관은 파열고 7 m를 넣고 R 서 있음 28 m · 엎드림 24 m'],
  ['판정', 'tests/acceptance/kills.test.ts', 'F-12: 무력화와 파괴'],
  ['아군 · 위험근접 (600 m)', 'tests/acceptance/danger.test.ts', '600 m 경계: 595 m는 걸리고 605 m는 걸리지 않는다'],
  ['아군 · 위험근접 (70 m · −200 · 30 m 손실)', 'tests/acceptance/losses.test.ts', 'F-29: 아군 포탄'],
  ['아군 · 손실 원인', 'tests/acceptance/loss-rates.test.ts', 'F-29: 아군 손실의 확률'],
  ['아군 · 손실 원인 (−10점)', 'tests/acceptance/losses.test.ts', 'F-29: 손실 감점'],
  ['아군 · 직사화기', 'tests/acceptance/friendlies.test.ts', 'F-27: 아군 직사'],
  ['아군 · 직사화기 (잔존 비례)', 'tests/acceptance/losses.test.ts', 'F-27: 직사는 잔존 병력에 비례 — 판에서'],
  ['관측반 · 도보 이동 속도', 'tests/acceptance/move.test.ts', 'F-21: 도보 속도'],
  ['관측반 · 장비 설치', 'tests/acceptance/move.test.ts', 'F-21: 이동 중 제한과 장비 설치 — 도착 30초 뒤 장비를 쓴다 (설치 중 쌍안경)'],
  ['관측반 · 이동 한계', 'tests/acceptance/move.test.ts', 'B2: 이동의 네 변 가장자리'],
  ['관측반 · 이동 한계 (전방 1.3배)', 'tests/acceptance/exposure.test.ts', 'F-21: 발각 확률과 배율'],
  ['적 · 목업 시나리오 편제', 'tests/acceptance/table.test.ts', '수치표: 빠진 행 — 목업 시나리오 편제'],
  ['적 · 장갑차', 'tests/acceptance/enemy.test.ts', 'F-23: 병종별 행동'],
  ['적 · 장갑차 (살상)', 'tests/acceptance/lethality.test.ts', '장갑차: 순발 R 7 m 근접 직격만, 접근신관은 0.22'],
  ['적 · 박격포반', 'tests/acceptance/enemy.test.ts', 'F-23: 병종별 행동'],
  ['적 · 박격포반 (비과)', 'tests/acceptance/losses.test.ts', 'F-29: 박격포에 의한 손실'],
  ['적 · 박격포반 (엎드리면 중단)', 'tests/acceptance/kills.test.ts', '엎드린 박격포반은 쏘지 않는다'],
  ['적 · 박격포반 (연기)', 'tests/acceptance/table.test.ts', '수치표: 빠진 행 — 박격포 연기 약 60 m'],
  ['적 · 정찰조', 'tests/acceptance/enemy.test.ts', 'F-23: 병종별 행동'],
  ['적 · 정찰조 (승패 밖)', 'tests/acceptance/end.test.ts', 'F-13: 섬멸로 종료'],
  ['몬테카를로 (조준 오차 0 m)', 'tests/acceptance/lethality.test.ts', 'F-12: 몬테카를로 네 값'],
  ['몬테카를로 (40 m · 80 m)', 'tests/acceptance/lethality.test.ts', 'F-12: 조준 오차 범위'],
];
// "155mm 견인포" has no model value (the simulation has no calibre); the PRD's "시드 4242" run is not reproduced (spec).

test('수치표: 모든 행에 테스트', () => {
  const root = new URL('../..', import.meta.url).pathname;
  const missing = ROWS.filter(([, file, name]) => !readFileSync(root + file, 'utf8').includes(`'${name}'`));
  expect(missing).toEqual([]);
  // All 32 rows of the table and the 몬테카를로 paragraph are listed (a row may need several tests).
  expect(new Set(ROWS.map(([row]) => row.replace(/ \(.*\)$/, ''))).size).toBe(33);
});
