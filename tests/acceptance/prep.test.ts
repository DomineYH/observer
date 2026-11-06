// 작전 준비와 개시 (F-22): through the simulation's public interface only.
import { describe, expect, test } from 'vitest';
import { createSim, replay, validateReplay } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { createSession } from '@app/session';
import { init, replayData, START } from './init';
import { flatTerrain } from './terrain';

describe('F-22', () => {
  test('F-22: 후보 가장자리 검사', () => {
    // The flat test terrain is 640 m square: candidates must stay 200 m inside every side, 200 m itself is allowed.
    const inside = [
      [200, 320],
      [440, 320],
      [320, 200],
      [320, 440],
    ];
    const outside = [
      [199, 320], // west
      [441, 320], // east
      [320, 199], // south
      [320, 441], // north
    ];
    for (const a of ['pick', 'start']) {
      for (const v of outside) {
        const sim = createSim(init(3));
        const twin = createSim(init(3));
        expect(sim.step([{ a, v }]).accepted, `${a} ${v}`).toEqual([false]);
        twin.step([]);
        expect(sim.hash(), `${a} ${v}`).toBe(twin.hash());
        expect(sim.state.phase).toBe('prep');
      }
      for (const v of inside) {
        const sim = createSim(init(3));
        expect(sim.step([{ a, v }]).accepted, `${a} ${v}`).toEqual([true]);
        expect(sim.state.op).toEqual({ x: v[0], y: v[1] });
      }
    }
    // 동·북 정수 미터: anything else is a format error, not an ignored input.
    for (const v of [[-1, 5], [1, 2, 3], [1.5, 300], [100000, 5]])
      expect(validateReplay(replayData([{ t: 0, a: 'pick', v }])).ok, String(v)).toBe(false);
    expect(validateReplay(replayData([{ t: 0, a: 'pick', v: [0, 99999] }])).ok).toBe(true);
  });

  test('F-22: 준비 중에는 시계가 멈춘다', () => {
    const sim = createSim(init(4));
    for (let i = 0; i < 30; i++) expect(sim.step([]).accepted).toEqual([]);
    expect(sim.state.tick).toBe(0);
    expect(sim.state.phase).toBe('prep');
    expect(sim.state.picked).toBe(false);

    // 관측소 후보 and 조준 are accepted while the clock stands still.
    expect(sim.step([{ a: 'pick', v: [250, 300] }, { a: 'cam', v: [100, 0] }]).accepted).toEqual([true, true]);
    expect(sim.state.tick).toBe(0);
    expect(sim.state.op).toEqual({ x: 250, y: 300 });
    expect(sim.state.picked).toBe(true);

    // 작전 개시 is the first tick of the operation; from then on every step is one tick.
    expect(sim.step([START]).accepted).toEqual([true]);
    expect(sim.state.phase).toBe('live');
    expect(sim.state.tick).toBe(1);
    sim.step([]);
    expect(sim.state.tick).toBe(2);
    expect(sim.record().ticks).toBe(2);

    // Choosing and starting are over once the operation runs.
    expect(sim.step([{ a: 'pick', v: [300, 300] }, START]).accepted).toEqual([false, false]);
    expect(sim.state.op).toEqual({ x: 320, y: 320 });
  });

  test('F-22: 준비 중 입력은 틱 0에 기록되고 재생된다', () => {
    const { terrain, ...rest } = init(6);
    const sim = createSim({ ...rest, terrain });
    const session = createSession(sim);
    session.send({ a: 'pick', v: [250, 260] });
    for (let i = 0; i < 5; i++) session.step();
    session.send({ a: 'pick', v: [300, 310] });
    session.step();
    session.send(START);
    for (let i = 0; i < 10; i++) session.step();
    session.send({ a: 'bino', v: [1] });
    session.step();
    expect(session.log).toEqual([
      { t: 0, a: 'pick', v: [250, 260] },
      { t: 0, a: 'pick', v: [300, 310] },
      { t: 0, ...START },
      { t: 10, a: 'bino', v: [1] },
    ]);

    // The replay feeds every t = 0 input in one step and reaches the same state.
    const data = replayData([...session.log], sim.state.tick, 6);
    expect(validateReplay(data).ok).toBe(true);
    const r = replay(data, terrain, BASE_SCENARIO);
    expect(r.ignored).toBe(0);
    expect(r.record).toEqual(sim.record());
    expect(r.record.ticks).toBe(11);
    const twin = createSim({ ...rest, terrain });
    for (let t = 0; t < 11; t++) twin.step(data.inputs.filter((x) => x.t === t));
    expect(twin.hash()).toBe(sim.hash());

    // A replay that never starts has no ticks to replay.
    expect(() => replay(replayData([{ t: 0, a: 'pick', v: [300, 300] }], 5, 6), terrain, BASE_SCENARIO)).toThrow(/not started/);
    // The scenario passed in must be the one the header names.
    expect(() => replay(data, terrain, { ...BASE_SCENARIO, version: 2 })).toThrow(/scenario/);
  });

  test('F-22: 계획과 다른 관측소', () => {
    const big = flatTerrain({ n: 1024 }); // the planned post (5120, 1800) must be on the map
    const { x, y } = BASE_SCENARIO.plannedOp;
    const startAt = (v: number[], before: { a: string; v: number[] }[] = []) => {
      const sim = createSim(init(8, big));
      sim.step(before);
      expect(sim.step([{ a: 'start', v }]).accepted).toEqual([true]);
      return sim.state;
    };
    // Starting without a pick occupies the planned post: no 위치 보고.
    let s = startAt([x, y]);
    expect(s.op).toEqual({ x, y });
    expect(s.reportDue).toBe(false);
    // Within 50 m still counts as the planned post (42 m here), 50 m exactly too.
    expect(startAt([x + 30, y + 30]).reportDue).toBe(false);
    expect(startAt([x + 30, y - 40]).reportDue).toBe(false);
    // Farther away the observation post stands where it was chosen and 위치 보고 is required.
    s = startAt([x + 51, y]);
    expect(s.op).toEqual({ x: x + 51, y });
    expect(s.reportDue).toBe(true);
    s = startAt([3000, 2500], [{ a: 'pick', v: [3000, 2500] }]);
    expect(s.op).toEqual({ x: 3000, y: 2500 });
    expect(s.reportDue).toBe(true);
  });

  test('F-22: 배치는 시드로 정해진다', () => {
    const deployed = (seed: number) => createSim(init(seed)).state.platoons;
    // In place at creation, before the operation starts; the same seed gives the same 실제 배치.
    expect(deployed(20261106)).toEqual(deployed(20261106));
    expect(deployed(20261107)).not.toEqual(deployed(20261106));
    const a = createSim(init(20261106));
    const b = createSim(init(20261107));
    expect(a.hash()).not.toBe(b.hash());

    // PRD 5.2: the 2nd platoon west or east, the APCs centre or east, the mortar somewhere in NAI 3.
    const seen = { recon: new Set<string>(), inf2: new Set<string>(), apc: new Set<string>() };
    const nai3 = BASE_SCENARIO.nais[2]!;
    for (let seed = 1; seed <= 60; seed++) {
      const p = deployed(seed);
      expect(p.map((u) => u.type)).toEqual(['recon', 'inf', 'inf', 'apc', 'mortar']);
      expect(p.map((u) => u.members.length)).toEqual([4, 30, 30, 2, 12]);
      expect(p[1]!.route).toBe('B');
      seen.recon.add(p[0]!.route!);
      seen.inf2.add(p[2]!.route!);
      seen.apc.add(p[3]!.route!);
      // Units on a route start at its (jittered) first point, within a few gauss·30 m of the scenario's.
      for (const u of p.slice(0, 4)) {
        const first = BASE_SCENARIO.routes[u.route!][0]!;
        expect(u.path).toHaveLength(3);
        expect({ x: u.x, y: u.y }).toEqual(u.path[0]);
        expect(Math.abs(u.x - first.x)).toBeLessThan(200);
        expect(Math.abs(u.y - first.y)).toBeLessThan(200);
      }
      const mortar = p[4]!;
      expect(mortar.route).toBeNull();
      expect(mortar.path).toEqual([]);
      expect(Math.abs(mortar.x - nai3.x)).toBeLessThanOrEqual(350);
      expect(Math.abs(mortar.y - nai3.y)).toBeLessThanOrEqual(250);
    }
    expect([...seen.recon].sort()).toEqual(['A', 'B']);
    expect([...seen.inf2].sort()).toEqual(['A', 'C']);
    expect([...seen.apc].sort()).toEqual(['B', 'C']);
  });
});
