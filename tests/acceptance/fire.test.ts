// 발사·탄착·수정 (#28): 준비 쏴 or the automatic shot, the round's flight and fall, and the observer's corrections.
// Public interface only: create, step, events, read-only state.
import { describe, expect, test } from 'vitest';
import { fromGrid, validateReplay, type Input, type RadioEvent, type Sim } from '@sim';
import { radioSentence, spoken } from '@ui/radio/sentence';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { drawEffects } from '@render/effects';
import { splashOf } from '@render/overlay';
import { focalOf, MIL } from '@render/projection';
import { createViewBuffers } from '@render/voxel';
import { CALL_ADJUST, corr, DESC_AMC, DESC_UNKNOWN, FIRE, LOC, LOC_NEAR, NO_TROOPS, openRadio, radioEvents, send, started, toAdjust, toReady, untilImpact, untilSaid } from './mission';
import { replayData, START } from './init';
import { flatTerrain } from './terrain';

const said = (e: RadioEvent) => [e.utterance.speaker, e.utterance.kind, e.utterance.ending];
const opened = (seed = 7): Sim => {
  const sim = started(seed);
  openRadio(sim);
  return sim;
};

describe('F-09: 지명사와 발사', () => {
  test('지명사면 준비 쏴를 기다리고 아니면 사격준비 끝 1.5초 뒤 쏜다', () => {
    // 지명사: before 사격준비 끝 준비 쏴 is ignored and changes nothing.
    const sim = opened();
    const twin = opened();
    expect(send(sim, FIRE).ok).toBe(false);
    twin.step([]);
    toReady(sim, DESC_AMC);
    toReady(twin, DESC_AMC);
    expect(sim.hash()).toBe(twin.hash());
    // 기러기 waits: nothing is said for 20 s.
    expect(radioEvents(sim, 400)).toEqual([]);

    const fire = send(sim, FIRE);
    expect(fire.ok).toBe(true);
    expect(fire.events.map(said)).toEqual([['observer', 'fire', 'none']]);
    const sent = fire.events[0]!.tick - 1;
    const flight = untilSaid(sim, 'observer', 'shot');
    expect(flight.map(said)).toEqual([
      ['fdc', 'shot', 'over'],
      ['observer', 'shot', 'wait'],
    ]);
    const shot = flight[0]!.tick;
    expect(shot - sent >= 20 && shot - sent <= 40, `shot ${shot - sent} ticks after 준비 쏴`).toBe(true);
    expect(flight[1]!.tick - shot).toBe(24); // 1.2 s

    // A second 준비 쏴 while the round flies is ignored and changes nothing.
    radioEvents(twin, 400);
    twin.step([FIRE]);
    untilSaid(twin, 'observer', 'shot');
    expect(send(sim, FIRE).ok).toBe(false);
    twin.step([]);
    expect(sim.hash()).toBe(twin.hash());

    // 준비되는 대로: the shot goes 1.5 s after 사격준비 끝 by itself, and 준비 쏴 is ignored.
    const auto = opened();
    const ready = toReady(auto).at(-1)!;
    expect(send(auto, FIRE).ok).toBe(false);
    const shot2 = untilSaid(auto, 'fdc', 'shot').at(-1)!;
    expect(shot2.tick - ready.tick).toBe(30);
  });
});

describe('F-11: 비과시간', () => {
  test('탄착은 발사 3초 + 2.6초/km 뒤다', () => {
    const [, e, n] = LOC.v as [string, number, number];
    const aim = fromGrid(e, n, flatTerrain().grid);
    const d = Math.hypot(aim.x - BASE_SCENARIO.battery.x, aim.y - BASE_SCENARIO.battery.y);
    for (const seed of [1, 2, 3]) {
      const sim = opened(seed);
      toReady(sim);
      const { impact, said: before } = untilImpact(sim);
      const shot = before.find((x) => x.utterance.kind === 'shot')!;
      expect(impact.tick - shot.tick).toBe(Math.ceil((3 + (2.6 * d) / 1000) * 20));
    }
  });

  test('탄착까지 남은 초를 보이고 5초 이하에서 강조한다', () => {
    const sim = opened();
    toReady(sim);
    expect(splashOf(sim.state)).toBeNull();
    const shot = untilSaid(sim, 'fdc', 'shot').at(-1)!;
    const { impact } = untilImpact(sim);
    // Replay the flight on a twin and read the countdown at 6 s and 5 s before the impact.
    const twin = opened();
    toReady(twin);
    untilSaid(twin, 'fdc', 'shot');
    expect(splashOf(twin.state)).toEqual({ sec: Math.ceil((impact.tick - shot.tick) / 20), urgent: false });
    radioEvents(twin, impact.tick - 120 - twin.state.tick);
    expect(splashOf(twin.state)).toEqual({ sec: 6, urgent: false });
    radioEvents(twin, 1);
    expect(splashOf(twin.state)).toEqual({ sec: 6, urgent: false }); // 5.95 s left, rounded up
    radioEvents(twin, 19);
    expect(splashOf(twin.state)).toEqual({ sec: 5, urgent: true });
    expect(splashOf(sim.state)).toBeNull(); // landed
  });
});

describe('F-10: 탄착 분포 수치', () => {
  test('비표준 조건 오차와 공산오차는 수치표를 따르고 탄도 스트림만 쓴다', () => {
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
    const bias: { x: number; y: number }[] = [];
    const range: number[] = [];
    const defl: number[] = [];
    let gd = 0;
    // Calm at 15 °C: no 기상 잔차, so the bias is the random part alone (the residual is F-17's).
    const calm = { ...CLEAR_WEATHER, windSpeedTenthMs: 0, tempTenthC: 150 };
    for (let seed = 1; seed <= 300; seed++) {
      const sim = started(seed, NO_TROOPS, calm);
      openRadio(sim);
      const ready = toReady(sim).at(-1)!;
      const m = sim.state.missions[0]!;
      const before = structuredClone(sim.state.rng);
      const { impact } = untilImpact(sim);
      // From 사격준비 끝 to the impact only the ballistics stream moves: two gaussians for the one round.
      const { bal, ...others } = sim.state.rng;
      const { bal: bal0, ...others0 } = before;
      expect(bal.count - bal0.count).toBe(4);
      expect(others).toEqual(others0);
      expect(impact.tick).toBeGreaterThan(ready.tick);
      bias.push({ ...m.bias });
      const aim = m.aim!;
      gd = Math.hypot(aim.x - BASE_SCENARIO.battery.x, aim.y - BASE_SCENARIO.battery.y);
      const ux = (aim.x - BASE_SCENARIO.battery.x) / gd;
      const uy = (aim.y - BASE_SCENARIO.battery.y) / gd;
      const ex = impact.x - aim.x - m.bias.x;
      const ey = impact.y - aim.y - m.bias.y;
      range.push(Math.abs(ex * ux + ey * uy));
      defl.push(Math.abs(ex * uy - ey * ux));
    }
    // 30–90 m in every direction.
    const size = bias.map((b) => Math.hypot(b.x, b.y));
    expect(Math.min(...size)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...size)).toBeLessThanOrEqual(90);
    expect(Math.max(...size) - Math.min(...size)).toBeGreaterThan(50);
    expect(new Set(bias.map((b) => `${b.x > 0}${b.y > 0}`)).size).toBe(4);
    // 공산오차 = the median miss: range 1.5 m/km + 2 m, deflection 0.5 m/km + 1 m (≈ 12.2 m and 4.4 m at 6.8 km).
    expect(Math.abs(median(range) / ((1.5 * gd) / 1000 + 2) - 1)).toBeLessThan(0.2);
    expect(Math.abs(median(defl) / ((0.5 * gd) / 1000 + 1) - 1)).toBeLessThan(0.2);
  });

  test('수정탄은 포대 중앙의 조준점에 떨어진다', () => {
    // Where the one adjusting round falls from the aim + 비표준 조건 오차, in the battery's frame (range along the line of
    // fire, deflection across it), over 200 games: centred on 0 as the centre gun lays it. Every gun of the W sheaf
    // stands 12–60 m across and 22 m along from the centre, far outside these means (deflection PE ≈ 4.4 m, range ≈ 12 m
    // at 6.8 km: the mean of 200 is within about ±1.5 m and ±4 m; measured 0.6 m and 1.3 m).
    const calm = { ...CLEAR_WEATHER, windSpeedTenthMs: 0, tempTenthC: 150 };
    let range = 0;
    let defl = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      const sim = started(seed, NO_TROOPS, calm);
      openRadio(sim);
      toReady(sim);
      const { impact } = untilImpact(sim);
      const m = sim.state.missions[0]!;
      const aim = m.aim!;
      const gd = Math.hypot(aim.x - BASE_SCENARIO.battery.x, aim.y - BASE_SCENARIO.battery.y);
      const ux = (aim.x - BASE_SCENARIO.battery.x) / gd;
      const uy = (aim.y - BASE_SCENARIO.battery.y) / gd;
      const ex = impact.x - aim.x - m.bias.x;
      const ey = impact.y - aim.y - m.bias.y;
      range += (ex * ux + ey * uy) / N;
      defl += (ex * uy - ey * ux) / N; // to the right of the line of fire
    }
    expect(Math.abs(defl)).toBeLessThan(4);
    expect(Math.abs(range)).toBeLessThan(6);
  });

  test('수정탄은 중앙 포 한 발만 떨어진다', () => {
    const sim = opened();
    toReady(sim);
    untilImpact(sim);
    // Nothing else lands in the next 60 s.
    for (let k = 0; k < 1200; k++) expect(sim.step([]).events.filter((e) => e.type === 'impact')).toEqual([]);
  });
});

/** The 방향 from the observation post to the sent grid, mils. */
function trueDirection(): number {
  const [, e, n] = LOC.v as [string, number, number];
  const aim = fromGrid(e, n, flatTerrain().grid);
  const [ox, oy] = START.v as [number, number];
  return Math.round(((Math.atan2(aim.x - ox, aim.y - oy) * 3200) / Math.PI + 6400) % 6400);
}
const adjusting = (seed = 7) => {
  const sim = opened(seed);
  toReady(sim);
  toAdjust(sim);
  return sim;
};
const aimOf = (sim: Sim) => ({ ...sim.state.missions[0]!.aim! });

describe('F-07: 방향과 수정 기준선', () => {
  test('첫 수정은 방향이 있어야 하고 그 방향을 기준선으로 옮긴다', () => {
    const dir = trueDirection();
    // Without 방향 the first correction is not taken, and nothing changes.
    const sim = adjusting();
    const twin = adjusting();
    expect(send(sim, corr('right', 100, 'add', 0, 'adjust')).ok).toBe(false);
    twin.step([]);
    expect(sim.hash()).toBe(twin.hash());

    // With the true 방향: right 100 is 100 m square to the observer's line.
    const before = aimOf(sim);
    const sent = send(sim, corr(dir, 'right', 100, 'add', 0, 'adjust'));
    expect(sent.ok).toBe(true);
    expect(sent.events.map((e) => e.utterance)).toEqual([
      { speaker: 'observer', ending: 'over', kind: 'correction', slots: { direction: dir, lateralDir: 'right', lateral: 100, next: 'adjust' } },
    ]);
    const a = (dir * Math.PI) / 3200;
    const moved = { x: aimOf(sim).x - before.x, y: aimOf(sim).y - before.y };
    expect(moved.x).toBeCloseTo(100 * Math.cos(a), 6);
    expect(moved.y).toBeCloseTo(-100 * Math.sin(a), 6);

    // A 방향 400 mils off turns the same correction by 400 mils.
    const off = adjusting();
    const b0 = aimOf(off);
    expect(send(off, corr((dir + 400) % 6400, 'right', 100, 'add', 0, 'adjust')).ok).toBe(true);
    const turned = { x: aimOf(off).x - b0.x, y: aimOf(off).y - b0.y };
    expect(Math.hypot(turned.x, turned.y)).toBeCloseTo(100, 6);
    const az = (v: { x: number; y: number }) => (Math.atan2(v.x, v.y) * 3200) / Math.PI;
    expect((az(turned) - az(moved) + 6400) % 6400).toBeCloseTo(400, 6);

    // The 방향 goes with the first correction only: the next one carries none.
    toAdjust(sim);
    expect(send(sim, corr(dir, 'right', 50, 'add', 0, 'adjust')).ok).toBe(false);
    expect(send(sim, corr('right', 50, 'add', 0, 'adjust')).ok).toBe(true);
  });
});

describe('F-07: 수정 스냅', () => {
  const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
  /** The observer's correction for the first correction with these raw values, or null when it is not taken. */
  const first = (lr: string, lat: number, rr: string, rng: number, nextStep = 'adjust') => {
    const r = send(adjusting(), corr(1600, lr, lat, rr, rng, nextStep));
    return r.ok ? r.events[0]!.utterance : null;
  };
  const slots = (u: ReturnType<typeof first>) => (u && 'slots' in u ? u.slots : undefined);

  test('좌우는 10 m, 사거리는 50 m로 맞추고 0이 된 축은 뺀다', () => {
    expect(slots(first('left', 14, 'add', 74))).toEqual({ direction: 1600, lateralDir: 'left', lateral: 10, rangeDir: 'add', range: 50, next: 'adjust' });
    expect(slots(first('right', 15, 'drop', 75))).toEqual({ direction: 1600, lateralDir: 'right', lateral: 20, rangeDir: 'drop', range: 100, next: 'adjust' });
    expect(slots(first('right', 4, 'drop', 800))).toEqual({ direction: 1600, rangeDir: 'drop', range: 800, next: 'adjust' });
    const none = first('right', 4, 'add', 24)!;
    expect(slots(none)).toEqual({ direction: 1600, next: 'adjust' });
    expect(spoken(radioSentence(none, NAMES))).toBe('방향 하나여섯공공, 동제원, 이상.');
  });

  test('다음 수정탄은 맞춘 값만큼 옮겨 떨어진다', () => {
    const dir = trueDirection();
    const a = (dir * Math.PI) / 3200;
    /** The next round's impact after the first correction with these raw values. */
    const next = (lr: string, lat: number, rr: string, rng: number) => {
      const sim = adjusting();
      expect(send(sim, corr(dir, lr, lat, rr, rng, 'adjust')).ok).toBe(true);
      return untilImpact(sim).impact;
    };
    const stay = next('right', 0, 'add', 0); // the twin: 동제원
    // Raw values → the snapped move (+ right, + add) along the observer's 방향; under half a step moves nothing.
    for (const [lr, lat, rr, rng, right, add] of [
      ['left', 14, 'add', 74, -10, 50],
      ['right', 15, 'drop', 75, 20, -100],
      ['right', 4, 'add', 24, 0, 0],
      ['left', 5, 'drop', 25, -10, -50],
    ] as const) {
      const hit = next(lr, lat, rr, rng);
      const label = `${lr} ${lat}, ${rr} ${rng}`;
      expect(Math.abs(hit.x - stay.x - (right * Math.cos(a) + add * Math.sin(a))), label).toBeLessThanOrEqual(1);
      expect(Math.abs(hit.y - stay.y - (-right * Math.sin(a) + add * Math.cos(a))), label).toBeLessThanOrEqual(1);
    }
  });

  test('범위 밖 값과 모르는 다음은 받지 않는다', () => {
    for (const v of [
      ['right', 801, 'add', 0, 'adjust'],
      ['right', 0, 'add', 1501, 'adjust'],
      ['right', 0, 'add', 50, 'repeat'], // 다음 is 조정 or 효력사 only
      ['up', 10, 'add', 50, 'adjust'],
      ['right', 10.5, 'add', 50, 'adjust'],
    ] as const) {
      expect(first(...(v as unknown as [string, number, string, number, string])), v.join(' ')).toBeNull();
      const bad: Input = corr(1600, ...v);
      expect(validateReplay(replayData([{ t: 0, ...START }, { t: 5, ...bad }])).ok).toBe(false);
    }
    expect(validateReplay(replayData([{ t: 0, ...START }, { t: 5, ...corr(1600, 'right', 10, 'add', 50, 'adjust') }])).ok).toBe(true);
    expect(validateReplay(replayData([{ t: 0, ...START }, { t: 5, ...corr(6400, 'right', 10, 'add', 50, 'adjust') }])).ok).toBe(false);
  });
});

describe('F-07: 조정 반복', () => {
  const NAMES = { callsign: '갈매기', gridLetters: 'CH' };

  test('수정 뒤 포대 사격준비 끝이 오고 다음 수정탄이 옮긴 조준점에 떨어진다', () => {
    const dir = trueDirection();
    const run = (lat: number) => {
      const sim = adjusting();
      const sent = send(sim, corr(dir, 'right', lat, 'add', 0, 'adjust'));
      expect(sent.ok).toBe(true);
      const t0 = sent.events[0]!.tick - 1;
      const { impact, said: replies } = untilImpact(sim);
      return { sim, t0, impact, replies };
    };
    const moved = run(200);
    expect(moved.replies.map(said)).toEqual([
      ['fdc', 'correction', 'wait'],
      ['fdc', 'ready', 'none'],
      ['fdc', 'shot', 'over'],
      ['observer', 'shot', 'wait'],
    ]);
    const [readback, ready, shot] = moved.replies;
    const within = (d: number, lo: number, hi: number) => expect(d >= lo && d <= hi, `${d} in ${lo}–${hi}`).toBe(true);
    within(readback!.tick - moved.t0, 50, 80);
    within(ready!.tick - moved.t0, 220, 340);
    expect(shot!.tick - ready!.tick).toBe(30);
    expect('slots' in readback!.utterance && readback!.utterance.slots).toEqual({ direction: dir, lateralDir: 'right', lateral: 200, next: 'adjust' });
    expect(spoken(radioSentence(ready!.utterance, NAMES))).toBe('포대 사격준비 끝.');

    // The same seed with 동제원: the second round falls 200 m to the left of the moved one.
    const stay = run(0);
    const a = (dir * Math.PI) / 3200;
    expect(moved.impact.x - stay.impact.x).toBeCloseTo(200 * Math.cos(a), 0);
    expect(moved.impact.y - stay.impact.y).toBeCloseTo(-200 * Math.sin(a), 0);
  });

  test('지명사 임무는 수정 뒤에도 준비 쏴를 기다린다', () => {
    const sim = opened();
    toReady(sim, DESC_AMC);
    send(sim, FIRE);
    toAdjust(sim);
    expect(send(sim, corr(trueDirection(), 'left', 50, 'drop', 100, 'adjust')).ok).toBe(true);
    const replies = untilSaid(sim, 'fdc', 'ready');
    expect(replies.map(said)).toEqual([
      ['fdc', 'correction', 'wait'],
      ['fdc', 'ready', 'none'],
    ]);
    expect(radioEvents(sim, 400)).toEqual([]);
    expect(send(sim, FIRE).ok).toBe(true);
    expect(untilSaid(sim, 'fdc', 'shot').map(said)).toEqual([['fdc', 'shot', 'over']]);
  });
});

describe('F-10: 탄착 표시', () => {
  const W = 640;
  const EYE = { x: 320, y: 320, z: 103.5 };
  /** The view aimed at `at` drawn with only the effects (on black): the brightest red channel. */
  const brightest = (sim: Sim, at: { x: number; y: number }) => {
    const buf = createViewBuffers(W);
    const h = Math.atan2(at.x - EYE.x, at.y - EYE.y) * MIL;
    drawEffects(buf, { eye: EYE, h, focal: focalOf(W, sim.state.bino), cx: W / 2, hor: (W * 9) / 32 }, sim.state, CLEAR_WEATHER);
    let max = 0;
    for (let i = 0; i < buf.pix.length; i += 4) max = Math.max(max, buf.pix[i]!);
    return max;
  };

  test('탄착 사건에서 섬광, 이어서 연기·흙먼지가 그려진다', () => {
    const sim = opened();
    toReady(sim, DESC_UNKNOWN, CALL_ADJUST, LOC_NEAR);
    untilSaid(sim, 'observer', 'shot');
    const aim = sim.state.missions[0]!.aim!;
    expect(brightest(sim, aim)).toBe(0); // in the air: nothing yet
    const { impact } = untilImpact(sim);
    expect(brightest(sim, impact)).toBeGreaterThan(220); // 섬광
    radioEvents(sim, 60);
    const smoke = brightest(sim, impact);
    expect(smoke).toBeGreaterThan(20); // 연기·흙먼지, 3 s on
    expect(smoke).toBeLessThan(140);
    radioEvents(sim, 280);
    expect(brightest(sim, impact)).toBe(0); // gone after 16 s
  });

  test('시뮬레이션이 보지 못한 탄착은 그리지 않는다', () => {
    // 7.2 km away a burst is too small for the eye and seen through the binoculars.
    const seen = (bino: boolean) => {
      const sim = opened();
      if (bino) sim.step([{ a: 'bino', v: [1] }]);
      toReady(sim);
      const { impact } = untilImpact(sim);
      return brightest(sim, impact) > 0;
    };
    expect(seen(false)).toBe(false);
    expect(seen(true)).toBe(true);
  });
});
