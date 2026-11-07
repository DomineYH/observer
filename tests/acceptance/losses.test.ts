// 아군 손실 (#35, F-29, B6): the friendly positions lose men to the enemy mortar, to enemy infantry within 400 m and to
// our own rounds within 70 m of a position; every man lost costs 10 points.
// Public interface only: create, step, events, read-only state, state hash, record.
import { describe, expect, test } from 'vitest';
import { enemyFireChance, friendlyLossChance, type ImpactEvent, type Point, type ReadonlySimState, type Scenario, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { dist, oneUnit, started, until } from './enemy';
import { CALL_ADJUST, CALL_FFE, DESC_UNKNOWN, answered, corr, desc, openRadio, send, untilTaken } from './mission';
import { gridAt, isImpact } from './strike';
import { flatTerrain } from './terrain';

// A 2.56 km flat field: the post at (320, 320), one friendly position.
const FRIEND = { x: 1280, y: 1200 };
const field = () => flatTerrain({ n: 256 });
const MORTAR = { x: 1280, y: 2400 };
// One enemy platoon walking onto the position from 1.5 km (as the F-27 tests).
const ONTO = [{ x: 1280, y: 2700 }, { x: 1280, y: 1800 }, FRIEND];
const assault = (): Scenario => ({ ...oneUnit({ type: 'inf', route: 'B', t0: 0 }, ONTO), friends: [FRIEND] });
/** The mortar section dug in at `at`, firing on our position from 210 s. */
const shelling = (at: Point = MORTAR): Scenario => ({
  ...oneUnit({ type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0 }),
  nais: [{ ...at, r: 100, conf: 'low' }],
  friends: [FRIEND],
});

/** Our position alone on the field (or `scenario`), radio open, `wait` ticks on, and an adjusting mission (위험근접
 * declared) whose first round is aimed at `at`: the grid takes off the mission's bias. */
function adjusting(at: Point, seed: number, scenario: Scenario = { ...BASE_SCENARIO, units: [], friends: [FRIEND] }, wait = 0): Sim {
  const sim = started(scenario, { seed, terrain: field() });
  openRadio(sim);
  while (sim.state.tick < wait) sim.step([]);
  if (!send(sim, CALL_ADJUST).ok) throw new Error('call ignored');
  answered(sim, 'call');
  const b = sim.state.missions[0]!.bias;
  if (!send(sim, gridAt({ x: at.x - b.x, y: at.y - b.y })).ok) throw new Error('loc ignored');
  answered(sim, 'loc');
  if (!send(sim, desc(3, 'none', 'ready', 1, 'unknown')).ok) throw new Error('desc ignored');
  return sim;
}

/** Steps until our next round lands; what that step did to our men, the score and the ballistics stream. */
function nextRound(sim: Sim) {
  for (let k = 0; k < 4000; k++) {
    const was = sim.state.friendlies.map((m) => m.alive);
    const bal = sim.state.rng.bal.count;
    const score = sim.state.score;
    const events = sim.step([]).events;
    const impact = events.find(isImpact);
    if (!impact) continue;
    const men = sim.state.friendlies;
    return {
      impact,
      notes: events.filter((e) => e.type === 'post'),
      fell: men.filter((m, i) => was[i] && !m.alive),
      inReach: men.filter((m, i) => was[i] && dist(m, impact) <= 30).length,
      draws: sim.state.rng.bal.count - bal,
      dScore: sim.state.score - score,
    };
  }
  throw new Error('no round landed');
}

type Effect = ReadonlySimState['effects'][number];
const isShell = (e: Effect) => e.kind === 'burst' && e.small && e.pid === -1;
const aliveMen = (sim: Sim) => sim.state.friendlies.filter((m) => m.alive).length;

/** One step: the shell bursts made in it and the friendly men who fell in it (where they lie). */
function watchStep(sim: Sim) {
  const was = sim.state.friendlies.map((m) => m.alive);
  const events = sim.step([]).events;
  const shells = sim.state.effects.filter((e) => isShell(e) && e.tick === sim.state.tick);
  const fell = sim.state.friendlies.filter((m, i) => was[i] && !m.alive);
  return { events, shells, fell };
}

describe('F-29: 아군 손실', () => {
  test('F-29: 박격포에 의한 손실', () => {
    // Model numbers: 15 m 안, 서 있음 30 % / 엎드림 10 %, × exp(−1.5 (r/15)²).
    expect(friendlyLossChance('mortar', 0, false)).toBeCloseTo(0.3, 15);
    expect(friendlyLossChance('mortar', 0, true)).toBeCloseTo(0.1, 15);
    expect(friendlyLossChance('mortar', 15, false)).toBeCloseTo(0.3 * Math.exp(-1.5), 12);
    expect(friendlyLossChance('mortar', 7.5, true)).toBeCloseTo(0.1 * Math.exp(-0.375), 12);
    expect(friendlyLossChance('mortar', 15.01, false)).toBe(0);
    // In a game: each volley's three rounds land 22–26 s after the tubes fire, around the position, and men fall only
    // to a round that has just landed within 15 m of them.
    const sim = started(shelling(), { seed: 3, terrain: field() });
    const volleys: number[] = [];
    const landed: number[] = [];
    const told: number[] = [];
    let lost = 0;
    while (volleys.length < 10 || sim.state.tick < volleys[9]! + 520) {
      const { shells, fell, events } = watchStep(sim);
      for (const e of events) if (e.type === 'post') told.push(e.what === 'shelling' ? e.tick : -1);
      if (sim.state.effects.some((e) => e.kind === 'muzzle' && e.pid === 0 && e.tick === sim.state.tick)) volleys.push(sim.state.tick);
      for (const s of shells) {
        landed.push(s.tick);
        expect(Math.abs(s.x - FRIEND.x)).toBeLessThan(45 * 5);
        expect(Math.abs(s.y - FRIEND.y)).toBeLessThan(35 * 5);
        expect(s.life).toBe(240);
      }
      for (const m of fell) {
        expect(shells.some((s) => dist(s, m) <= 15)).toBe(true);
        expect(m.prone).toBe(true);
      }
      lost += fell.length;
    }
    expect(volleys[0]).toBe(4200);
    expect(told).toEqual([4200 + 520]); // told once, 26 s after the first volley
    expect(landed).toHaveLength(30);
    volleys.forEach((v, i) => {
      for (const t of landed.slice(3 * i, 3 * i + 3)) expect(t - v >= 440 && t - v <= 520).toBe(true);
    });
    expect(lost).toBeGreaterThan(0);
    expect(aliveMen(sim)).toBe(24 - lost);
  }, 30000);

  test('F-29: 적 보병 사격에 의한 손실', () => {
    // Model numbers: 초당 0.12 % × 적 잔존률 × 근접도 (400 − d)/400, 엎드림 ½, per man per 50 ms tick.
    const full = enemyFireChance(1, 0, false);
    expect(full).toBeCloseTo(0.0012 * 0.05, 15);
    expect(enemyFireChance(0.5, 0, false)).toBeCloseTo(full / 2, 15);
    expect(enemyFireChance(1, 200, false)).toBeCloseTo(full / 2, 15);
    expect(enemyFireChance(1, 0, true)).toBeCloseTo(full / 2, 15);
    expect(enemyFireChance(0.5, 300, true)).toBeCloseTo(full / 16, 15);
    expect(enemyFireChance(1, 399.99, false)).toBeGreaterThan(0);
    expect(enemyFireChance(1, 400, false)).toBe(0);
    // In a game: our men fall only while an enemy platoon that is not pinned stands within 400 m; the fallen lie still.
    const sim = started(assault(), { seed: 7, terrain: field() });
    let near = 0;
    let lost = 0;
    for (let k = 0; k < 16000; k++) {
      const was = sim.state.friendlies.map((m) => m.alive);
      sim.step([]);
      const p = sim.state.platoons[0]!;
      const firing = dist(p, FRIEND) < 400 && sim.state.tick >= p.pinnedUntil;
      if (firing) near++;
      sim.state.friendlies.forEach((m, i) => {
        if (!was[i]) expect(m.alive).toBe(false); // never comes back
        if (!m.alive) expect(m.prone).toBe(true);
        if (was[i] && !m.alive) {
          expect(firing).toBe(true);
          lost++;
        }
      });
    }
    expect(near).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
    expect(aliveMen(sim)).toBe(24 - lost);
    // Only infantry fires on us: the recon team holding 200 m from the position never costs us a man.
    const recon = started({ ...oneUnit({ type: 'recon', route: 'B', t0: 0 }, [{ x: 1280, y: 1600 }, { x: 1280, y: 1450 }, { x: 1280, y: 1400 }]), friends: [FRIEND] }, { seed: 7, terrain: field() });
    let held = 0;
    for (let k = 0; k < 12000; k++) {
      recon.step([]);
      if (dist(recon.state.platoons[0]!, FRIEND) < 400) held++;
    }
    expect(held).toBeGreaterThan(10000);
    expect(aliveMen(recon)).toBe(24);
  }, 60000);

  test('F-29: 적 보병 사격에 의한 손실 — 엎드린 적은 쏘지 않는다', () => {
    // The platoon halts 100 m from the position; our adjusting rounds 150 m behind it keep it down, and while it is
    // down nobody of ours falls.
    const halt = { x: FRIEND.x, y: FRIEND.y + 100 };
    const sc: Scenario = { ...oneUnit({ type: 'inf', route: 'B', t0: 0 }, [{ x: 1280, y: 1900 }, { x: 1280, y: 1500 }, halt]), friends: [FRIEND] };
    const probe = started(sc, { seed: 7, terrain: field() });
    const end = probe.state.platoons[0]!.path.at(-1)!;
    until(probe, () => dist(probe.state.platoons[0]!, end) < 1.5);
    const sim = adjusting({ x: end.x, y: end.y + 150 }, 7, sc, probe.state.tick - 600);
    let pinned = 0;
    const count = (ticks: number) => {
      for (let k = 0; k < ticks; k++) {
        const was = aliveMen(sim);
        sim.step([]);
        const p = sim.state.platoons[0]!;
        if (sim.state.tick < p.pinnedUntil && dist(p, FRIEND) < 400) {
          pinned++;
          expect(aliveMen(sim)).toBe(was);
        }
      }
    };
    nextRound(sim);
    for (let k = 0; k < 10; k++) {
      count(30);
      untilTaken(sim, k === 0 ? corr(0, 'right', 0, 'add', 0, 'adjust') : corr('right', 0, 'add', 0, 'adjust'));
      count(500);
    }
    expect(pinned).toBeGreaterThan(4000);
  }, 60000);

  test('F-29: 아군 포탄', () => {
    // Model numbers: 30 m 안, 서 있음 60 % / 엎드림 30 %, × exp(−1.5 (r/30)²).
    expect(friendlyLossChance('ours', 0, false)).toBeCloseTo(0.6, 15);
    expect(friendlyLossChance('ours', 0, true)).toBeCloseTo(0.3, 15);
    expect(friendlyLossChance('ours', 30, false)).toBeCloseTo(0.6 * Math.exp(-1.5), 12);
    expect(friendlyLossChance('ours', 30.01, true)).toBe(0);
    // Four adjusting rounds on the position, then six 72 m east of it (falling on either side of 70 m). No enemy and the post 1.3 km off: the round's
    // only 탄도 draws are one per live man within 30 m, and only when it fell within 70 m of the position.
    const sim = adjusting(FRIEND, 5);
    const rounds = [nextRound(sim)];
    for (let k = 1; k < 10; k++) {
      untilTaken(sim, k === 1 ? corr(0, 'right', 0, 'add', 0, 'adjust') : corr('right', k === 4 ? 72 : 0, 'add', 0, 'adjust'));
      rounds.push(nextRound(sim));
    }
    let near = 0;
    let far = 0;
    let lost = 0;
    for (const r of rounds) {
      for (const m of r.fell) expect(dist(m, r.impact)).toBeLessThanOrEqual(30);
      if (dist(r.impact, FRIEND) < 70) {
        near++;
        expect(r.draws).toBe(r.inReach);
        expect(r.dScore).toBe(-200 - 10 * r.fell.length);
        expect(r.notes).toEqual([{ type: 'post', tick: r.impact.tick, what: 'friendly_hit', pos: 0, k: r.fell.length }]);
      } else {
        far++;
        expect(r.draws).toBe(0);
        expect(r.dScore).toBe(0);
        expect(r.fell).toEqual([]);
        expect(r.notes).toEqual([]);
      }
      lost += r.fell.length;
    }
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
    expect(rounds.some((r) => dist(r.impact, FRIEND) >= 70 && r.inReach > 0)).toBe(true); // men in reach, yet no draw
    expect(lost).toBeGreaterThan(0);
  }, 30000);

  test('F-29: 손실 감점', () => {
    // Enemy mortar: each round that lands −5, each man it kills −10; nothing else scores in this game.
    const mortar = started(shelling(), { seed: 3, terrain: field() });
    let shells = 0;
    let lost = 0;
    for (let k = 0; k < 16000; k++) {
      const score = mortar.state.score;
      const r = watchStep(mortar);
      expect(mortar.state.score - score).toBe(0 - 5 * r.shells.length - 10 * r.fell.length);
      shells += r.shells.length;
      lost += r.fell.length;
    }
    expect(shells).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
    expect(mortar.record().score).toBe(0 - 5 * shells - 10 * lost);
    // Enemy infantry: −10 a man; the platoon's own fate (무력화 · 파괴 by our direct fire) scores on the tick it changes.
    const inf = started(assault(), { seed: 7, terrain: field() });
    let fallen = 0;
    for (let k = 0; k < 16000; k++) {
      const score = inf.state.score;
      const fate = inf.state.platoons[0]!.state;
      const r = watchStep(inf);
      fallen += r.fell.length;
      if (inf.state.platoons[0]!.state === fate) expect(inf.state.score - score).toBe(0 - 10 * r.fell.length);
    }
    expect(fallen).toBeGreaterThan(0);
    // 적 직사 (APCs halted 1.3 km from their objective): −3 a burst, and the first one is told in the log.
    const apc = started(oneUnit({ type: 'apc', route: 'B', t0: 0 }, [{ x: 1280, y: 2550 }, { x: 1280, y: 1200 }]), { terrain: field() });
    const bursts: number[] = [];
    const told: number[] = [];
    for (let k = 0; k < 3000; k++) {
      const score = apc.state.score;
      const events = apc.step([]).events;
      const burst = apc.state.effects.some((e) => e.kind === 'muzzle' && e.pid === 0 && e.tick === apc.state.tick);
      if (burst) bursts.push(apc.state.tick);
      for (const e of events) if (e.type === 'post' && e.what === 'apc_fire') told.push(e.tick);
      expect(apc.state.score - score).toBe(burst ? -3 : 0);
    }
    expect(bursts.length).toBeGreaterThan(3);
    expect(told).toEqual([bursts[0]]);
  }, 60000);

  test('F-29: 엎드림', () => {
    // An enemy round on the position: for 40 s every man there lies down and those away make for their place, nobody
    // fires; then they are up again (no enemy near).
    const sim = started(shelling(), { seed: 3, terrain: field() });
    let until = -1;
    let down = 0;
    let up = 0;
    while (sim.state.tick < 9000) {
      const was = sim.state.friendlies.map((m) => dist(m, { x: m.hx, y: m.hy }));
      const { shells } = watchStep(sim);
      const t = sim.state.tick;
      const men = sim.state.friendlies.filter((m) => m.alive);
      if (t < until) {
        down++;
        for (const m of men) expect(m.prone).toBe(true);
        sim.state.friendlies.forEach((m, i) => {
          if (m.alive) expect(dist(m, { x: m.hx, y: m.hy })).toBeCloseTo(was[i]! < 0.5 ? was[i]! : Math.max(0, was[i]! - 2.6 * 0.05), 9);
        });
        expect(sim.state.effects.some((e) => e.tiny)).toBe(false);
      } else if (until > 0) {
        up++;
        for (const m of men) expect(m.prone).toBe(false);
      }
      if (shells.length) until = t + 800;
    }
    expect(down).toBeGreaterThan(800);
    expect(up).toBeGreaterThan(0);
    // Our round within 220 m of the mortar section: it goes to ground and fires no volley until it is up again.
    const hit = adjusting({ x: MORTAR.x, y: MORTAR.y - 100 }, 3, shelling(), 4300);
    const p = () => hit.state.platoons[0]!;
    const muzzle = () => hit.state.effects.some((e) => e.kind === 'muzzle' && e.pid === 0 && e.tick === hit.state.tick);
    while (p().pinnedUntil === 0 || hit.state.tick < p().pinnedUntil - 1) {
      hit.step([]);
      if (p().pinnedUntil > hit.state.tick) expect(muzzle()).toBe(false);
    }
    expect(p().nextFire).toBeLessThan(p().pinnedUntil); // a volley fell due while it lay down
    const upAt = p().pinnedUntil;
    while (!muzzle()) hit.step([]);
    expect(hit.state.tick).toBe(upAt);
  }, 30000);
});

describe('F-27: 직사화기와 잔존 병력', () => {
  test('F-27: 직사는 잔존 병력에 비례 — 판에서', () => {
    // Twin games per seed: our 효력사 on our own position (위험근접, adjusted first) or 1 km east of it; then an enemy
    // platoon comes to 480–680 m of the position (inside our direct fire, outside its own) for 250 s. Over the seeds,
    // the enemy dead in the hit games, to those in the spared games, go as our men left.
    const INF = { type: 'inf', route: 'B', t0: 150 } as const;
    const scenario: Scenario = { ...oneUnit(INF, [{ x: 1280, y: 1880 }, { x: 1280, y: 1680 }]), friends: [FRIEND] };
    const game = (at: Point, seed: number) => {
      const sim = adjusting(at, seed, scenario);
      nextRound(sim);
      untilTaken(sim, corr(0, 'right', 0, 'add', 0, 'ffe'));
      while (sim.state.tick < 3000) sim.step([]);
      const left = aliveMen(sim);
      while (sim.state.tick < 8000) sim.step([]);
      expect(aliveMen(sim)).toBe(left); // the enemy never came within 400 m
      return { left, killed: sim.state.platoons[0]!.members.filter((m) => !m.alive).length };
    };
    let left = 0;
    let hit = 0;
    let spared = 0;
    const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    for (const seed of SEEDS) {
      const h = game(FRIEND, seed);
      const s = game({ x: FRIEND.x + 1000, y: FRIEND.y }, seed);
      expect(s.left).toBe(24);
      left += h.left;
      hit += h.killed;
      spared += s.killed;
    }
    const ratio = left / (24 * SEEDS.length);
    expect(ratio).toBeLessThan(0.7); // the 효력사 did thin the position out
    expect(Math.abs(hit / spared - ratio)).toBeLessThan(0.25); // 12 seeds: 25 / 45 against 0.42 left; `alive` → 24 gives 43 / 45
  }, 60000);
});

describe('B6: 박격포는 탄도 스트림을 쓰지 않는다', () => {
  test('박격포반을 뺀 시나리오와 넣은 시나리오는 탄도 스트림 소비 횟수가 같다', () => {
    // The same game with and without the mortar section, and a 바로 효력사 on open ground at (300, 1900) while the enemy
    // rounds fall on our position. The mortar's spot is drawn before every unit's men, so the two games' enemies differ;
    // the rounds hit no unit (none within 220 m), no friendly position (> 70 m) and not the post (> 45 m), so the
    // 탄도 stream serves the mission alone: its bias and each round's 공산오차. The enemy rounds' losses must not touch it.
    const withMortar: Scenario = { ...shelling({ x: 2200, y: 2400 }) };
    const without: Scenario = { ...withMortar, units: [] };
    const run = (scenario: Scenario) => {
      const sim = started(scenario, { seed: 11, terrain: field() });
      openRadio(sim);
      while (sim.state.tick < 5000) sim.step([]);
      if (!send(sim, CALL_FFE).ok) throw new Error('call ignored');
      answered(sim, 'call');
      const b = sim.state.missions[0]!.bias;
      if (!send(sim, gridAt({ x: 300 - b.x, y: 1900 - b.y })).ok) throw new Error('loc ignored');
      answered(sim, 'loc');
      if (!send(sim, DESC_UNKNOWN).ok) throw new Error('desc ignored');
      const impacts: ImpactEvent[] = [];
      const bal: number[] = [];
      let shells = 0;
      while (sim.state.tick < 12000) {
        impacts.push(...sim.step([]).events.filter(isImpact));
        shells += sim.state.effects.filter((e) => isShell(e) && e.tick === sim.state.tick).length;
        bal.push(sim.state.rng.bal.count);
      }
      return { sim, impacts, bal, shells };
    };
    const a = run(withMortar);
    const b = run(without);
    expect(a.shells).toBeGreaterThan(3); // the enemy rounds fell and killed, drawing from the 행동 stream …
    expect(aliveMen(a.sim)).toBeLessThan(24);
    expect(b.shells).toBe(0);
    expect(aliveMen(b.sim)).toBe(24);
    expect(b.impacts).toHaveLength(18); // … while our 효력사 fired
    for (const i of a.impacts) expect(dist(i, FRIEND)).toBeGreaterThan(70);
    expect(a.impacts).toEqual(b.impacts);
    expect(a.bal).toEqual(b.bal); // tick by tick
    expect(a.sim.state.rng.bal.count).toBe(2 + 18 * 4); // bias, then two gaussians (two draws each) a round
  }, 30000);
});
