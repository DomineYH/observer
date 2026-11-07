// 종료와 판 기록 (#36, F-13): when a game ends, and what its record says.
// Public interface only: create, step, events, read-only state, record.
import { describe, expect, test } from 'vitest';
import { START } from './init';
import { cleared, FFE5, INF_RECON, playOut } from './end';
import { started as noEnemy } from './mission';
import { mortarAt, oneUnit, started } from './enemy';
import { CALM, aimedAt, gridAt, isImpact, toEffect, untilLanded } from './strike';
import { flatTerrain } from './terrain';
import { CALL_ADJUST, CALL_FFE, corr, desc, EOM, openRadio, REPEAT, toReady, untilSaid, untilTaken } from './mission';
import type { Point, PostEvent, Scenario, SimEvent } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';

const posts = (events: readonly SimEvent[]) => events.filter((e): e is PostEvent => e.type === 'post');
/** The platoon as the scenario's only unit (no RESERVE). */
const SEED4 = 7;
/** 방향 from the flat terrain's post (320, 320) to `p`, mils 0–6399. */
const mils = (p: Point) => (Math.round((Math.atan2(p.x - 320, p.y - 320) * 3200) / Math.PI) + 6400) % 6400;
const alone0 = (route: Point[]): Scenario => ({ ...oneUnit({ type: 'inf', route: 'A', t0: 0 }, route), units: [{ type: 'inf', route: 'A', t0: 0 }] });
const LIMIT = 48000; // 40분 한도
const SETTLE = 160; // 8 s: a game whose enemy is all down ends once nothing has been owed or in the air for this long

describe('F-13: 종료', () => {
  test('F-13: 섬멸로 종료', () => {
    const { sim, fell, last } = cleared();
    const end = sim.state.tick;
    expect(fell).toBeGreaterThan(0);
    expect(sim.state.phase).toBe('ended');
    const r = sim.record();
    expect(r.cleared).toBe(true);
    expect(r.clearTick).toBe(fell); // 섬멸 시간: the tick the last combat unit fell, in sim time
    // Rounds still in the air keep the game going; it ends 8 s after the last landed and 효과 관측 opened (2.5 s).
    expect(fell).toBeLessThan(last);
    expect(end - last).toBeGreaterThanOrEqual(SETTLE);
    expect(end - last).toBeLessThanOrEqual(SETTLE + 51);
    // 정찰조는 승패 조건에 들지 않는다: it is alive and unbroken all along.
    const recon = sim.state.platoons[1]!;
    expect(recon.members.every((m) => m.alive)).toBe(true);
    expect(['approach', 'hold']).toContain(recon.state);
    // Over: the clock stands still and every input is ignored.
    expect(sim.step([START, { a: 'bino', v: [1] }]).accepted).toEqual([false, false]);
    expect(sim.state.tick).toBe(end);

    // Lost after the 섬멸, inside the 8 s: no 섬멸. 임무끝 and a call on our own post keep 기러기 busy, so the game goes
    // on until a round finds the 관측반 (위험근접 applied: one adjusting round, then the 효력사).
    const late = aimedAt(INF_RECON, 2, 0, CALL_FFE, FFE5);
    for (let k = 0; k < 20000 && late.state.platoons[0]!.state !== 'destroyed'; k++) late.step([]);
    const at = late.state.tick;
    untilTaken(late, EOM('destroyed'));
    untilTaken(late, CALL_FFE);
    for (const input of [gridAt({ x: 320, y: 320 }), FFE5, corr(0, 'right', 0, 'add', 0, 'ffe')]) untilTaken(late, input);
    playOut(late);
    expect(late.state.observerLost).toBe(true);
    expect(late.state.phase).toBe('ended');
    expect(late.record()).toMatchObject({ cleared: false, clearTick: null, observerLost: true });
    expect(at).toBeGreaterThan(0);
  });

  test('F-13: 시간 한도로 종료', () => {
    // No enemy at all: only the limit can end it.
    const sim = noEnemy();
    while (sim.state.tick < LIMIT - 1) sim.step([]);
    expect(sim.state.phase).toBe('live');
    sim.step([]);
    expect(sim.state.tick).toBe(LIMIT);
    expect(sim.state.phase).toBe('ended');
    expect(sim.step([{ a: 'bino', v: [1] }]).accepted).toEqual([false]);
    expect(sim.state.tick).toBe(LIMIT);
    expect(sim.record()).toMatchObject({ ticks: LIMIT, cleared: false, clearTick: null });
    // A combat unit left alone (the mortar section 5 km off) does not end it before the limit either.
    const mortar = started(mortarAt({ x: 320, y: 5320 }));
    while (mortar.state.phase === 'live') mortar.step([]);
    expect(mortar.state.tick).toBe(LIMIT);
  }, 60000);

  test('F-13: 진지 돌파', () => {
    // An infantry platoon walking unhurt onto its objective 600 m north of the post (no friendly troops to stop it), and
    // a mortar section 5 km off that nobody fires on, so the game goes on.
    const route = [{ x: 320, y: 2320 }, { x: 320, y: 1500 }, { x: 320, y: 920 }];
    const two: Scenario = {
      ...oneUnit({ type: 'inf', route: 'A', t0: 0 }, route),
      units: [{ type: 'inf', route: 'A', t0: 0 }, { type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0 }],
      nais: [{ x: 320, y: 5320, r: 100, conf: 'low' }],
    };
    const sim = started(two, { weather: CALM }); // no 기상 잔차: the 효력사 below lands on the unit as the seed was chosen
    openRadio(sim);
    const p = sim.state.platoons[0]!;
    const goal = p.path.at(-1)!; // its objective: the route's end as this unit walks it
    const notes: PostEvent[] = [];
    let at = -1;
    for (let k = 0; k < 20000 && at < 0; k++) {
      const was = { x: p.x, y: p.y, score: sim.state.score };
      notes.push(...posts(sim.step([]).events));
      if (p.state === 'overran') {
        at = sim.state.tick;
        expect(Math.hypot(was.x - goal.x, was.y - goal.y)).toBeLessThan(80); // where it stood as the tick began
        expect(sim.state.score - was.score).toBe(-300);
      } else expect(Math.hypot(p.x - goal.x, p.y - goal.y)).toBeGreaterThanOrEqual(78); // checked every tick on the way
    }
    expect(at).toBeGreaterThan(0);
    expect(p.members.every((m) => m.alive)).toBe(true);
    expect(notes.filter((n) => n.what === 'overrun')).toEqual([{ type: 'post', tick: at, what: 'overrun', pid: 0 }]);
    // It holds the position: it moves no more, and our 효력사 on it kills men but no longer changes its state or scores.
    const there = { x: p.x, y: p.y };
    const score = sim.state.score;
    toReady(sim, FFE5, CALL_FFE, gridAt(p));
    untilLanded(sim);
    notes.push(...posts(untilTaken(sim, REPEAT('ineffective', 5)))); // 재효력사: past the 30 % that breaks a platoon
    for (let k = 0; k < 2500; k++) notes.push(...posts(sim.step([]).events));
    expect({ x: p.x, y: p.y }).toEqual(there);
    expect(p.members.filter((m) => !m.alive).length / p.members.length).toBeGreaterThanOrEqual(0.3);
    expect(p.state).toBe('overran');
    expect(sim.state.score - score).toBe(sim.state.missions[0]!.score); // the 전과 보고's points only
    expect(notes.filter((n) => n.what === 'overrun')).toHaveLength(1);
    expect(sim.state.phase).toBe('live'); // the mortar section is still up

    // When the platoon was the only combat unit, it is down once it overran: the game ends 8 s later, and is no 섬멸.
    const alone = started(alone0(route));
    let over = -1;
    for (let k = 0; k < 20000 && alone.state.phase === 'live'; k++) {
      alone.step([]);
      if (over < 0 && alone.state.platoons[0]!.state === 'overran') over = alone.state.tick;
    }
    expect(over).toBeGreaterThan(0);
    expect(alone.state.tick - over).toBe(SETTLE);
    expect(alone.record()).toMatchObject({ cleared: false, clearTick: null });

    // Thinned but unbroken (one adjusting round 40 m off kills a few), it still overruns.
    const hit = aimedAt(alone0(route), 7, 0, CALL_ADJUST, desc(1, 'quick', 'ready', 0, 'unknown'), { x: 40, y: 0 });
    untilLanded(hit);
    const q = hit.state.platoons[0]!;
    const cas = q.members.filter((m) => !m.alive).length / q.members.length;
    expect(cas > 0 && cas < 0.3, `casualties ${cas}`).toBe(true);
    expect(q.state, `${Math.hypot(q.x - q.path.at(-1)!.x, q.y - q.path.at(-1)!.y)} m`).toBe('approach');
    for (let k = 0; k < 20000 && q.state !== 'overran'; k++) hit.step([]);
    expect(q.state).toBe('overran');
  }, 30000);

  test('F-13: 진지 돌파 — 무력화된 소대는 돌파하지 않는다', () => {
    // INF_RECON's platoon broken or destroyed on its approach never overruns, and that game is a 섬멸.
    const { sim } = cleared();
    expect(['broken', 'destroyed']).toContain(sim.state.platoons[0]!.state);
    expect(sim.record().cleared).toBe(true);
  });

  test('F-13: 판 기록 항목', () => {
    // The mortar section dug in 1.4 km north of the post (and the reserve), one friendly position 1.3 km NE. Three
    // missions: A 조정 100 m off → 수정 with 방향 → 효력사, reported as it is; B 조정 on it → 효력사, reported wrong; C on
    // no unit at all, 30 m from our position, 위험근접 not declared (기러기 adjusts first), reported 효과 미흡.
    const FRIEND = { x: 1280, y: 1200 };
    const MORTAR = { x: 320, y: 1720 };
    const sc: Scenario = { ...mortarAt(MORTAR), friends: [FRIEND] };
    const sim = started(sc, { seed: SEED4, terrain: flatTerrain({ n: 256 }) });
    const seen: SimEvent[] = [];
    const step = sim.step;
    sim.step = (inputs) => {
      const r = step(inputs);
      seen.push(...r.events);
      return r;
    };
    const impacts = () => seen.filter(isImpact).length;
    let corrections = 0;
    const toFfe = (from: Point) => {
      untilLanded(sim);
      untilTaken(sim, corr(mils(from), 'right', 0, 'add', 0, 'ffe'));
      corrections++;
      // Rounds in the air count as used: once 기러기 says 떳다, the record holds the whole 효력사.
      untilSaid(sim, 'fdc', 'shot');
      const m = sim.state.missions.at(-1)!;
      expect(sim.record().roundsTotal - impacts()).toBe(6 * m.mto!.rounds);
      toEffect(sim);
    };
    const truth = () => {
      const p = sim.state.platoons[0]!;
      const cas = p.members.filter((q) => !q.alive).length / p.members.length;
      return cas >= 0.6 ? 'destroyed' : cas >= 0.3 ? 'neutralized' : 'ineffective';
    };
    const wrong = (e: string) => (e === 'ineffective' ? 'neutralized' : 'ineffective');
    openRadio(sim);
    toReady(sim, desc(3, 'quick', 'ready', 0, 'unknown'), CALL_ADJUST, gridAt({ x: MORTAR.x + 100, y: MORTAR.y }));
    untilLanded(sim);
    untilTaken(sim, corr(mils(MORTAR), 'left', 100, 'add', 0, 'ffe'));
    corrections++;
    toEffect(sim);
    untilTaken(sim, EOM(truth()));
    toReady(sim, desc(3, 'quick', 'ready', 0, 'unknown'), CALL_ADJUST, gridAt(MORTAR));
    toFfe(MORTAR);
    untilTaken(sim, EOM(wrong(truth())));
    const C = { x: FRIEND.x, y: FRIEND.y + 30 };
    toReady(sim, desc(3, 'quick', 'ready', 0, 'unknown'), CALL_FFE, gridAt(C));
    toFfe(C);
    untilTaken(sim, EOM('ineffective'));
    const ms = sim.state.missions;
    expect(ms.map((m) => [m.target, m.firstError !== null, m.directionError !== null, m.dangerMissed])).toEqual([
      [0, true, true, false],
      [0, true, true, false],
      [-1, false, false, true],
    ]);
    const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
    const hits = seen.filter((e) => e.type === 'post' && e.what === 'friendly_hit').length;
    expect(hits).toBeGreaterThan(0);
    const r = sim.record();
    expect(r).toMatchObject({
      ticks: sim.state.tick,
      seed: SEED4,
      seedKind: 'daily',
      roundsTotal: impacts(),
      missions: 3,
      adjustRounds: corrections,
      firstErrorAvg: mean([ms[0]!.firstError!, ms[1]!.firstError!]),
      directionErrorAvg: mean([ms[0]!.directionError!, ms[1]!.directionError!]),
      reportAccuracyPct: 50, // A right, B wrong; C had no unit to judge
      friendlyHits: hits,
      friendlyLosses: sim.state.friendlies.filter((m) => !m.alive).length,
      dangerCloseMissed: 1,
      observerLost: false,
      postMoves: 0,
      compromised: seen.some((e) => e.type === 'post' && e.what === 'compromised'),
      score: sim.state.score,
      combatUnits: 2, // the mortar section and the reserve
      neutralized: ['broken', 'destroyed'].includes(sim.state.platoons[0]!.state) ? 1 : 0,
      earlyDefeats: 0, // no infantry
    });
    expect(r.roundsPerUnit).toBe(r.neutralized ? Math.round((10 * impacts()) / r.neutralized) / 10 : null);
    expect(r.friendlyLosses).toBeGreaterThan(0);
  }, 30000);

  test('F-13: 판 기록 항목 — 섬멸한 판', () => {
    // INF_RECON's platoon falls on its approach (조기 격퇴); the recon team counts nowhere.
    const { sim, fell } = cleared();
    const r = sim.record();
    expect(sim.state.platoons[0]!.assaultTick).toBe(-1);
    expect(r).toMatchObject({ cleared: true, clearTick: fell, neutralized: 1, combatUnits: 1, earlyDefeats: 1, missions: 1, adjustRounds: 0 });
    expect(r.roundsPerUnit).toBe(r.roundsTotal);
    expect(r.firstErrorAvg).toBeNull(); // 바로 효력사
    expect(r.reportAccuracyPct).toBeNull(); // nothing reported
  });

  test('F-13: 판 기록 항목 — 부대당 탄과 조기 격퇴', () => {
    // Two platoons walking together; one adjusting round, then a 포대 오발 that destroys both (seed 2): 31 rounds for
    // two units.
    const two: Scenario = { ...BASE_SCENARIO, units: [{ type: 'inf', route: 'B', t0: 0 }, { type: 'inf', route: 'B', t0: 0 }], friends: [] };
    const sim = aimedAt(two, 2, 0, CALL_ADJUST, FFE5);
    untilLanded(sim);
    untilTaken(sim, corr(mils(sim.state.platoons[0]!), 'right', 0, 'add', 0, 'ffe'));
    playOut(sim);
    expect(sim.record()).toMatchObject({ roundsTotal: 31, neutralized: 2, roundsPerUnit: 15.5, earlyDefeats: 2, cleared: true });
    // Broken in its assault: no 조기 격퇴 (kills.test's platoon 1.2 km off, already assaulting).
    const near = oneUnit({ type: 'inf', route: 'B', t0: 0 }, [{ x: 900, y: 1400 }, { x: 900, y: 1300 }, { x: 900, y: 1000 }]);
    const late = aimedAt(near, 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
    expect(late.state.platoons[0]!.state).toBe('assault');
    playOut(late, 0, 3000);
    expect(late.record()).toMatchObject({ neutralized: 1, earlyDefeats: 0 });
  });

  test('F-13: 판 기록 항목 — 사격 없는 판', () => {
    const sim = noEnemy();
    for (let k = 0; k < 100; k++) sim.step([]);
    expect(sim.record()).toEqual({
      ticks: 101,
      seed: 7,
      seedKind: 'daily',
      cleared: false,
      clearTick: null,
      roundsTotal: 0,
      missions: 0,
      adjustRounds: 0,
      firstErrorAvg: null,
      directionErrorAvg: null,
      reportAccuracyPct: null,
      roundsPerUnit: null,
      neutralized: 0,
      combatUnits: 0,
      earlyDefeats: 0,
      friendlyHits: 0,
      friendlyLosses: 0,
      dangerCloseMissed: 0,
      observerLost: false,
      postMoves: 0,
      compromised: false,
      score: sim.state.score,
    });
  });
});
