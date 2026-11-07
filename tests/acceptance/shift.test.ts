// 전이사격 (#32): from the last 표적번호, one transmission — 방향, 수정, 표적성질, 발수, 위험근접 — and the battery fires
// for effect at the shifted point under a new 표적번호. Public interface only: create, step, events, read-only state, record.
import { describe, expect, test } from 'vitest';
import type { ImpactEvent, Input, RadioEvent, Sim, SimEvent } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CALL_FFE, DESC_UNKNOWN, EOM, LOC_CLEAR, SHIFT, answered, ended, openRadio, send, started, unstarted, untilSaid } from './mission';

/** 전이 from the base mission: 방향 0800 (from the post toward the target), no 좌우, 사거리 200 m, 포대 3발, 미상 표적. */
const SH = (rangeDir: 'drop' | 'add', dangerClose: number) => SHIFT(800, 'left', 0, rangeDir, 200, 3, dangerClose, 'unknown');

/** Steps `sim` with `input` and `twin` with nothing: `input` is ignored and the two stay equal. */
function ignored(sim: Sim, twin: Sim, input: Input): void {
  expect(sim.step([input]).accepted).toEqual([false]);
  twin.step([]);
  expect(sim.hash()).toBe(twin.hash());
}

/** Two equal sims, radio open, the base mission (바로 효력사 at LOC_CLEAR, 686 m from the post) ended. */
function endedPair(): [Sim, Sim] {
  const pair = [started(), started()] as [Sim, Sim];
  for (const sim of pair) {
    openRadio(sim);
    ended(sim, CALL_FFE, LOC_CLEAR);
  }
  return pair;
}

describe('F-07: 전이의 상태 가드', () => {
  test('직전 임무가 없거나 대기 상태가 아니면 무시된다', () => {
    const S = SH('add', 0);
    // 작전 준비, then live before 감명 양호, then idle with no mission yet.
    ignored(unstarted(), unstarted(), S);
    const [sim, twin] = [started(), started()];
    ignored(sim, twin, S);
    openRadio(sim);
    openRadio(twin);
    ignored(sim, twin, S);
    // A mission under way: every step from the call to 임무끝 refuses it, 효과 관측 included (the 전이 goes before the
    // 임무끝 within the step that takes it).
    for (const [input, a] of [[CALL_FFE, 'call'], [LOC_CLEAR, 'loc'], [DESC_UNKNOWN, 'desc']] as const) {
      for (const s of [sim, twin]) expect(send(s, input).ok).toBe(true);
      ignored(sim, twin, S);
      for (const s of [sim, twin]) answered(s, a);
      ignored(sim, twin, S);
    }
    for (let k = 0; ; k++) {
      expect(k).toBeLessThan(6000);
      const r = sim.step([S, EOM('ineffective')]);
      const t = twin.step([EOM('ineffective')]);
      expect(r.accepted).toEqual([false, t.accepted[0]]);
      expect(sim.hash()).toBe(twin.hash());
      if (t.accepted[0]) break;
    }
    // After 임무끝 the 전이 is taken, once: a second one in the same step finds 기러기 answering.
    expect(sim.step([S, S]).accepted).toEqual([true, false]);
  });

  test('값 형식에 맞지 않는 전이는 무시된다', () => {
    const [sim, twin] = endedPair();
    for (const bad of [
      SHIFT(6400, 'left', 0, 'add', 200, 3, 0, 'unknown'), // 방향 0–6399
      SHIFT(800, 'left', 801, 'add', 200, 3, 0, 'unknown'), // 좌우 ≤ 800 m
      SHIFT(800, 'left', 0, 'add', 1501, 3, 0, 'unknown'), // 사거리 ≤ 1500 m
      SHIFT(800, 'left', 0, 'add', 200, 0, 0, 'unknown'), // 발수 1–5
      SHIFT(800, 'left', 0, 'add', 200, 6, 0, 'unknown'),
      SHIFT(800, 'left', 0, 'add', 200, 3, 2, 'unknown'), // 위험근접 0 · 1
      SHIFT(800, 'left', 0, 'add', 200, 3, 0, 'unknown', 'moving'), // 미상 표적 has no activity
      SHIFT(800, 'left', 0, 'add', 200, 3, 0), // no target
    ])
      ignored(sim, twin, bad);
    expect(send(sim, SHIFT(800, 'left', 0, 'add', 200, 3, 0, 'infantry', 'moving', 'squad')).ok).toBe(true);
  });
});

const isRadio = (e: SimEvent): e is RadioEvent => e.type === 'radio';
const isImpact = (e: SimEvent): e is ImpactEvent => e.type === 'impact';
const said = (events: readonly SimEvent[]) => events.filter(isRadio).map((e) => e.utterance);
const kinds = (events: readonly SimEvent[]) => said(events).map((u) => `${u.speaker} ${u.kind} ${u.ending}`);
const mean = (ps: readonly { x: number; y: number }[]) => ({ x: ps.reduce((t, p) => t + p.x, 0) / ps.length, y: ps.reduce((t, p) => t + p.y, 0) / ps.length });

/** Steps sending `inputs` until the last one is taken (at most 6000 ticks); every event on the way, that step's included. */
function until(sim: Sim, inputs: Input[]): { events: SimEvent[]; accepted: readonly boolean[] } {
  const events: SimEvent[] = [];
  for (let k = 0; k < 6000; k++) {
    const r = sim.step(inputs);
    events.push(...r.events);
    if (r.accepted.at(-1)) return { events, accepted: r.accepted };
  }
  throw new Error(`${inputs.at(-1)!.a} not taken`);
}

describe('F-07: 전이사격', () => {
  test('직전 표적의 조준점에 수정을 적용한 곳으로 효력사를 건다', () => {
    const [sim] = endedPair();
    const last = sim.state.missions[0]!;
    const balBefore = sim.state.rng.bal.count;
    const sent = send(sim, SHIFT(1600, 'right', 104, 'add', 130, 2, 0, 'infantry', 'moving', 'squad'));
    expect(sent.ok).toBe(true);
    const slots = { targetNumber: 1001, direction: 1600, lateralDir: 'right', lateral: 100, rangeDir: 'add', range: 150, rounds: 2, dangerClose: 0, targetType: 'infantry', activity: 'moving', unit: 'squad' };
    expect(sent.events.map((e) => e.utterance)).toEqual([{ speaker: 'observer', ending: 'over', kind: 'shift', slots }]);
    // 방향 1600 is due east: right is south, add is east. The bias is the last mission's; no ballistic draw for it.
    const m = sim.state.missions[1]!;
    expect(m.aim!.x).toBeCloseTo(last.aim!.x + 150, 6);
    expect(m.aim!.y).toBeCloseTo(last.aim!.y - 100, 6);
    expect(m.bias).toEqual(last.bias);
    expect(sim.state.rng.bal.count).toBe(balBefore);
    const aim = { ...m.aim! }; // the 수정 below moves it

    // A 전이 has its 방향 already: the 수정 after its 효력사 goes without one.
    const withDir = { a: 'corr', v: [1600, 'right', 50, 'add', 0, 'ffe', 'ineffective'] };
    const { events, accepted } = until(sim, [withDir, { a: 'corr', v: ['right', 50, 'add', 0, 'ffe', 'ineffective'] }]);
    expect(accepted).toEqual([false, true]);
    expect(kinds(events).slice(0, 7)).toEqual([
      'fdc shift wait',
      'fdc mto wait',
      'fdc ready none',
      'fdc shot over',
      'observer shot wait',
      'fdc rounds_complete over',
      'observer rounds_complete wait',
    ]);
    const radio = events.filter(isRadio);
    expect(radio[0]!.utterance).toEqual({ speaker: 'fdc', ending: 'wait', kind: 'shift', slots });
    // Delays from the tick the 전이 was taken (its event carries the step's end): readback 3 s, 사격지휘통보 9–12 s,
    // 사격준비 끝 20–28 s (demo sendShift).
    const t0 = sent.events[0]!.tick - 1;
    expect(radio[0]!.tick - t0).toBe(60);
    expect(radio[1]!.tick - t0).toBeGreaterThanOrEqual(180);
    expect(radio[1]!.tick - t0).toBeLessThanOrEqual(240);
    expect(radio[2]!.tick - t0).toBeGreaterThanOrEqual(400);
    expect(radio[2]!.tick - t0).toBeLessThanOrEqual(560);
    const mto = sim.state.missions[1]!.mto!;
    expect(radio[2]!.utterance).toMatchObject({ kind: 'ready', slots: { fuze: mto.fuze } });
    // 효력사: six guns, mto.rounds each, centred on the shifted aim plus the bias (± the sheaf and 공산오차).
    const impacts = events.filter(isImpact).slice(0, 6 * mto.rounds);
    expect(events.filter(isImpact)).toHaveLength(6 * mto.rounds);
    const c = mean(impacts);
    expect(Math.hypot(c.x - (aim.x + m.bias.x), c.y - (aim.y + m.bias.y))).toBeLessThan(40);
  });

  test('수정량이 없으면 직전 조준점에 다시 효력사를 걸고, 임무끝으로 맺는다', () => {
    const [sim] = endedPair();
    const last = sim.state.missions[0]!;
    const sent = send(sim, SHIFT(800, 'left', 4, 'drop', 20, 1, 0, 'unknown'));
    expect(sent.events[0]!.utterance).toEqual({
      speaker: 'observer',
      ending: 'over',
      kind: 'shift',
      slots: { targetNumber: 1001, direction: 800, rounds: 1, dangerClose: 0, targetType: 'unknown' },
    });
    expect(sim.state.missions[1]!.aim).toEqual(last.aim);
    const { events } = until(sim, [EOM('ineffective')]);
    expect(events.filter(isImpact)).toHaveLength(6 * sim.state.missions[1]!.mto!.rounds);
  });
});

describe('F-09: 전이의 표적번호', () => {
  test('전이는 직전 표적번호를 기준으로 하고, 기러기는 새 표적번호를 부여한다', () => {
    const [sim] = endedPair();
    expect(sim.state.missions[0]!.mto!.targetNumber).toBe(1001);
    const numbers = (events: readonly SimEvent[]) =>
      said(events).flatMap((u) => (u.kind === 'shift' || u.kind === 'mto' ? [`${u.speaker} ${u.kind} ${u.slots.targetNumber}`] : []));
    for (const [from, given] of [[1001, 1002], [1002, 1003]]) {
      const sent = send(sim, SH('add', 0));
      expect(sent.ok).toBe(true);
      const { events } = until(sim, [EOM('ineffective')]);
      expect(numbers([...sent.events, ...events])).toEqual([`observer shift ${from}`, `fdc shift ${from}`, `fdc mto ${given}`]);
    }
    // The numbers run on for the next call too.
    expect(send(sim, CALL_FFE).ok).toBe(true);
    answered(sim, 'call');
    expect(send(sim, LOC_CLEAR).ok).toBe(true);
    answered(sim, 'loc');
    expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
    expect(numbers(untilSaid(sim, 'fdc', 'mto'))).toEqual(['fdc mto 1004']);
  });
});

/** After the base mission, sends `input` and steps to 기러기's readback of it: that step's utterances as kinds, the score
 * change at the send and in that step. `SH('drop', …)` aims 486 m from the post, `SH('add', …)` 886 m. */
function toShiftReadback(input: Input, loc = LOC_CLEAR) {
  const sim = started();
  openRadio(sim);
  ended(sim, CALL_FFE, loc);
  const start = sim.record().score;
  if (!send(sim, input).ok) throw new Error('shift ignored');
  const atSend = sim.record().score - start;
  for (let k = 0; k < 400; k++) {
    const before = sim.record().score;
    const events = sim.step([]).events;
    if (said(events).some((u) => u.speaker === 'fdc' && u.kind === 'shift'))
      return { sim, said: kinds(events), atSend, change: sim.record().score - before };
  }
  throw new Error('no readback');
}

const ADJ_FIRST = 'fdc danger_close_adjust_first over';
const APPLIED = 'fdc danger_close_applied over';
const corrIn = (...v: (number | string)[]): Input => ({ a: 'corr', v });

describe('B4: 전이사격 위험근접 선언', () => {
  test('600 m 안 표적의 전이에서 선언하면 감점 없이 조정 후 효력사, 수정은 100 m까지', () => {
    const r = toShiftReadback(SH('drop', 1));
    expect(r.said).toEqual(['fdc shift wait', ADJ_FIRST]);
    expect([r.atSend, r.change]).toEqual([0, 0]);
    const m = r.sim.state.missions[1]!;
    expect([m.dangerClose, m.dangerMissed]).toEqual([true, false]);
    // One adjusting round (사격준비 끝 without a fuze), then the same rules as a 사격요구: over 100 m is sent again.
    const adjusting = until(r.sim, [corrIn('right', 110, 'add', 0, 'adjust')]).events;
    expect(said(adjusting).find((u) => u.kind === 'ready')).toMatchObject({ slots: {} });
    expect(adjusting.filter(isImpact).map((i) => i.fuze)).toEqual(['quick']);
    expect(said(adjusting).at(-1)).toMatchObject({ speaker: 'observer', kind: 'correction', slots: { lateralDir: 'right', lateral: 110 } });
    const aim = { ...m.aim! };
    expect(said(untilSaid(r.sim, 'fdc', 'danger_close_resend')).map((u) => u.kind)).toEqual(['danger_close_resend']);
    expect(m.aim).toEqual(aim); // refused: the aim stays
    // Within 100 m it goes, and the 효력사 follows.
    until(r.sim, [corrIn('right', 100, 'add', 0, 'ffe')]);
    const ffe = until(r.sim, [EOM('ineffective')]).events;
    expect(ffe.filter(isImpact)).toHaveLength(6 * m.mto!.rounds);
    expect(r.sim.record().score).toBe(0);
  });

  test('멀리 있는 표적에 선언해도 같은 규칙을 쓴다(감점 없음)', () => {
    const r = toShiftReadback(SH('add', 1));
    expect(r.said).toEqual(['fdc shift wait', ADJ_FIRST]);
    expect([r.atSend, r.change]).toEqual([0, 0]);
  });
});

describe('B4: 전이사격 위험근접 미선언', () => {
  test('선언하지 않으면 −30과 미선언 집계 뒤 위험근접이 적용된다', () => {
    const r = toShiftReadback(SH('drop', 0));
    expect(r.said).toEqual(['fdc shift wait', APPLIED, ADJ_FIRST]);
    expect([r.atSend, r.change]).toEqual([0, -30]);
    const m = r.sim.state.missions[1]!;
    expect([m.dangerClose, m.dangerMissed]).toEqual([true, true]);
    const adjusting = until(r.sim, [corrIn('right', 50, 'add', 0, 'adjust')]).events;
    expect(adjusting.filter(isImpact).map((i) => i.fuze)).toEqual(['quick']);
  });

  test('600 m 밖이면 아무 일 없이 바로 효력사', () => {
    const r = toShiftReadback(SH('add', 0));
    expect(r.said).toEqual(['fdc shift wait']);
    expect([r.atSend, r.change]).toEqual([0, 0]);
    const m = r.sim.state.missions[1]!;
    expect([m.dangerClose, m.dangerMissed]).toEqual([false, false]);
    const ffe = until(r.sim, [EOM('ineffective')]).events;
    expect(ffe.filter(isImpact)).toHaveLength(6 * m.mto!.rounds);
  });
});

describe('B4: 전이 조준점이 아군 진지 600 m 안', () => {
  // 아군 1소대 (4350, 3380) is 4.9 km from the post. The base mission ~895 m south of it (grid 4435 3248), then a 전이
  // 400 m north (방향 0, 추가 400) lands ~495 m from the position: the rules apply through the friendly position alone.
  const SOUTH: Input = { a: 'loc', v: ['grid', 4435, 3248] };
  const NORTH = (dangerClose: number) => SHIFT(0, 'left', 0, 'add', 400, 3, dangerClose, 'unknown');
  const friend = BASE_SCENARIO.friends[0]!;
  const far = (r: ReturnType<typeof toShiftReadback>, i: number) => Math.hypot(r.sim.state.missions[i]!.aim!.x - friend.x, r.sim.state.missions[i]!.aim!.y - friend.y);

  test('선언하지 않으면 관측소가 멀어도 −30 뒤 위험근접이 적용된다', () => {
    const r = toShiftReadback(NORTH(0), SOUTH);
    expect(far(r, 0)).toBeGreaterThan(600);
    expect(far(r, 1)).toBeLessThan(600);
    const op = r.sim.state.op;
    expect(Math.hypot(r.sim.state.missions[1]!.aim!.x - op.x, r.sim.state.missions[1]!.aim!.y - op.y)).toBeGreaterThan(600);
    expect(r.said).toEqual(['fdc shift wait', APPLIED, ADJ_FIRST]);
    expect([r.atSend, r.change]).toEqual([0, -30]);
    expect([r.sim.state.missions[1]!.dangerClose, r.sim.state.missions[1]!.dangerMissed]).toEqual([true, true]);
  });

  test('선언하면 감점 없이 조정 후 효력사', () => {
    const r = toShiftReadback(NORTH(1), SOUTH);
    expect(r.said).toEqual(['fdc shift wait', ADJ_FIRST]);
    expect([r.atSend, r.change]).toEqual([0, 0]);
    expect([r.sim.state.missions[1]!.dangerClose, r.sim.state.missions[1]!.dangerMissed]).toEqual([true, false]);
  });
});
