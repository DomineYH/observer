// 적 움직임과 가시성 (F-12, F-23, F-04): through the simulation's public interface only.
import { describe, expect, test } from 'vitest';
import type { Sim } from '@sim';
import { CLEAR_WEATHER } from '@app/clearWeather';
import { dist, mortarAt, oneUnit, run, started, until, wallTerrain } from './enemy';
import { flatTerrain } from './terrain';

// A straight approach from the north onto the observer's position, 3 km long, waypoint in the middle.
const NORTH = [
  { x: 320, y: 3600 },
  { x: 320, y: 2100 },
  { x: 320, y: 600 },
];
const unit = (sim: Sim) => sim.state.platoons[0]!;
const toGoal = (sim: Sim) => dist(unit(sim), unit(sim).path.at(-1)!);
/** Metres the unit moves in the next tick. */
function stride(sim: Sim): number {
  const { x, y } = unit(sim);
  sim.step([]);
  return dist(unit(sim), { x, y });
}

describe('F-12', () => {
  test('F-12: 접근·전개·돌격', () => {
    const sim = started(oneUnit({ type: 'inf', route: 'B', t0: 10 }, NORTH));
    // Waits for its start time (10 s = 200 ticks), then sets off in the approach column.
    until(sim, () => sim.state.tick === 198);
    expect(stride(sim)).toBe(0);
    expect(unit(sim).state).toBe('wait');
    for (let k = 0; k < 100; k++) expect(stride(sim)).toBeCloseTo(2.2 * 0.05, 9);
    expect(unit(sim).state).toBe('approach');
    expect(unit(sim).form).toBe(0);

    // Inside 1.5 km of the objective it deploys into line, converging with a 20 s time constant.
    until(sim, () => unit(sim).form > 0);
    expect(toGoal(sim)).toBeLessThan(1500);
    expect(toGoal(sim)).toBeGreaterThan(1499);
    run(sim, 399);
    expect(unit(sim).form).toBeCloseTo(1 - Math.exp(-1), 2);

    // From 900 m it assaults: 3.1 m/s at first, tiring towards 1.9 m/s.
    until(sim, () => unit(sim).state === 'assault');
    expect(toGoal(sim)).toBeLessThan(900);
    expect(toGoal(sim)).toBeGreaterThan(899);
    expect(stride(sim)).toBeCloseTo(3.1 * 0.05, 4);
    run(sim, 2398);
    expect(stride(sim)).toBeCloseTo((1.9 + 1.2 * Math.exp(-1)) * 0.05, 4);
    expect(unit(sim).state).toBe('assault');
  });

  test('F-12: 같은 시드와 입력이면 같은 움직임', () => {
    const a = started(oneUnit({ type: 'inf', route: 'B', t0: 0 }, NORTH));
    const b = started(oneUnit({ type: 'inf', route: 'B', t0: 0 }, NORTH));
    run(a, 3000);
    run(b, 3000);
    expect(a.hash()).toBe(b.hash());
    const c = started(oneUnit({ type: 'inf', route: 'B', t0: 0 }, NORTH));
    run(c, 2999);
    expect(c.hash()).not.toBe(a.hash());
  });
});

describe('F-23', () => {
  test('F-23: 병종별 행동', () => {
    // 정찰조: 1.4 m/s to the middle of its route, then holds there with one man up and the rest lying down.
    const short = [
      { x: 320, y: 1400 },
      { x: 320, y: 1000 },
      { x: 320, y: 600 },
    ];
    const recon = started(oneUnit({ type: 'recon', route: 'A', t0: 0 }, short));
    expect(unit(recon).members.map((m) => m.kind)).toEqual(['man', 'man', 'man', 'man']);
    for (let k = 0; k < 50; k++) expect(stride(recon)).toBeCloseTo(1.4 * 0.05, 9);
    expect(unit(recon).members.some((m) => m.prone)).toBe(false);
    until(recon, () => unit(recon).state === 'hold');
    expect(dist(unit(recon), unit(recon).path[1]!)).toBeLessThan(30);
    run(recon, 1);
    expect(stride(recon)).toBe(0);
    expect(unit(recon).members.map((m) => m.prone)).toEqual([false, true, true, true]);
    expect(recon.state.rng.ai.count).toBe(0);

    // 장갑차: 5 m/s, halts 1,300 m short of its objective, fires 6 s later and then every 8–16 s; dust while moving.
    const apc = started(oneUnit({ type: 'apc', route: 'B', t0: 0 }, NORTH));
    expect(unit(apc).members.map((m) => m.kind)).toEqual(['veh', 'veh']);
    for (let k = 0; k < 50; k++) expect(stride(apc)).toBeCloseTo(5 * 0.05, 9);
    const dust = new Set<number>();
    until(apc, () => {
      for (const e of apc.state.effects) if (e.kind === 'dust') dust.add(e.tick);
      return unit(apc).state === 'support';
    });
    const supportAt = apc.state.tick;
    expect(toGoal(apc)).toBeLessThan(1300);
    expect(toGoal(apc)).toBeGreaterThan(1299);
    const dustTicks = [...dust].sort((a, b) => a - b);
    expect(dustTicks[0]).toBe(31); // more than 1.5 s after the start
    for (let i = 1; i < dustTicks.length; i++) expect(dustTicks[i]! - dustTicks[i - 1]!).toBe(31);
    expect(apc.state.effects.filter((e) => e.kind === 'dust' && e.tick === dustTicks.at(-1)).map((e) => e.life)).toEqual([180, 180]);
    expect(stride(apc)).toBe(0);
    const fires: number[] = [];
    let draws = apc.state.rng.ai.count;
    while (fires.length < 6) {
      apc.step([]);
      const shots = apc.state.effects.filter((e) => e.kind === 'muzzle' && e.tick === apc.state.tick);
      if (shots.length) {
        fires.push(apc.state.tick);
        expect(shots.map((e) => [e.small, e.life])).toEqual([[true, 60], [true, 60]]);
        expect(apc.state.rng.ai.count).toBe(draws + 1);
        draws++;
      } else expect(apc.state.rng.ai.count).toBe(draws);
    }
    expect(fires[0]! - supportAt).toBe(120);
    for (let i = 1; i < fires.length; i++) {
      expect(fires[i]! - fires[i - 1]!).toBeGreaterThanOrEqual(160);
      expect(fires[i]! - fires[i - 1]!).toBeLessThanOrEqual(320);
    }
    expect(apc.state.effects.some((e) => e.kind === 'dust' && e.tick > supportAt)).toBe(false);

    // 박격포반: 3 tubes and 9 crew dug in; from 210 s a volley every 45–70 s, smoke from each tube.
    const mortar = started(mortarAt({ x: 320, y: 1320 }));
    expect(unit(mortar).members.filter((m) => m.kind === 'tube')).toHaveLength(3);
    expect(unit(mortar).members.filter((m) => m.kind === 'man')).toHaveLength(9);
    until(mortar, () => mortar.state.tick === 4199);
    expect(unit(mortar).state).toBe('emplaced');
    expect(mortar.state.effects).toEqual([]);
    expect(stride(mortar)).toBe(0);
    const volleys: number[] = [];
    until(mortar, () => {
      const shots = mortar.state.effects.filter((e) => e.tick === mortar.state.tick);
      if (shots.length) {
        volleys.push(mortar.state.tick);
        expect(shots.map((e) => [e.kind, e.small, e.life])).toEqual([0, 1, 2].map(() => ['muzzle', false, 220]));
      }
      return volleys.length === 4;
    });
    expect(volleys[0]).toBe(4200);
    for (let i = 1; i < volleys.length; i++) {
      expect(volleys[i]! - volleys[i - 1]!).toBeGreaterThanOrEqual(900);
      expect(volleys[i]! - volleys[i - 1]!).toBeLessThanOrEqual(1400);
    }
    expect(mortar.state.rng.ai.count).toBe(4);
  });
});

describe('F-04', () => {
  const BINO_ON = { a: 'bino', v: [1] };
  const BINO_OFF = { a: 'bino', v: [0] };
  /** Whether each of the mortar section's crew (1.7 m, standing) and tubes (1.0 m) is seen. */
  const seen = (sim: Sim, kind: 'man' | 'tube') => [...new Set(unit(sim).members.filter((m) => m.kind === kind).map((m) => m.vis))];

  test('F-04: 가시 조건 셋', () => {
    // 각크기: height ÷ distance at least 1.5 mils by eye, 0.3 mils through binoculars (1.7 m: eye ≈ 1.13 km).
    expect(seen(started(mortarAt({ x: 320, y: 1420 })), 'man')).toEqual([true]); // 1,100–1,110 m
    const far = started(mortarAt({ x: 320, y: 1520 })); // 1,200–1,210 m
    expect(seen(far, 'man')).toEqual([false]);
    far.step([BINO_ON]);
    expect(seen(far, 'man')).toEqual([true]);
    const bino = (y: number) => {
      const sim = started(mortarAt({ x: 320, y }));
      sim.step([BINO_ON]);
      return seen(sim, 'man');
    };
    expect(bino(5920)).toEqual([true]); // 5,604–5,609 m: just over 0.3 mils
    expect(bino(6020)).toEqual([false]); // 5,704–5,709 m
    const near = started(mortarAt({ x: 320, y: 1020 })); // 700 m: the tubes are too small by eye, the crew is not
    expect(seen(near, 'man')).toEqual([true]);
    expect(seen(near, 'tube')).toEqual([false]);

    // 시정: hidden where Koschmieder's opacity 1 − exp(−3.912 d / visibility) passes 0.9 (≈ 589 m at 1 km visibility).
    const haze = { ...CLEAR_WEATHER, visibilityM: 1000 };
    expect(seen(started(mortarAt({ x: 320, y: 890 }), { weather: haze }), 'man')).toEqual([true]); // 574–579 m
    const hazy = started(mortarAt({ x: 320, y: 920 }), { weather: haze }); // 604–609 m
    expect(seen(hazy, 'man')).toEqual([false]);
    hazy.step([BINO_ON]);
    expect(seen(hazy, 'man')).toEqual([false]);

    // 가시선: a 6 m wall 80 m in front of the observer hides the crew, but not the smoke rising from its volley.
    const walled = started(mortarAt({ x: 320, y: 1320 }), { terrain: wallTerrain(400, 6) });
    walled.step([BINO_ON]);
    expect(seen(walled, 'man')).toEqual([false]);
    expect(seen(started(mortarAt({ x: 320, y: 1320 })), 'man')).toEqual([true]);
    until(walled, () => walled.state.effects.length > 0);
    expect(walled.state.effects.map((e) => e.vis)).toEqual([false, false, false]); // just fired: still behind the wall
    until(walled, () => walled.state.effects.some((e) => e.vis), 220);
    expect(seen(walled, 'man')).toEqual([false]);
  });

  test('F-04: 신호는 데모의 탐지 크기로 본다', () => {
    // A fresh APC muzzle signal is 1.5 m for detection: 1.6–1.7 mils at 875–920 m, seen by eye the tick it is made.
    const apc = started(oneUnit({ type: 'apc', route: 'B', t0: 0 }, [{ x: 320, y: 2000 }, { x: 320, y: -100 }]));
    until(apc, () => apc.state.effects.some((e) => e.kind === 'muzzle'));
    const shots = apc.state.effects.filter((e) => e.kind === 'muzzle');
    for (const e of shots) expect(Math.abs(dist(e, apc.state.op) - 900)).toBeLessThan(30);
    expect(shots.map((e) => [e.small, e.vis])).toEqual([[true, true], [true, true]]);
  });

  test('F-04: 신호는 데모의 탐지 높이로 본다', () => {
    // Fresh dust is looked for 3 m above where it rises: a 2.5 m ridge 15–55 m short of it hides 1.5 m, but not 3 m.
    const ridge = flatTerrain({ n: 256 }); // 2.5 km square, so the ridge is on the map
    for (let j = 120; j <= 124; j++) for (let i = 0; i < ridge.n; i++) ridge.surface[j * ridge.n + i]! += 2.5; // north 1,200–1,240
    const dusty = started(oneUnit({ type: 'apc', route: 'B', t0: 0 }, [{ x: 320, y: 1320 }, { x: 320, y: 3320 }]), { terrain: ridge });
    until(dusty, () => dusty.state.effects.length > 0);
    expect(dusty.state.effects.map((e) => [e.kind, Math.round(e.y), e.vis])).toEqual([['dust', 1299, true], ['dust', 1254, true]]);
  });

  test('F-04: 가시 여부는 6틱마다, 쌍안경을 바꾸면 바로', () => {
    // A recon walking in from 1.4 km by eye: it comes into view on a tick that is a multiple of 6, never in between.
    const recon = started(oneUnit({ type: 'recon', route: 'A', t0: 0 }, [{ x: 320, y: 1720 }, { x: 320, y: 1000 }, { x: 320, y: 600 }]));
    let was = unit(recon).members.map((m) => m.vis);
    expect(was).toEqual([false, false, false, false]);
    const changes: number[] = [];
    until(recon, () => {
      const now = unit(recon).members.map((m) => m.vis);
      if (now.join() !== was.join()) changes.push(recon.state.tick);
      was = now;
      return now.every((v) => v);
    });
    expect(changes.length).toBeGreaterThan(0);
    for (const t of changes) expect(t % 6).toBe(0);

    // Changing the binoculars recomputes at once; new dust is judged the tick it rises.
    const far = started(mortarAt({ x: 320, y: 1520 }));
    run(far, 2);
    expect(far.state.tick % 6).not.toBe(0);
    far.step([BINO_ON]);
    expect(far.state.tick % 6).not.toBe(0);
    expect(seen(far, 'man')).toEqual([true]);
    far.step([BINO_OFF]);
    expect(seen(far, 'man')).toEqual([false]);
    const apc = started(oneUnit({ type: 'apc', route: 'B', t0: 0 }, NORTH)); // 3 km: dust only through binoculars
    apc.step([BINO_ON]);
    until(apc, () => apc.state.effects.length > 0);
    expect(apc.state.tick % 6).not.toBe(0);
    expect(apc.state.effects.map((e) => e.vis)).toEqual([true, true]);
  });
});
