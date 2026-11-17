// 포 프로파일 (ADR 0014): base@1 holds the numbers the simulation code held before M3-2.
import { describe, expect, test } from 'vitest';
import { createSim, fromGrid, type GunProfile } from '@sim';
import { fall } from '@sim/ballistics';
import { killChance, killMembers } from '@sim/lethality';
import { createStreams, next } from '@sim/rng';
import { BASE_GUNS } from '@content/guns';
import { GUNS } from '@content/lookup';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { init } from './init';
import { NO_ENEMY, oneMission } from './session';
import { isImpact } from './strike';
import { flatTerrain } from './terrain';

test('포 프로파일: base의 숫자는 지금 코드의 값이다', () => {
  // A second copy on purpose: a changed number goes red here by name, not only in the 기대값 표.
  expect(BASE_GUNS).toEqual({
    id: 'base',
    version: 1,
    maxRangeM: 24000,
    tof: { baseS: 3, sPerKm: 2.6 },
    peRange: { baseM: 2, mPerKm: 1.5 },
    peDeflection: { baseM: 1, mPerKm: 0.5 },
    sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
    ffe: { intervalS: 9, jitterS: 2.2 },
    lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
  });
});

// base@1 equals the old constants, so only a changed profile shows that the simulation reads it.
const volley = (guns: GunProfile) => {
  const g = oneMission({ ...init(20261106), scenario: NO_ENEMY, guns });
  const shot = g.events.find((e) => e.type === 'radio' && e.utterance.speaker === 'fdc' && e.utterance.kind === 'shot')!;
  return { shot: shot.tick, impacts: g.events.filter(isImpact) };
};

// The line of fire of LOC_CLEAR (grid 4080 3080 on the flat terrain) from the battery: its length and unit vector.
const AIM = fromGrid(4080, 3080, flatTerrain().grid);
const LINE = { x: AIM.x - BASE_SCENARIO.battery.x, y: AIM.y - BASE_SCENARIO.battery.y };
const D = Math.sqrt(LINE.x * LINE.x + LINE.y * LINE.y);
const U = { x: LINE.x / D, y: LINE.y / D };
/** One gun on the line of fire, no jitter. */
const STILL: GunProfile = { ...BASE_GUNS, sheaf: [[0, 0]], ffe: { intervalS: 9, jitterS: 0 } };

describe('포 프로파일: 시뮬레이션은 넘겨받은 프로파일의 수를 읽는다', () => {
  test('포 프로파일: 시뮬레이션은 넘겨받은 프로파일의 수를 읽는다 — 방렬·비과시간·효력사 간격·공산오차', () => {
    const base = volley(BASE_GUNS);
    expect(base.impacts).toHaveLength(18); // 포대 3발: six guns
    expect(volley({ ...BASE_GUNS, sheaf: BASE_GUNS.sheaf.slice(0, 2) }).impacts).toHaveLength(6); // the sheaf's length is the gun count
    const slow = volley({ ...BASE_GUNS, tof: { baseS: 30, sPerKm: 2.6 } });
    expect(slow.impacts[0]!.tick - slow.shot - (base.impacts[0]!.tick - base.shot)).toBe(540); // 27 s more 비과시간
    // One gun without jitter: its first round lands exactly the profile's 비과시간 after 하나발 떳다, for each coefficient.
    for (const tof of [BASE_GUNS.tof, { baseS: 30, sPerKm: 2.6 }, { baseS: 3, sPerKm: 5 }]) {
      const v = volley({ ...STILL, tof });
      expect(v.impacts[0]!.tick - v.shot, JSON.stringify(tof)).toBe(Math.ceil((tof.baseS + (D / 1000) * tof.sPerKm) * 20));
    }
    const one = { ...BASE_GUNS, sheaf: [[0, 0]] as const };
    const paced = volley({ ...one, ffe: { intervalS: 20, jitterS: 0 } }).impacts.map((e) => e.tick);
    expect(paced.slice(1).map((t, k) => t - paced[k]!)).toEqual([400, 400]); // one gun, 20 s apart, no jitter
    const exact = volley({ ...one, peRange: { baseM: 0, mPerKm: 0 }, peDeflection: { baseM: 0, mPerKm: 0 } }).impacts;
    expect(new Set(exact.map((e) => `${e.x},${e.y}`)).size).toBe(1); // no 공산오차: every round on the same point
    expect(new Set(volley(one).impacts.map((e) => `${e.x},${e.y}`)).size).toBe(3);
  });

  test('포 프로파일: 시뮬레이션은 넘겨받은 프로파일의 수를 읽는다 — 방렬 좌표', () => {
    // Two runs that differ only in the one gun's offset draw the same numbers, so their impacts differ by the offset alone.
    const centre = volley(STILL).impacts;
    const moved = volley({ ...STILL, sheaf: [[40, 30]] }).impacts;
    expect(moved).toHaveLength(3);
    moved.forEach((e, k) => {
      const dx = e.x - centre[k]!.x;
      const dy = e.y - centre[k]!.y;
      expect(dx * U.y - dy * U.x, `round ${k} across`).toBeCloseTo(40, 6); // sheaf[0]: right of the line of fire
      expect(dx * U.x + dy * U.y, `round ${k} along`).toBeCloseTo(30, 6); // sheaf[1]: beyond
    });
  });

  test('포 프로파일: 시뮬레이션은 넘겨받은 프로파일의 수를 읽는다 — 살상 반경 일곱 값', () => {
    // Seven distinct radii: at r = R (접근신관: the burst 7 m up, r = √(R² − 7²)) each chance is its peak / e.
    const R = { man: { quick: { stand: 11, prone: 12 }, vt: { stand: 13, prone: 14 } }, vehicle: 15, tube: { quick: 16, vt: 17 } };
    const guns = { ...BASE_GUNS, lethalRadiusM: R };
    const up = (r: number) => Math.sqrt(r * r - 49);
    expect(killChance('man', false, 11, 'quick', guns)).toBeCloseTo(0.92 / Math.E, 9);
    expect(killChance('man', true, 12, 'quick', guns)).toBeCloseTo(0.92 / Math.E, 9);
    expect(killChance('man', false, up(13), 'vt', guns)).toBeCloseTo(0.92 / Math.E, 9);
    expect(killChance('man', true, up(14), 'vt', guns)).toBeCloseTo(0.92 / Math.E, 9);
    expect(killChance('veh', false, 15, 'quick', guns)).toBeCloseTo(0.9 / Math.E, 9);
    expect(killChance('tube', false, 16, 'quick', guns)).toBeCloseTo(0.9 / Math.E, 9);
    expect(killChance('tube', false, up(17), 'vt', guns)).toBeCloseTo(0.9 / Math.E, 9);
  });
});

// The four guns are #118's 게임 조정 묶음, written out in full: a changed number goes red here by name.
const W = [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]];
const R155 = { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } };
const p155 = { tof: { baseS: 3, sPerKm: 2.6 }, peRange: { baseM: 2, mPerKm: 1.5 }, peDeflection: { baseM: 1, mPerKm: 0.5 }, sheaf: W, lethalRadiusM: R155 };

test('포 프로파일: 다섯 프로파일의 숫자', () => {
  expect(GUNS.map((g) => g.profile.id)).toEqual(['base', 'kh178', 'kh179', 'k55', 'k9']); // base first
  expect(GUNS[0]!.profile).toBe(BASE_GUNS);
  const [, kh178, kh179, k55, k9] = GUNS.map((g) => g.profile);
  expect(kh178).toEqual({
    id: 'kh178',
    version: 1,
    maxRangeM: 14700,
    tof: { baseS: 4.22, sPerKm: 3.66 },
    peRange: { baseM: 2.53, mPerKm: 1.89 },
    peDeflection: { baseM: 1.26, mPerKm: 0.63 },
    sheaf: W,
    ffe: { intervalS: 4, jitterS: 0.98 },
    lethalRadiusM: { man: { quick: { stand: 20.6, prone: 11.9 }, vt: { stand: 22.1, prone: 19.0 } }, vehicle: 5.5, tube: { quick: 7.9, vt: 5.5 } },
  });
  expect(kh179).toEqual({ id: 'kh179', version: 1, maxRangeM: 24000, ...p155, ffe: { intervalS: 15, jitterS: 3.67 } });
  expect(k55).toEqual({ ...kh179, id: 'k55' }); // KH179 and K55: the same to the last number
  expect(k9).toEqual({ id: 'k9', version: 1, maxRangeM: 40000, ...p155, tof: { baseS: 2.2, sPerKm: 1.91 }, ffe: { intervalS: 7.5, jitterS: 1.83 } });
  for (const g of GUNS) expect(g.profile.sheaf, g.profile.id).toHaveLength(6); // 문수 6 for all five
  expect(GUNS.map((g) => g.name)).toEqual(['155mm 견인포', 'KH178 105mm 견인포', 'KH179 155mm 견인포', 'K55 155mm 자주포', 'K9 155mm 자주포']);
  expect(GUNS[3]!.blurb).toContain('탄도는 KH179와 같다');
});

// 포대 삼발 under #118's measure A: lethality.test.ts's harness (one rifle platoon in line 9.1 km from the battery,
// 6 guns × 3 rounds with no bias, standing for the first volley and prone after, 순발), each profile's own sheaf, PE and R.
const RUNS = 2000;
const CENTRE = { x: BASE_SCENARIO.battery.x + 800, y: BASE_SCENARIO.battery.y + 9100 };
const formations = Array.from({ length: RUNS }, (_, i) => {
  const sim = createSim({ ...init(i + 1), scenario: { ...BASE_SCENARIO, units: [{ type: 'inf', route: 'B', t0: 0 }] } });
  return sim.state.platoons[0]!.members.map((m) => ({ u: m.u, v: m.v }));
});
function threeRounds(guns: GunProfile): number {
  let dead = 0;
  let total = 0;
  formations.forEach((f, i) => {
    const bal = createStreams(i + 1).bal;
    const men = f.map((m) => ({ kind: 'man' as const, x: CENTRE.x - m.u, y: CENTRE.y - m.v, prone: false, alive: true }));
    next(bal); // the harness's aim-error bearing, drawn here too so the draws match it
    for (let k = 0; k < 3; k++) {
      if (k > 0) for (const m of men) m.prone = true;
      for (const g of guns.sheaf) {
        const p = fall(CENTRE, BASE_SCENARIO.battery, { x: 0, y: 0 }, bal, guns, g);
        killMembers(men, p.x, p.y, 'quick', bal, guns);
      }
    }
    dead += men.filter((m) => !m.alive).length;
    total += men.length;
  });
  return (dead / total) * 100;
}

test('포 프로파일: 포대 삼발 살상률의 범위', () => {
  // PRD §6's anchor for base and the 155mm guns; #118's measured 46–53 % for the 105mm.
  const range: Record<string, [number, number]> = { base: [70, 80], kh178: [46, 53], kh179: [70, 80], k55: [70, 80], k9: [70, 80] };
  for (const { profile } of GUNS) {
    const c = threeRounds(profile);
    const [lo, hi] = range[profile.id]!;
    expect(c >= lo && c <= hi, `${profile.id}: ${c.toFixed(1)} % in ${lo}–${hi}`).toBe(true);
  }
}, 60000);
