// 레이저 (#31): a lase measures 방위각 · 수평거리 · 고저각 along the line it is sent on and tells a reflection from a seen
// enemy in the reticle's middle; its error has its own stream, so lasing never changes where rounds land (B6).
// Public interface only: create, step, events, read-only state, record.
import { describe, expect, test } from 'vitest';
import { EYE_HEIGHT, type ImpactEvent, type Sim, type StreamName } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { angleTo, mortarAt, oneUnit, started } from './enemy';
import { CALL_FFE, desc, openRadio, unstarted } from './mission';
import { gridAt, isImpact, opened } from './strike';

const MIL = 3200 / Math.PI;
const LASE = (az: number, el: number) => ({ a: 'lase', v: [Math.round(az + 64000) % 64000, Math.round(el)] });
/** Where on a member a press or a lase lands, m above the ground (intel.ts PICK_Z). */
const pickZ = (m: { kind: string; prone: boolean }) => (m.kind === 'veh' ? 1.2 : m.prone ? 0.25 : 0.9);
const STREAMS: readonly StreamName[] = ['scn', 'bal', 'fdc', 'exp', 'ai', 'las'];
const counts = (sim: Sim) => STREAMS.map((n) => sim.state.rng[n].count);

describe('F-05: 레이저 측정', () => {
  // The crew of a mortar section dug in 700 m north of the flat-terrain post, seen by eye.
  const crewSim = () => {
    const sim = started(mortarAt({ x: 320, y: 1020 }));
    const men = sim.state.platoons[0]!.members.filter((m) => m.kind === 'man' && m.vis);
    expect(men.length).toBeGreaterThan(0);
    // The man farthest clockwise: nothing seen lies beyond him in azimuth.
    const man = men.reduce((a, b) => (angleTo(sim, b).az > angleTo(sim, a).az ? b : a));
    return { sim, man, at: angleTo(sim, man) };
  };

  test('작전 개시 전에는 쏘지 않는다', () => {
    const sim = unstarted();
    expect(sim.step([LASE(0, -100)]).accepted).toEqual([false]);
    expect(sim.state.lases).toEqual([]);
  });

  test('레티클 중앙 1.5 밀 안의 적에서 반사를 잡고 방위각·수평거리·고저각을 낸다', () => {
    const { sim, man, at } = crewSim();
    const before = counts(sim);
    expect(sim.step([LASE(at.az, at.el)]).accepted).toEqual([true]);
    const l = sim.state.lases[0]!;
    const { op } = sim.state;
    const d = Math.hypot(man.x - op.x, man.y - op.y);
    expect(l.az).toBe(Math.round(at.az) % 64000);
    expect(l.range!.target).toBe(true);
    expect(Math.abs(l.range!.dist - d)).toBeLessThanOrEqual(8); // σ 2 m
    expect(Math.abs(l.range!.vm - Math.atan2(pickZ(man) - EYE_HEIGHT, d) * MIL)).toBeLessThanOrEqual(1.5);
    const a = (l.az / 10) / MIL;
    expect(l.range!.x).toBeCloseTo(op.x + Math.sin(a) * l.range!.dist, 6);
    expect(l.range!.y).toBeCloseTo(op.y + Math.cos(a) * l.range!.dist, 6);
    // Two draws from the laser stream, none from any other.
    const after = counts(sim);
    STREAMS.forEach((n, i) => expect(after[i]! - before[i]!, n).toBe(n === 'las' ? 2 : 0));
  });

  test('허용 각 밖의 적은 반사하지 않고, 하늘로 쏘면 반사가 없다', () => {
    const { sim, man, at } = crewSim();
    sim.step([LASE(at.az + 14, at.el)]);
    expect(sim.state.lases[0]!.range!.target).toBe(true); // 1.4 mils off: still the man
    sim.step([LASE(at.az + 16, at.el)]);
    const off = sim.state.lases[0]!.range!;
    expect(off.target).toBe(false); // 1.6 mils off: the ground behind him
    // The ray meets the flat ground beyond him: the eye is 3.5 m up, his pick point `pickZ` m.
    const d = Math.hypot(man.x - sim.state.op.x, man.y - sim.state.op.y);
    expect(Math.abs(off.dist - (d * EYE_HEIGHT) / (EYE_HEIGHT - pickZ(man)))).toBeLessThanOrEqual(12);

    const las = sim.state.rng.las.count;
    expect(sim.step([LASE(32000, 50)]).accepted).toEqual([true]); // south, 5 mils up: nothing to reflect
    expect(sim.state.lases[0]!.range).toBeNull();
    expect(sim.state.rng.las.count).toBe(las);
  });

  test('최근 다섯 번만 새것부터 남긴다', () => {
    const { sim } = crewSim();
    for (let k = 0; k < 6; k++) sim.step([LASE(k * 100, -100)]);
    expect(sim.state.lases.map((l) => l.az)).toEqual([500, 400, 300, 200, 100]);
  });
});

describe('B6: 레이저 횟수는 탄착을 바꾸지 않는다', () => {
  test('레이저만 더 쏜 판도 같은 임무의 탄착과 탄도 스트림 소비가 같다', () => {
    const INF = oneUnit({ type: 'inf', route: 'B', t0: 0 });
    // A 바로 효력사 on the approaching platoon at fixed ticks; `lasing` also lases the ground every 10 ticks. The grid
    // leads the platoon to where it stands when the rounds land (probe run, then a run without radio), less the bias.
    const run = (lasing: boolean, at?: { x: number; y: number }) => {
      const sim = opened(INF, 2);
      const t0 = sim.state.tick;
      const impacts: ImpactEvent[] = [];
      for (let k = 0; k < 3000; k++) {
        const inputs = [];
        if (k === 0) inputs.push(CALL_FFE);
        if (k === 200) {
          const b = sim.state.missions[0]!.bias;
          inputs.push(gridAt(at ? { x: at.x - b.x, y: at.y - b.y } : sim.state.platoons[0]!));
        }
        if (k === 400) inputs.push(desc(3, 'quick', 'ready', 0, 'unknown'));
        if (lasing && k % 10 === 5) inputs.push(LASE(k * 7, -100));
        const r = sim.step(inputs);
        expect(r.accepted.every(Boolean), `tick ${t0 + k}`).toBe(true);
        impacts.push(...r.events.filter(isImpact));
      }
      return { sim, impacts };
    };
    const landed = run(false).impacts[0]!.tick;
    const ghost = started(INF, { seed: 2 });
    while (ghost.state.tick < landed) ghost.step([]);
    const at = { x: ghost.state.platoons[0]!.x, y: ghost.state.platoons[0]!.y };
    const plain = run(false, at);
    const lased = run(true, at);
    expect(plain.impacts.length).toBe(18); // 6 guns × 3 rounds: the mission did fire
    expect(lased.impacts).toEqual(plain.impacts);
    expect(lased.sim.state.rng.bal.count).toBe(plain.sim.state.rng.bal.count);
    const alive = (sim: Sim) => sim.state.platoons[0]!.members.map((m) => m.alive);
    expect(alive(lased.sim)).toEqual(alive(plain.sim));
    expect(alive(plain.sim)).toContain(false); // and it killed someone
    expect(plain.sim.state.rng.las.count).toBe(0);
    expect(lased.sim.state.rng.las.count).toBeGreaterThan(0);
  });
});

describe('B6: 임무가 없으면 탄도 스트림 소비 0', () => {
  test('보고 누르고 레이저를 쏴도 사격 임무가 없으면 탄도 스트림은 그대로다', () => {
    const sim = started(BASE_SCENARIO);
    openRadio(sim);
    for (let k = 0; k < 6000; k++) {
      const inputs = [];
      if (k % 20 === 0) inputs.push({ a: 'cam', v: [(k * 13) % 64000, -150] });
      if (k % 500 === 0) inputs.push({ a: 'bino', v: [(k / 500) % 2] });
      if (k % 50 === 0) inputs.push({ a: 'id', v: [(k * 13) % 64000, -150] });
      if (k % 30 === 0) inputs.push(LASE((k * 13) % 64000, -150));
      sim.step(inputs);
    }
    expect(sim.state.rng.bal.count).toBe(0);
    expect(sim.state.rng.las.count).toBeGreaterThan(0); // the run did lase
  });
});
