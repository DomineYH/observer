// 살상 모델 (PRD 6장, demo lines 641–670): the model's numbers row by row, and the Monte Carlo figures they were tuned
// to. Equivalence tests, Node only: they call the pure lethality and ballistics modules directly (spec 동등성 테스트).
import { describe, expect, test } from 'vitest';
import { createSim, type Fuze, type Member } from '@sim';
import { fall, SHEAF } from '@sim/ballistics';
import { killChance, killMembers } from '@sim/lethality';
import { createStreams, next } from '@sim/rng';
import { BASE_SCENARIO } from '@content/scenario';
import { init } from './init';

const E1 = 0.92 / Math.E; // 0.92 · exp(−1): the chance at r = R
const V1 = 0.9 / Math.E;

describe('F-12: 살상 수치', () => {
  test('사람: 0.92 × exp(−(r/R)²), 순발 R 서 있음 26 m · 엎드림 15 m', () => {
    expect(killChance('man', false, 0, 'quick')).toBeCloseTo(0.92, 6);
    expect(killChance('man', false, 26, 'quick')).toBeCloseTo(E1, 6);
    expect(killChance('man', true, 15, 'quick')).toBeCloseTo(E1, 6);
    expect(killChance('man', true, 0, 'quick')).toBeCloseTo(0.92, 6);
  });

  test('사람: 접근신관은 파열고 7 m를 넣고 R 서 있음 28 m · 엎드림 24 m', () => {
    expect(killChance('man', false, 0, 'vt')).toBeCloseTo(0.86426, 4); // 0.92 · exp(−(7/28)²)
    expect(killChance('man', false, Math.sqrt(28 * 28 - 49), 'vt')).toBeCloseTo(E1, 6);
    expect(killChance('man', true, Math.sqrt(24 * 24 - 49), 'vt')).toBeCloseTo(E1, 6);
  });

  test('장갑차: 순발 R 7 m 근접 직격만, 접근신관은 0.22', () => {
    expect(killChance('veh', false, 0, 'quick')).toBeCloseTo(0.9, 6);
    expect(killChance('veh', false, 7, 'quick')).toBeCloseTo(V1, 6);
    expect(killChance('veh', false, 0, 'vt')).toBeCloseTo(0.22, 6); // the demo's value (PRD: 효과 0.22배)
    expect(killChance('veh', false, 7, 'vt')).toBeCloseTo(0.22 / Math.E, 6);
  });

  test('박격포 포신: 순발 R 10 m, 접근신관은 파열고 7 m와 R 7 m', () => {
    expect(killChance('tube', false, 0, 'quick')).toBeCloseTo(0.9, 6);
    expect(killChance('tube', false, 10, 'quick')).toBeCloseTo(V1, 6);
    expect(killChance('tube', false, 0, 'vt')).toBeCloseTo(V1, 6);
  });

  test('110 m 밖은 맞지 않는다', () => {
    expect(killChance('man', false, 110, 'quick')).toBeGreaterThan(0);
    for (const kind of ['man', 'veh', 'tube'] as const) for (const fuze of ['quick', 'vt'] as const) expect(killChance(kind, false, 111, fuze)).toBe(0);
  });

  test('포대 방렬: 6문 W자, 횡 120 m × 종 44 m', () => {
    expect(SHEAF).toHaveLength(6);
    const lat = SHEAF.map((g) => g[0]);
    const rng = SHEAF.map((g) => g[1]);
    expect(Math.max(...lat) - Math.min(...lat)).toBe(120);
    expect(Math.max(...rng) - Math.min(...rng)).toBe(44);
    // W: the guns alternate front and back
    for (let g = 1; g < 6; g++) expect(Math.sign(rng[g]!)).toBe(-Math.sign(rng[g - 1]!));
  });
});

// 포대 삼발 on one rifle platoon in line (form 1), facing south towards the battery 9.1 km away: 6 guns × 3 rounds with
// no bias. "서 있음" is the PRD's fixed posture: standing when the first volley (each gun's first round) lands, prone for
// the other two; "엎드림" is prone throughout. Run `RUNS` platoons, each with its own seed's formation and draws.
const RUNS = 2000;
const CENTRE = { x: BASE_SCENARIO.battery.x + 800, y: BASE_SCENARIO.battery.y + 9100 };
const formations = Array.from({ length: RUNS }, (_, i) => {
  const sim = createSim({ ...init(i + 1), scenario: { ...BASE_SCENARIO, units: [{ type: 'inf', route: 'B', t0: 0 }] } });
  return sim.state.platoons[0]!.members.map((m) => ({ u: m.u, v: m.v }));
});

function casualties(posture: 'standing' | 'prone', fuze: Fuze, aimErrorM: number): number {
  let dead = 0;
  let total = 0;
  formations.forEach((f, i) => {
    const bal = createStreams(i + 1).bal;
    const men: Pick<Member, 'kind' | 'x' | 'y' | 'prone' | 'alive'>[] = f.map((m) => ({ kind: 'man', x: CENTRE.x - m.u, y: CENTRE.y - m.v, prone: posture === 'prone', alive: true }));
    const a = next(bal) * Math.PI * 2;
    const aim = { x: CENTRE.x + Math.sin(a) * aimErrorM, y: CENTRE.y + Math.cos(a) * aimErrorM };
    for (let k = 0; k < 3; k++) {
      if (k > 0) for (const m of men) m.prone = true;
      for (const g of SHEAF) {
        const p = fall(aim, BASE_SCENARIO.battery, { x: 0, y: 0 }, bal, g);
        killMembers(men, p.x, p.y, fuze, bal);
      }
    }
    dead += men.filter((m) => !m.alive).length;
    total += men.length;
  });
  return (dead / total) * 100;
}

describe('F-12: 몬테카를로 네 값', () => {
  test.each([
    ['서 있음 순발 71', 'standing', 'quick', 71],
    ['서 있음 접근 85', 'standing', 'vt', 85],
    ['엎드림 순발 53', 'prone', 'quick', 53],
    ['엎드림 접근 82', 'prone', 'vt', 82],
  ] as const)('%s (±3%p)', (_, posture, fuze, pct) => {
    const c = casualties(posture, fuze, 0);
    expect(Math.abs(c - pct), `${c.toFixed(1)}%`).toBeLessThanOrEqual(3);
  });
});

describe('F-12: 조준 오차 범위', () => {
  test.each([
    ['40 m는 47–59', 40, 47, 59],
    ['80 m는 23–31', 80, 23, 31],
  ] as const)('조준 오차 %s', (_, err, lo, hi) => {
    const c = casualties('standing', 'quick', err);
    expect(c >= lo && c <= hi, `${c.toFixed(1)}%`).toBe(true);
  });
});
