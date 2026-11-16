// 포 프로파일 (ADR 0014): base@1 holds the numbers the simulation code held before M3-2.
import { describe, expect, test } from 'vitest';
import type { GunProfile } from '@sim';
import { killChance } from '@sim/lethality';
import { BASE_GUNS } from '@content/guns';
import { init } from './init';
import { NO_ENEMY, oneMission } from './session';
import { isImpact } from './strike';

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

describe('포 프로파일: 시뮬레이션은 넘겨받은 프로파일의 수를 읽는다', () => {
  test('포 프로파일: 시뮬레이션은 넘겨받은 프로파일의 수를 읽는다 — 방렬·비과시간·효력사 간격·공산오차', () => {
    const base = volley(BASE_GUNS);
    expect(base.impacts).toHaveLength(18); // 포대 3발: six guns
    expect(volley({ ...BASE_GUNS, sheaf: BASE_GUNS.sheaf.slice(0, 2) }).impacts).toHaveLength(6); // the sheaf's length is the gun count
    const slow = volley({ ...BASE_GUNS, tof: { baseS: 30, sPerKm: 2.6 } });
    expect(slow.impacts[0]!.tick - slow.shot - (base.impacts[0]!.tick - base.shot)).toBe(540); // 27 s more 비과시간
    const one = { ...BASE_GUNS, sheaf: [[0, 0]] as const };
    const paced = volley({ ...one, ffe: { intervalS: 20, jitterS: 0 } }).impacts.map((e) => e.tick);
    expect(paced.slice(1).map((t, k) => t - paced[k]!)).toEqual([400, 400]); // one gun, 20 s apart, no jitter
    const exact = volley({ ...one, peRange: { baseM: 0, mPerKm: 0 }, peDeflection: { baseM: 0, mPerKm: 0 } }).impacts;
    expect(new Set(exact.map((e) => `${e.x},${e.y}`)).size).toBe(1); // no 공산오차: every round on the same point
    expect(new Set(volley(one).impacts.map((e) => `${e.x},${e.y}`)).size).toBe(3);
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
