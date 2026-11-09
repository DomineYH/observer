// 관측소 이동과 위치 보고 (F-21, B2): through the simulation's public interface only. The flat test terrain is 640 m
// square with the post at its middle (320, 320); destinations must stay 200 m inside every side.
import { describe, expect, test } from 'vitest';
import { createSim, fromGrid, type Input, type Point, type RadioEvent, type Sim, type SimEvent } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { planMove } from '@sim/post';
import { answered, CALL_ADJUST, CALL_FFE, corr, DESC_UNKNOWN, ended, EOM, LOC, LOC_CLEAR, MOVE, POLAR, openRadio, POS, POS_SKIP, SHIFT, send, started, toAdjust, toReady, unstarted, untilSaid, untilTaken } from './mission';
import { init, START } from './init';
import { flatTerrain } from './terrain';

/** 토블러 × 장비 휴대 0.85, km/h, at a grade (PRD 6: 6·exp(−3.5·|경사 + 0.05|) km/h). */
const tobler = (grade: number) => 6 * Math.exp(-3.5 * Math.abs(grade + 0.05)) * 0.85;
/** Walking speed of a plan, km/h. */
const kmh = (p: { dist: number; total: number }) => (3.6 * p.dist) / p.total;

/** A live simulation with the radio open: from the next step it takes a move. */
function live(seed = 7): Sim {
  const sim = started(seed);
  openRadio(sim);
  return sim;
}

const BINO_ON: Input = { a: 'bino', v: [1] };
const LASE: Input = { a: 'lase', v: [0, -100] };
const CAM: Input = { a: 'cam', v: [100, -50] };
const said = (events: readonly SimEvent[]) => events.filter((e): e is RadioEvent => e.type === 'radio').map((e) => e.utterance);

/** Steps both until `sim` has had the post note `what`; returns its tick. */
function untilNote(sim: Sim, twin: Sim | null, what: string, limit = 4000): number {
  for (let k = 0; k < limit; k++) {
    twin?.step([]);
    const e = sim.step([]).events.find((x) => x.type === 'post' && x.what === what);
    if (e) return e.tick;
  }
  throw new Error(`no ${what} in ${limit} ticks`);
}

/** A live sim (and its twin) whose post moved to (400, 320) and is set up: a 위치 보고 is due. */
function movedPair(): [Sim, Sim] {
  const pair = [live(), live()] as [Sim, Sim];
  for (const s of pair) {
    expect(s.step([MOVE(400, 320)]).accepted).toEqual([true]);
    untilNote(s, null, 'set_up');
  }
  return pair;
}
const SH = SHIFT(800, 'left', 0, 'add', 200, 3, 0, 'unknown');

/** Ticks from the step that takes `MOVE(440, 320)` from the post at (320, 320) to the post's arrival note. */
function arrivalTicks(terrain: ReturnType<typeof flatTerrain>): number {
  const sim = createSim({ ...init(7, terrain), scenario: { ...BASE_SCENARIO, units: [] } });
  sim.step([START]);
  openRadio(sim);
  const k = sim.state.tick;
  expect(sim.step([MOVE(440, 320)]).accepted).toEqual([true]);
  return untilNote(sim, null, 'arrived') - k;
}

/** Steps `sim` with `input` and `twin` with nothing: `input` is ignored and the two stay equal. */
function ignored(sim: Sim, twin: Sim, input: Input): void {
  expect(sim.step([input]).accepted, JSON.stringify(input)).toEqual([false]);
  twin.step([]);
  expect(sim.hash(), JSON.stringify(input)).toBe(twin.hash());
}

describe('B2', () => {
  test('B2: 이동의 네 변 가장자리', () => {
    // Every side, not only the three the demo checked (it forgot the north edge).
    for (const [x, y] of [[199, 320], [441, 320], [320, 199], [320, 441]] as const) ignored(live(), live(), MOVE(x, y));
    for (const [x, y] of [[200, 320], [440, 320], [320, 200], [320, 440]] as const)
      expect(live().step([MOVE(x, y)]).accepted, `${x} ${y}`).toEqual([true]);
  });
});

describe('F-21', () => {
  test('F-21: 도보 속도', () => {
    // 평지: 6·exp(−0.175)·0.85 ≈ 4.281 km/h (the PRD's "약 4.4" rounds it).
    const flat = flatTerrain({ n: 128 });
    const plain = planMove(flat, { x: 100, y: 100 }, { x: 100, y: 1100 });
    expect(plain.dist).toBe(1000);
    expect(kmh(plain)).toBeCloseTo(tobler(0), 9);
    expect(kmh(plain)).toBeCloseTo(4.281, 3);
    expect(plain.pts).toHaveLength(51); // 20 m steps, the start included
    expect(plain.forest).toBe(0);
    // 숲 ×0.7, and the metres walked under canopy are counted.
    const wood = flatTerrain({ n: 128 });
    wood.surface.fill(105);
    const forest = planMove(wood, { x: 100, y: 100 }, { x: 100, y: 1100 });
    expect(kmh(forest)).toBeCloseTo(tobler(0) * 0.7, 9);
    expect(forest.forest).toBeCloseTo(1000, 9);
    // A 10 % slope rising north: uphill is slower; 10 % down walks as fast as the flat (Tobler's peak is at −5 %).
    const ramp = flatTerrain({ n: 128 });
    for (let j = 0; j < ramp.n; j++) for (let i = 0; i < ramp.n; i++) ramp.ground[j * ramp.n + i] = ramp.surface[j * ramp.n + i] = 100 + j;
    expect(kmh(planMove(ramp, { x: 300, y: 200 }, { x: 300, y: 600 }))).toBeCloseTo(tobler(0.1), 6);
    expect(kmh(planMove(ramp, { x: 300, y: 600 }, { x: 300, y: 200 }))).toBeCloseTo(tobler(-0.1), 6);

    // Through the simulation: from (320, 320), 120 m east to (440, 320), the post reports its arrival at the tick the
    // walk takes. On the flat that is 120 m at 6·exp(−0.175)·0.85 ≈ 4.28 km/h (PRD 6: "평지 약 4.4 km/h" rounds this; the
    // 0.85 is inside it, so not 4.4 × 0.85): 100.9 s, 2018 ticks.
    const v = tobler(0) / 3.6; // m/s
    expect(arrivalTicks(flatTerrain())).toBeGreaterThanOrEqual(Math.ceil((120 / v) * 20) - 1);
    expect(arrivalTicks(flatTerrain())).toBeLessThanOrEqual(Math.ceil((120 / v) * 20) + 1);
    // A forest band (cells 35–40, x 350–405 m) on the way: the 20 m steps ending at x 360, 380, 400 are under the canopy,
    // so 60 m go at 0.7 × the speed and 60 m at full speed: 60/v + 60/(0.7 v) ≈ 123.3 s, 2466 ticks.
    const band = flatTerrain();
    for (let j = 0; j < band.n; j++) for (let i = 35; i <= 40; i++) band.surface[j * band.n + i] = 105;
    const forestTicks = Math.ceil((60 / v + 60 / (0.7 * v)) * 20);
    expect(arrivalTicks(band)).toBeGreaterThanOrEqual(forestTicks - 1);
    expect(arrivalTicks(band)).toBeLessThanOrEqual(forestTicks + 1);
  });

  test('F-21: 도보 속도 — 관측소는 그 속도로 걷고 도착한다', () => {
    const sim = live();
    const k = sim.state.tick;
    expect(sim.step([MOVE(440, 320)]).accepted).toEqual([true]);
    const arrive = k + Math.ceil((120 / ((tobler(0) / 3.6))) * 20);
    const half = Math.round((k + arrive) / 2);
    while (sim.state.tick < half) sim.step([]);
    expect(sim.state.op.x).toBeCloseTo(380, 0);
    expect(sim.state.op.y).toBe(320);
    while (sim.state.tick < arrive - 1) sim.step([]);
    expect(sim.state.op.x).toBeLessThan(440);
    const events = sim.step([]).events;
    expect(sim.state.op).toEqual({ x: 440, y: 320 });
    expect(events).toContainEqual({ type: 'post', tick: arrive, what: 'arrived' });
  });

  test('F-21: 이동 중 제한과 장비 설치', () => {
    const [sim, twin] = [live(), live()];
    for (const s of [sim, twin]) expect(s.step([BINO_ON]).accepted).toEqual([true]);
    // The move turns the binoculars off and tells 기러기, who answers 2.5–3.5 s later.
    let r = [sim, twin].map((s) => s.step([MOVE(440, 320)]));
    expect(r[0]!.accepted).toEqual([true]);
    expect(sim.state.bino).toBe(false);
    const sent = r[0]!.events[0]!.tick;
    expect(said(r[0]!.events)).toEqual([{ speaker: 'observer', ending: 'over', kind: 'move_notice' }]);
    // While moving: 육안 only. Binoculars, laser, a call and another move are ignored; aiming is not.
    for (const input of [BINO_ON, LASE, CALL_FFE, MOVE(300, 300)]) ignored(sim, twin, input);
    r = [sim, twin].map((s) => s.step([CAM]));
    expect(r[0]!.accepted).toEqual([true]);
    let reply = -1;
    for (let k = 0; k < 80 && reply < 0; k++) {
      const u = sim.step([]).events.find((e) => e.type === 'radio' && e.utterance.speaker === 'fdc');
      twin.step([]);
      if (u) {
        expect(said([u])).toEqual([{ speaker: 'fdc', ending: 'over', kind: 'move_notice' }]);
        reply = u.tick;
      }
    }
    expect(reply - (sent - 1)).toBeGreaterThanOrEqual(50);
    expect(reply - (sent - 1)).toBeLessThanOrEqual(70);
    // Arrived: 장비 설치 30 s. The laser waits for it; the binoculars do not (demo).
    const arrived = untilNote(sim, twin, 'arrived');
    while (sim.state.tick < arrived + 599) {
      expect(sim.step([LASE]).accepted).toEqual([false]);
      twin.step([]);
    }
    expect(sim.hash()).toBe(twin.hash());
    const ready = sim.step([LASE]);
    expect(ready.accepted).toEqual([false]);
    expect(ready.events).toContainEqual({ type: 'post', tick: arrived + 600, what: 'set_up' });
    expect(sim.step([LASE]).accepted).toEqual([true]);
    expect(sim.step([BINO_ON]).accepted).toEqual([true]);
  });

  test('F-21: 이동 중 제한과 장비 설치 — 작전 준비와 사격 임무 중에는 이동하지 않는다', () => {
    ignored(unstarted(), unstarted(), MOVE(300, 300));
    const sim = live();
    toReady(sim, undefined, CALL_FFE, LOC);
    expect(send(sim, MOVE(300, 300)).ok).toBe(false); // a mission under way, up to its 임무끝
    untilTaken(sim, EOM('ineffective'));
    expect(send(sim, MOVE(300, 300)).ok).toBe(true);
  });

  test('F-21: 이동 중 제한과 장비 설치 — 도착 30초 뒤 장비를 쓴다 (설치 중 쌍안경)', () => {
    const sim = live();
    sim.step([MOVE(330, 320)]);
    untilNote(sim, null, 'arrived');
    expect(sim.step([BINO_ON]).accepted).toEqual([true]); // demo 1385: only walking refuses them
  });

  test('F-21: 보고 전 사격요구 차단', () => {
    const [sim, twin] = movedPair();
    expect(sim.state.reportDue).toBe(true);
    ignored(sim, twin, CALL_ADJUST);
    // The report goes out; until 기러기 has read it back (3–4 s) no call is taken, nor a second report or a skip.
    const r = sim.step([POS(4040, 3032)]);
    expect(r.accepted).toEqual([true]);
    const sent = r.events[0]!.tick;
    expect(said(r.events)).toEqual([{ speaker: 'observer', ending: 'over', kind: 'position_report', slots: { easting: 4040, northing: 3032 } }]);
    let back = -1;
    while (back < 0) {
      expect(sim.state.tick - sent).toBeLessThan(90);
      const step = sim.step([CALL_ADJUST, POS(4040, 3032), POS_SKIP]);
      expect(step.accepted).toEqual([false, false, false]);
      const u = said(step.events);
      if (u.length) {
        expect(u).toEqual([{ speaker: 'fdc', ending: 'over', kind: 'position_report', slots: { easting: 4040, northing: 3032 } }]);
        back = step.events[0]!.tick;
      }
    }
    expect(back - (sent - 1)).toBeGreaterThanOrEqual(60);
    expect(back - (sent - 1)).toBeLessThanOrEqual(80);
    expect(sim.state.reportDue).toBe(false);
    expect(send(sim, CALL_ADJUST).ok).toBe(true);
    // Skipping: the call goes in the very next step.
    expect(twin.step([POS_SKIP]).accepted).toEqual([true]);
    expect(send(twin, CALL_ADJUST).ok).toBe(true);
  });

  test('F-21: 보고 전 사격요구 차단 — 전이도 막고, 보고·생략의 상태 가드', () => {
    // A 전이 after 임무끝 waits for the report too.
    const [a, b] = [live(), live()];
    for (const s of [a, b]) {
      ended(s);
      s.step([MOVE(400, 320)]);
      untilNote(s, null, 'set_up');
    }
    ignored(a, b, SH);
    expect(a.step([POS_SKIP, SH]).accepted).toEqual([true, true]);
    // No report due (skipped at the start), and while walking or setting up: ignored. Malformed: ignored.
    const [c, d] = [live(), live()];
    for (const input of [POS(4040, 3032), POS_SKIP]) ignored(c, d, input);
    for (const s of [c, d]) s.step([MOVE(400, 320)]);
    for (const input of [POS(4040, 3032), POS_SKIP]) ignored(c, d, input);
    untilNote(c, d, 'arrived');
    for (const input of [POS(4040, 3032), POS_SKIP, POS(10000, 1), { a: 'pos_skip', v: [] }, { a: 'pos', v: [4040] }]) ignored(c, d, input);
    // Started away from the planned post: before 감명 양호 a report is ignored (the skip is not); calls wait for either.
    const [e, f] = [started(), started()];
    ignored(e, f, POS(4040, 3032));
    for (const s of [e, f]) untilSaid(s, 'observer', 'radio_check_reply');
    ignored(e, f, CALL_ADJUST);
    expect(e.step([POS(3200, 3200)]).accepted).toEqual([true]);
    expect(f.step([POS_SKIP, CALL_ADJUST]).accepted).toEqual([true, true]);
  });

  test('F-21: 극좌표 환산 기준', () => {
    // After a move to (400, 320): (A) reported at its grid, (B) skipped, (C) reported 300 m east of it.
    const runs = { A: POS(4040, 3032), B: POS_SKIP, C: POS(4070, 3032) };
    const known: Record<string, Point> = {};
    const polarAim: Record<string, Point> = {};
    const gridAim: Record<string, Point> = {};
    const grid = flatTerrain().grid;
    for (const [k, report] of Object.entries(runs)) {
      const [sim] = movedPair();
      expect(sim.step([report]).accepted).toEqual([true]);
      if (k !== 'B') untilSaid(sim, 'fdc', 'position_report');
      known[k] = { ...sim.state.knownOp };
      // 극좌표: 방위각 0800, 1000 m from the post 기러기 knows.
      expect(send(sim, CALL_ADJUST).ok).toBe(true);
      answered(sim, 'call');
      expect(send(sim, POLAR(800, 1000)).ok).toBe(true);
      polarAim[k] = { ...sim.state.missions[0]!.aim! };
      // 좌표법 + 방향: a second post, the same mission sent by grid with its first correction carrying 방향.
      const [g] = movedPair();
      g.step([report]);
      if (k !== 'B') untilSaid(g, 'fdc', 'position_report');
      toReady(g, DESC_UNKNOWN, CALL_ADJUST, LOC_CLEAR);
      toAdjust(g);
      expect(send(g, corr(800, 'right', 100, 'add', 200, 'adjust')).ok).toBe(true);
      gridAim[k] = { ...g.state.missions[0]!.aim! };
    }
    expect(known.A).toEqual(fromGrid(4040, 3032, grid)); // (405, 325): the cell's centre
    expect(known.B).toEqual(BASE_SCENARIO.plannedOp); // the old post: the planned one
    expect(known.C).toEqual(fromGrid(4070, 3032, grid));
    const a = (800 * Math.PI) / 3200;
    for (const k of ['A', 'B', 'C']) {
      expect(polarAim[k]!.x).toBeCloseTo(known[k]!.x + Math.sin(a) * 1000, 6);
      expect(polarAim[k]!.y).toBeCloseTo(known[k]!.y + Math.cos(a) * 1000, 6);
    }
    // A wrong report shifts the polar target by the same error; grid + 방향 does not move at all.
    expect(polarAim.C!.x - polarAim.A!.x).toBeCloseTo(300, 6);
    expect(polarAim.C!.y - polarAim.A!.y).toBeCloseTo(0, 6);
    expect(gridAim.B).toEqual(gridAim.A);
    expect(gridAim.C).toEqual(gridAim.A);
  });
});
