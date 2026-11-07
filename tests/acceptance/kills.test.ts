// 피격 반응과 판정 (#29): rounds landing near enemy units pin them, kill members, and break or destroy the unit.
// Public interface only: create, step, events, read-only state, record.
import { describe, expect, test } from 'vitest';
import type { ReadonlySimState, Sim } from '@sim';
import { CALL_ADJUST, CALL_FFE, desc } from './mission';
import { dist, mortarAt, oneUnit } from './enemy';
import { aimedAt, isImpact, untilLanded } from './strike';

const QUICK = desc(1, 'quick', 'ready', 0, 'unknown');
const INF = oneUnit({ type: 'inf', route: 'B', t0: 0 });
const APC = oneUnit({ type: 'apc', route: 'B', t0: 0 });
// Seeds picked by a probe: on seed 2 an aimed 포대 오발 leaves the approaching platoon at 67% casualties (broken on the
// way), 포대 삼발 at 53%. The column it still marches in and pinning after the first round keep these well below the
// standing-platoon figures.
const SEED = 2;

const centre = (sim: Sim) => ({ x: sim.state.platoons[0]!.x, y: sim.state.platoons[0]!.y });
const liveMen = (p: ReadonlySimState['platoons'][number]) => p.members.filter((m) => m.kind === 'man' && m.alive);

/** Lands the adjusting round; returns how far from the unit's centre it fell. */
function land(sim: Sim): number {
  const impact = untilLanded(sim).find(isImpact)!;
  return dist(impact, centre(sim));
}

describe('F-12: 피격 시 엎드림', () => {
  test('소대 중심 220 m 안에 떨어지면 35–65초 엎드려 멈추고, 밖이면 계속 간다', () => {
    const sim = aimedAt(INF, 3, 0, CALL_ADJUST, QUICK, { x: 120, y: 0 });
    expect(land(sim)).toBeLessThanOrEqual(220);
    sim.step([]);
    const p = sim.state.platoons[0]!;
    const at = centre(sim);
    expect(p.state).toBe('approach');
    expect(liveMen(p).length).toBeGreaterThan(0);
    // 35 s down and still
    for (let k = 0; k < 700; k++) {
      expect(liveMen(p).every((m) => m.prone)).toBe(true);
      expect(p.moving).toBe(false);
      expect(centre(sim)).toEqual(at);
      sim.step([]);
    }
    // up and on the move again by 65 s
    for (let k = 700; k < 1300 && !p.moving; k++) sim.step([]);
    expect(p.moving).toBe(true);
    expect(liveMen(p).some((m) => m.prone)).toBe(false);
    expect(dist(centre(sim), at)).toBeGreaterThan(0);

    // Farther than 220 m: nobody lies down.
    const far = aimedAt(INF, 3, 0, CALL_ADJUST, QUICK, { x: 330, y: 0 });
    expect(land(far)).toBeGreaterThan(220);
    for (let k = 0; k < 100; k++) {
      far.step([]);
      expect(far.state.platoons[0]!.moving).toBe(true);
      expect(far.state.platoons[0]!.members.some((m) => m.prone)).toBe(false);
    }
  });

  test('장갑차는 엎드리지 않고 계속 간다', () => {
    const sim = aimedAt(APC, 3, 0, CALL_ADJUST, QUICK, { x: 60, y: 0 });
    expect(land(sim)).toBeLessThanOrEqual(220);
    const before = centre(sim);
    for (let k = 0; k < 100; k++) sim.step([]);
    expect(sim.state.platoons[0]!.moving).toBe(true);
    expect(dist(centre(sim), before)).toBeGreaterThan(4 * 5 * 0.9); // 5 m/s for 5 s
  });

  test('엎드린 박격포반은 쏘지 않는다', () => {
    const MORTAR = mortarAt({ x: 900, y: 1400 });
    /** Steps both `ticks` times; counts the muzzle flashes each makes. */
    const fired = (sims: Sim[], ticks: number) => {
      const n = sims.map(() => 0);
      for (let k = 0; k < ticks; k++)
        sims.forEach((s, i) => {
          s.step([]);
          n[i]! += s.state.effects.filter((e) => e.kind === 'muzzle' && e.tick === s.state.tick).length;
        });
      return n;
    };
    // Called 180 s in, the round lands after the section starts firing at 210 s, at a time it fires within 35 s.
    const struck = aimedAt(MORTAR, 3, 0, CALL_ADJUST, QUICK, { x: 80, y: 0 }, 3600);
    const clear = aimedAt(MORTAR, 3, 0, CALL_ADJUST, QUICK, { x: 400, y: 0 }, 3600);
    expect(land(struck)).toBeLessThanOrEqual(220);
    expect(land(clear)).toBeGreaterThan(220);
    expect(struck.state.tick).toBeGreaterThan(4200);
    // From the later of the two impacts, for the 35 s the struck section is pinned at least.
    const t = Math.max(struck.state.tick, clear.state.tick);
    const lag = t - Math.min(struck.state.tick, clear.state.tick);
    for (const s of [struck, clear]) while (s.state.tick < t) s.step([]);
    const [hit, free] = fired([struck, clear], 700 - lag);
    expect(hit).toBe(0);
    expect(free).toBeGreaterThan(0); // it would have fired in that time
  });
});

/** Steps until `ticks` have passed with no round in the air for 10 s, checking the unit after every step: 무력화 at
 * 30% casualties, 파괴 at 60%, each scored once when it happens (+100, +150 in all), +50 more for an infantry platoon
 * that had not begun its assault. Returns the unit's casualty share and the score the strike brought. */
function judged(sim: Sim, early: boolean, ticks = 3000) {
  const p = sim.state.platoons[0]!;
  const start = sim.record().score;
  let state = p.state;
  let score = start;
  for (let k = 0; k < ticks; k++) {
    sim.step([]);
    const cas = p.members.filter((m) => !m.alive).length / p.members.length;
    const want = cas >= 0.6 ? 'destroyed' : cas >= 0.3 ? 'broken' : null;
    if (want) expect(p.state, `casualties ${cas}`).toBe(want);
    else expect(['broken', 'destroyed']).not.toContain(p.state);
    const now = sim.record().score;
    if (p.state !== state) {
      const bonus = early && state !== 'broken' ? 50 : 0;
      expect(now - score, `${state} → ${p.state}`).toBe((p.state === 'destroyed' ? (state === 'broken' ? 50 : 150) : 100) + bonus);
    } else expect(now).toBe(score);
    state = p.state;
    score = now;
  }
  return { cas: p.members.filter((m) => !m.alive).length / p.members.length, score: score - start };
}

describe('F-12: 무력화와 파괴', () => {
  test('효력사가 사상 60%를 넘기면 파괴, 돌격선 전이면 조기 격퇴 +50', () => {
    const sim = aimedAt(INF, SEED, 0, CALL_FFE, desc(5, 'quick', 'ready', 0, 'unknown'));
    expect(sim.state.platoons[0]!.assaultTick).toBe(-1); // still approaching
    const r = judged(sim, true);
    expect(r.cas).toBeGreaterThanOrEqual(0.6);
    expect(sim.state.platoons[0]!.state).toBe('destroyed');
    expect(r.score).toBe(200);
    // 파괴된 소대는 움직이지 않는다
    const at = centre(sim);
    for (let k = 0; k < 2000; k++) sim.step([]);
    expect(centre(sim)).toEqual(at);
    expect(sim.state.platoons[0]!.moving).toBe(false);
  });

  test('돌격 중인 소대에는 조기 격퇴가 없다', () => {
    const near = oneUnit({ type: 'inf', route: 'B', t0: 0 }, [{ x: 900, y: 1400 }, { x: 900, y: 1300 }, { x: 900, y: 1000 }]);
    const sim = aimedAt(near, SEED, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
    expect(sim.state.platoons[0]!.state).toBe('assault');
    const r = judged(sim, false);
    expect(r.cas).toBeGreaterThanOrEqual(0.3);
    expect(r.score).toBe(r.cas >= 0.6 ? 150 : 100);
    // 1.2 km off through the binoculars: the dead lie still and are never seen, the living are.
    sim.step([{ a: 'bino', v: [1] }]);
    const p = sim.state.platoons[0]!;
    expect(p.members.filter((m) => !m.alive).every((m) => !m.vis && m.prone)).toBe(true);
    expect(p.members.some((m) => m.alive && m.vis)).toBe(true);
  });

  test('사상 30–60%면 무력화: 엎드림이 끝나면 출발점으로 물러난다', () => {
    const sim = aimedAt(INF, SEED, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
    const r = judged(sim, true);
    expect(r.cas >= 0.3 && r.cas < 0.6, `casualties ${r.cas}`).toBe(true);
    expect(r.score).toBe(150);
    const p = sim.state.platoons[0]!;
    const home = p.path[0]!;
    // pinned first, then 0.8 m/s back the way it came
    while (sim.state.tick < p.pinnedUntil) sim.step([]);
    const d0 = dist(centre(sim), home);
    for (let k = 0; k < 400; k++) sim.step([]);
    expect(d0 - dist(centre(sim), home)).toBeCloseTo(0.8 * 20, 0);
    expect(p.moving).toBe(true);
  });
});
