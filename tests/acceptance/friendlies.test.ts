// 아군 묘사와 직사 (#34, F-27): the friendly platoons, the supply truck and their direct fire on the enemy.
// Public interface only: create, step, events, read-only state, record.
import { describe, expect, test } from 'vitest';
import { directFireChance, EYE_HEIGHT, signalAt, type ReadonlySimState, type Scenario, type Sim } from '@sim';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { mockTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { angleTo, dist, mortarAt, oneUnit, started } from './enemy';
import { flatTerrain, mainRoad } from './terrain';

// A 2.56 km flat field: the post at (320, 320), one friendly position, one enemy platoon walking onto it from 1.5 km.
const FRIEND = { x: 1280, y: 1200 };
const ROUTE = [{ x: 1280, y: 2700 }, { x: 1280, y: 1800 }, FRIEND];
const field = () => flatTerrain({ n: 256 });
const scenario = (over: Partial<Scenario> = {}): Scenario => ({ ...oneUnit({ type: 'inf', route: 'B', t0: 0 }, ROUTE), friends: [FRIEND], ...over });

type Man = ReadonlySimState['friendlies'][number];
/** Nearest threatening enemy centre to the friendly position (the rule's threat). */
const threat = (sim: Sim) => {
  let best = Infinity;
  for (const p of sim.state.platoons) {
    if (p.state === 'wait' || p.type === 'mortar' || p.type === 'recon' || p.state === 'destroyed' || p.state === 'broken') continue;
    if (!p.members.some((m) => m.alive)) continue;
    best = Math.min(best, dist(p, FRIEND));
  }
  return best;
};
const home = (m: Man) => ({ x: m.hx, y: m.hy });

describe('F-27: 아군 소대', () => {
  test('F-27: 아군 소대의 움직임', () => {
    const sim = started(scenario(), { terrain: field() });
    const men = sim.state.friendlies;
    expect(men).toHaveLength(24);
    for (const m of men) {
      expect(m.pos).toBe(0);
      expect(Math.abs(m.hx - FRIEND.x)).toBeLessThan(7 * 12 + 8);
      expect(Math.abs(m.hy - FRIEND.y)).toBeLessThan(8 + 12);
    }
    expect(men.filter((m) => m.walker)).toHaveLength(5); // every fifth man walks behind the position
    // The base scenario's three positions: 24 men each, around their own position.
    const base = started({ ...BASE_SCENARIO, units: [] }).state.friendlies;
    expect(base).toHaveLength(3 * 24);
    BASE_SCENARIO.friends.forEach((f, pos) => {
      const own = base.filter((m) => m.pos === pos);
      expect(own).toHaveLength(24);
      for (const m of own) expect(Math.abs(m.hx - f.x) < 7 * 12 + 8 && Math.abs(m.hy - f.y) < 8 + 12).toBe(true);
      expect(own.filter((m) => m.walker)).toHaveLength(5);
    });
    // No threat yet: walkers stroll off behind the position, the rest stay put and nobody lies down.
    let strolled = false;
    for (let k = 0; k < 3000; k++) {
      sim.step([]);
      expect(threat(sim)).toBeGreaterThan(1000);
      for (const m of sim.state.friendlies) {
        if (!m.walker) expect(dist(m, home(m))).toBe(0);
        expect(m.prone).toBe(false);
        if (m.walker && dist(m, home(m)) > 5) strolled = true;
      }
    }
    expect(strolled).toBe(true);
    // Up to 1 km everyone strolls at most 1.1 m/s; from the tick it is closer, those away run home at 2.6 m/s.
    const step = () => {
      const was = sim.state.friendlies.map((m) => ({ x: m.x, y: m.y }));
      sim.step([]);
      return Math.max(...sim.state.friendlies.map((m, i) => dist(m, was[i]!)));
    };
    for (;;) {
      const away = sim.state.friendlies.filter((m) => dist(m, home(m)) > 1).length;
      const moved = step();
      if (threat(sim) < 1000) {
        expect(away).toBeGreaterThan(0); // seed 7: someone is out when the enemy comes within 1 km
        expect(moved).toBeCloseTo(2.6 * 0.05, 9);
        break;
      }
      expect(moved).toBeLessThanOrEqual(1.1 * 0.05 + 1e-9);
    }
    for (let k = 0; k < Math.ceil((110 / 2.6) * 20) + 20; k++) sim.step([]);
    for (let k = 0; k < 400; k++) {
      for (const m of sim.state.friendlies) {
        expect(dist(m, home(m))).toBeLessThan(0.5);
        expect(m.moving).toBe(false);
      }
      sim.step([]);
    }
  }, 30000); // ~7000 ticks (1.3 s alone): vitest's 5 s default is hit under load
});

const flashes = (sim: Sim) => sim.state.effects.filter((e) => e.kind === 'muzzle' && e.tiny);
const dead = (sim: Sim) => sim.state.platoons[0]!.members.filter((m) => !m.alive).length;

describe('F-27: 아군 직사화기', () => {
  test('F-27: 아군 직사', () => {
    // On through the position to an objective 1 km behind it: a platoon reaching its objective unbroken overruns it (#36).
    const through = [...ROUTE, { x: 1280, y: 200 }];
    const sim = started(scenario({ routes: { A: through, B: through, C: through } }), { terrain: field() });
    // Until 750 m nobody fires, and until 600 m no enemy falls (no artillery in this run).
    let first: ReturnType<typeof flashes>[number] | undefined;
    while (threat(sim) >= 750) {
      sim.step([]);
      if (threat(sim) >= 750) expect(flashes(sim)).toHaveLength(0);
      else first = flashes(sim)[0];
    }
    while (dist(sim.state.platoons[0]!, FRIEND) > 600) {
      expect(dead(sim)).toBe(0);
      sim.step([]);
      first ??= flashes(sim)[0];
    }
    // A man in his place fires: a small flash just in front of him, half a second, belonging to no enemy unit.
    expect(first).toBeDefined();
    const shooter = sim.state.friendlies.find((m) => Math.abs(m.x - first!.x) < 1e-9 && Math.abs(m.y + 3 - first!.y) < 1e-9);
    expect(shooter).toBeDefined();
    expect(dist(shooter!, home(shooter!))).toBeLessThan(0.5);
    expect(first).toMatchObject({ pid: -1, life: 10, small: true });
    // Within 600 m the platoon bleeds until it breaks (무력화 +100, before its assault +50 too; inside 400 m its fire
    // costs us 10 a man, #35).
    const score = sim.state.score;
    const men = sim.state.friendlies.filter((m) => m.alive).length;
    for (let k = 0; k < 20000 && sim.state.platoons[0]!.state !== 'broken'; k++) sim.step([]);
    expect(sim.state.platoons[0]!.state).toBe('broken');
    expect(dead(sim)).toBeGreaterThanOrEqual(9);
    const lost = men - sim.state.friendlies.filter((m) => m.alive).length;
    expect(sim.state.score - score + 10 * lost).toBe(sim.state.platoons[0]!.assaultTick < 0 ? 150 : 100);
  }, 30000);

  // Model numbers (pure): friendly losses come with #35, so `alive` cannot change in a run yet; #35 adds the run check.
  test('F-27: 직사는 잔존 병력에 비례', () => {
    const full = directFireChance(24, 0, false);
    expect(full).toBeCloseTo(0.003 * 0.05, 15); // demo: 0.003 per second per man at the position's muzzle
    expect(directFireChance(12, 0, false)).toBeCloseTo(full / 2, 15);
    expect(directFireChance(6, 0, false)).toBeCloseTo(full / 4, 15);
    expect(directFireChance(0, 0, false)).toBe(0);
    expect(directFireChance(24, 300, false)).toBeCloseTo(full / 2, 15);
    expect(directFireChance(24, 0, true)).toBeCloseTo(full * 0.4, 15);
    expect(directFireChance(12, 300, true)).toBeCloseTo(full * 0.1, 15);
    expect(directFireChance(24, 600, false)).toBe(0);
    expect(directFireChance(24, 601, false)).toBe(0);
  });

  test('F-27: 아군 직사 — 박격포반은 맞지 않는다', () => {
    const sim = started({ ...scenario(), ...mortarAt({ x: FRIEND.x, y: FRIEND.y + 300 }), friends: [FRIEND] }, { terrain: field() });
    for (let k = 0; k < 6000; k++) sim.step([]);
    expect(sim.state.platoons[0]!.members.every((m) => m.alive)).toBe(true);
  });
});

// A straight 1 km road north from (400, 400); the truck's path wiggles 18·sin(u/260) m east of it (demo).
const ROAD = [{ x: 400, y: 400 }, { x: 400, y: 1400 }];
const roadField = () => ({ ...field(), roads: [mainRoad([]), mainRoad(ROAD)] });
const END = { x: 400 + 18 * Math.sin(1000 / 260), y: 1400 };
type Frame = { x: number; y: number; moving: boolean; dust: boolean };
/** Steps `n` ticks recording the truck and whether a dust cloud (no enemy unit's) appeared that tick. */
function drive(sim: Sim, n: number): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < n; k++) {
    sim.step([]);
    const t = sim.state.truck!;
    out.push({ x: t.x, y: t.y, moving: t.moving, dust: sim.state.effects.some((e) => e.kind === 'dust' && e.pid === -1 && e.tick === sim.state.tick) });
  }
  return out;
}
/** Lengths of the runs of standing ticks. */
const stops = (f: Frame[]) => {
  const out: number[] = [];
  let run = 0;
  for (const x of f) {
    if (!x.moving) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
};

describe('F-27: 보급 트럭', () => {
  test('F-27: 보급 트럭', () => {
    const sim = started({ ...BASE_SCENARIO, units: [], friends: [FRIEND] }, { terrain: roadField() });
    expect(sim.state.truck).toMatchObject({ x: 400, y: 400, moving: false });
    const f = drive(sim, 9500);
    // 20 s at the start (the start step is the first of its 400 ticks), then up the road at 7 m/s, 60 s at the far end
    // (plus the tick it arrives and the tick it turns), back, and 60 s again.
    const long = stops(f).filter((n) => n > 5);
    expect(long.slice(0, 3)).toEqual([399, 1202, 1202]);
    const far = f.findIndex((x) => !x.moving && dist(x, END) < 0.5 && f.indexOf(x) > 400);
    expect(far).toBeGreaterThan(400);
    const back = f.findIndex((x, i) => i > far + 1200 && !x.moving && dist(x, ROAD[0]!) < 0.5);
    expect(back).toBeGreaterThan(far + 1200);
    for (let i = 1; i < f.length; i++) expect(dist(f[i]!, f[i - 1]!)).toBeLessThanOrEqual(0.35 + 1e-9);
    const steps = f.filter((x, i) => i > 0 && dist(x, f[i - 1]!) > 0);
    expect(f.filter((x, i) => i > 0 && Math.abs(dist(x, f[i - 1]!) - 0.35) < 1e-9).length / steps.length).toBeGreaterThan(0.9);
    // Dust while it drives, at most every 1.25 s; none while it stands.
    const dust = f.flatMap((x, i) => (x.dust ? [i] : []));
    expect(dust.length).toBeGreaterThan(100);
    for (const i of dust) expect(f[i]!.moving).toBe(true);
    for (let k = 1; k < dust.length; k++) expect(dust[k]! - dust[k - 1]!).toBeGreaterThanOrEqual(25);
  });

  test('F-27: 보급 트럭 — 적이 1.5 km 안이면 길 절반을 넘어서 돌아선다', () => {
    // The enemy sets off 1.78 km out and crosses 1.5 km after the truck is past half way (~tick 1900).
    const far = [{ x: 1280, y: 2980 }, { x: 1280, y: 1800 }, FRIEND];
    const sim = started({ ...scenario(), ...oneUnit({ type: 'inf', route: 'B', t0: 0 }, far), friends: [FRIEND] }, { terrain: roadField() });
    let before = threat(sim);
    let y = sim.state.truck!.y;
    for (let k = 0; k < 6000; k++) {
      sim.step([]);
      const now = threat(sim);
      if (sim.state.truck!.y < y) {
        // It turns on the tick the enemy comes within 1.5 km, past half of the 51 points, without a wait.
        expect(before).toBeGreaterThanOrEqual(1500);
        expect(now).toBeLessThan(1500);
        expect(y).toBeGreaterThan(900);
        expect(y).toBeLessThan(1400 - 100);
        expect(sim.state.truck!.moving).toBe(true);
        return;
      }
      before = now;
      y = sim.state.truck!.y;
    }
    throw new Error('the truck never turned');
  });

  test('F-27: 보급 트럭 — 적이 이미 가까우면 길 절반의 첫 점에서 돌아선다', () => {
    const sim = started({ ...scenario(), supplyRoad: 1 }, { terrain: roadField() });
    const f = drive(sim, 4000);
    expect(threat(sim)).toBeLessThan(1500);
    const top = Math.max(...f.map((x) => x.y));
    expect(top).toBeGreaterThan(900); // the first point past half of the 51 (i 26: 520 m up)
    expect(top).toBeLessThan(950);
    expect(stops(f).filter((n) => n > 5)).toEqual([399, 579]); // no wait where it turns; then back at the start
    expect(dist(f.at(-1)!, ROAD[0]!)).toBeLessThan(0.5);
  });

  test('F-27: 보급 트럭 — 길이 없으면 트럭도 없다, 기본 지형에서는 1번 도로 첫 점', async () => {
    expect(started(scenario(), { terrain: field() }).state.truck).toBeNull();
    const terrain = await mockTerrain.load(20261106);
    const sim = started({ ...BASE_SCENARIO, units: [] }, { terrain });
    expect(sim.state.truck).toMatchObject({ x: terrain.roads[1]!.line[0]!.x, y: terrain.roads[1]!.line[0]!.y });
  }, 30000); // generates the 1024² mock terrain
});

const BINO_ON = { a: 'bino', v: [1] };
/** `rows` (cells, north) raised 50 m for the cells west of `x` m. */
function walled(t: ReturnType<typeof roadField>, rows: readonly number[], x = Infinity) {
  for (const j of rows) for (let i = 0; i < t.n && i * t.cell < x; i++) t.surface[j * t.n + i]! += 50;
  return t;
}

describe('F-27: 아군 묘사', () => {
  test('F-27: 아군 묘사 — 보임은 시뮬레이션의 가시선으로 정한다', () => {
    // Through the binoculars the line at 1.3 km is seen; a wall 50 m in front of it, west of x 1220, hides its west end.
    const sim = started({ ...scenario(), supplyRoad: 1 }, { terrain: walled(roadField(), [114, 115, 116], 1220) });
    sim.step([BINO_ON]);
    for (let k = 0; k < 6; k++) sim.step([]);
    const men = sim.state.friendlies;
    expect(men.filter((m) => m.hx < 1250).length).toBeGreaterThan(5);
    expect(men.filter((m) => m.hx < 1250).every((m) => !m.vis)).toBe(true);
    expect(men.filter((m) => m.hx > 1310).length).toBeGreaterThan(5);
    expect(men.filter((m) => m.hx > 1310).every((m) => m.vis)).toBe(true);
    expect(sim.state.truck!.vis).toBe(true); // 113 m away, in the open
    // By eye a man at 1.3 km is too small (1.3 mils < 1.5): none is seen.
    sim.step([{ a: 'bino', v: [0] }]);
    for (let k = 0; k < 6; k++) sim.step([]);
    expect(sim.state.friendlies.some((m) => m.vis)).toBe(false);
    // A wall right across the field in front of the post hides the truck and everyone.
    const hid = started({ ...scenario(), supplyRoad: 1 }, { terrain: walled(roadField(), [35, 36]) });
    hid.step([BINO_ON]);
    for (let k = 0; k < 6; k++) hid.step([]);
    expect(hid.state.truck!.vis).toBe(false);
    expect(hid.state.friendlies.some((m) => m.vis)).toBe(false);
  });

  test('F-27: 아군의 먼지·섬광은 식별되지 않고 적을 가리지도 않는다', () => {
    // The mortar section sits on the line from the post through where the truck sets off, 960 m out.
    const sim = started({ ...mortarAt({ x: 1000, y: 1000 }), supplyRoad: 1, friends: [] }, { terrain: roadField() });
    sim.step([BINO_ON]);
    let dust: ReadonlySimState['effects'][number] | undefined;
    while (!dust) {
      sim.step([]);
      dust = sim.state.effects.find((e) => e.kind === 'dust' && e.pid === -1 && e.vis);
    }
    // From the post the cloud (3 m across at 113 m: 27 mils) covers the middle tube (on the same bearing, 15 mils up).
    const c = signalAt(dust, sim.state.tick, CLEAR_WEATHER);
    const tube = angleTo(sim, sim.state.platoons[0]!.members[4]!);
    const k = 32000 / Math.PI;
    const up = Math.atan2(c.z - 100 - EYE_HEIGHT, Math.hypot(c.x - 320, c.y - 320)) * k;
    expect(Math.abs(tube.el - up)).toBeLessThan(Math.atan2(c.r, Math.hypot(c.x - 320, c.y - 320)) * k);
    const press = { a: 'id', v: [Math.round(tube.az), Math.round(tube.el)] };
    // The press lands inside the dust cloud and finds the mortar behind it.
    expect(sim.step([press]).accepted).toEqual([true]);
    expect(sim.state.platoons[0]!.intel.stage).toBe(1);
  });
});

describe('F-27: 아군의 난수', () => {
  test('F-27: 아군 행동은 행동 스트림만 쓴다', () => {
    // Every friendly path in one game, with no artillery mission: strolling, running home, firing (flashes), direct-fire
    // kills, and the truck driving both ways (the enemy within 1.5 km sends it back). The post stays > 1100 m from the
    // enemy, so the 발각 check draws nothing either.
    const sim = started({ ...scenario(), supplyRoad: 1 }, { terrain: roadField() });
    const before = structuredClone(sim.state.rng);
    let strolled = false;
    let ran = false;
    let fired = false;
    let up = false;
    let down = false;
    let y = sim.state.truck!.y;
    for (let k = 0; k < 20000 && sim.state.platoons[0]!.state !== 'broken'; k++) {
      sim.step([]);
      const fight = threat(sim) < 1000;
      if (sim.state.friendlies.some((m) => m.moving)) {
        if (fight) ran = true;
        else strolled = true;
      }
      if (flashes(sim).length) fired = true;
      const ty = sim.state.truck!.y;
      if (ty > y) up = true;
      if (ty < y) down = true;
      y = ty;
    }
    expect([strolled, ran, fired, up, down]).toEqual([true, true, true, true, true]);
    expect(dead(sim)).toBeGreaterThanOrEqual(9); // broken by direct fire alone
    const { ai, ...others } = sim.state.rng;
    const { ai: ai0, ...others0 } = before;
    expect(ai.count).toBeGreaterThan(ai0.count);
    expect(others).toEqual(others0); // bal, fdc, exp, scn and las untouched
  }, 30000);
});
