// 극좌표법과 위험근접 (#31): a polar 표적위치 is turned into a point from the post 기러기 knows, and a target within 600 m
// of our troops or the post brings the 위험근접 rules: declared or −30, 조정 후 효력사, at most 100 m a correction.
// Public interface only: create, step, events, read-only state, record.
import { describe, expect, test } from 'vitest';
import { replay, type Input, type RadioEvent, type RecordedInput, type RadioUtterance, type Sim, type SimEvent } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CALL_ADJUST, CALL_FFE, DESC_UNKNOWN, LOC, LOC_CLEAR, LOC_NEAR, POLAR, answered, corr, desc, openRadio, radioEvents, send, started, toAdjust, unstarted, untilImpact } from './mission';
import { START, replayData } from './init';
import { oneUnit } from './enemy';
import { flatTerrain } from './terrain';
import { aimedAt, gridAt, isImpact, untilLanded } from './strike';

const MIL = 3200 / Math.PI;
const isRadio = (e: SimEvent): e is RadioEvent => e.type === 'radio';
const said = (events: readonly SimEvent[]) => events.filter(isRadio).map((e) => e.utterance);
const by = (u: readonly RadioUtterance[], speaker: string, kind: string) => u.find((x) => x.speaker === speaker && x.kind === kind);

/** An empty field, radio open, `call` sent and answered. */
function called(call: Input = CALL_ADJUST, seed = 7): Sim {
  const sim = started(seed);
  openRadio(sim);
  if (!send(sim, call).ok) throw new Error('call ignored');
  answered(sim, 'call');
  return sim;
}

const quiet = (sim: Sim, ticks: number) => radioEvents(sim, ticks).map((e) => e.utterance);
/** 미상 표적, 포대 3발, 준비되는 대로, with 위험근접 declared or not. */
const DESC = (dangerClose: 0 | 1) => desc(3, 'none', 'ready', dangerClose, 'unknown');

/** Sends `loc` and `d` after `call`; steps until 기러기's description readback. Returns that step's utterances and the
 * score just before it and after it. */
function toReadback(loc: Input, d: Input, call: Input = CALL_ADJUST) {
  const sim = called(call);
  if (!send(sim, loc).ok) throw new Error('loc ignored');
  answered(sim, 'loc');
  const sent = send(sim, d);
  if (!sent.ok) throw new Error('desc ignored');
  const atSend = sim.record().score;
  for (let k = 0; k < 400; k++) {
    const before = sim.record().score;
    const u = said(sim.step([]).events);
    if (by(u, 'fdc', 'description')) return { sim, u, atSend, before, after: sim.record().score };
  }
  throw new Error('no readback');
}
const kinds = (u: readonly RadioUtterance[]) => u.map((x) => `${x.speaker} ${x.kind}`);

describe('F-07: 위험근접 선언과 미선언', () => {
  test('관측소 600 m 안의 표적: 선언하면 감점 없이, 선언하지 않으면 −30 뒤 기러기가 적용한다', () => {
    const missed = toReadback(LOC_NEAR, DESC(0)); // 262 m from the post
    expect(missed.atSend).toBe(0); // nothing on the send
    expect(kinds(missed.u)).toEqual(['fdc description', 'fdc danger_close_applied']);
    expect(by(missed.u, 'fdc', 'danger_close_applied')!.ending).toBe('over');
    expect(missed.after - missed.before).toBe(-30);

    const declared = toReadback(LOC_NEAR, DESC(1));
    expect(kinds(declared.u)).toEqual(['fdc description']);
    expect(declared.after).toBe(declared.before);
    expect(declared.after).toBe(0);
  });

  test('아군 진지 600 m 안도 같고, 멀면 아무 일도 없다', () => {
    const friend = BASE_SCENARIO.friends[0]!;
    const nearFriend = toReadback(gridAt({ x: friend.x + 300, y: friend.y }), DESC(0));
    expect(kinds(nearFriend.u)).toEqual(['fdc description', 'fdc danger_close_applied']);
    expect(nearFriend.after - nearFriend.before).toBe(-30);
    const far = toReadback(LOC, DESC(0)); // 7.2 km
    expect(kinds(far.u)).toEqual(['fdc description']);
    expect(far.after).toBe(far.before);
  });

  test('600 m 경계: 595 m는 걸리고 605 m는 걸리지 않는다', () => {
    expect(kinds(toReadback(gridAt({ x: 320, y: 915 }), DESC(0)).u)).toContain('fdc danger_close_applied'); // (325, 915)
    expect(kinds(toReadback(gridAt({ x: 320, y: 925 }), DESC(0)).u)).not.toContain('fdc danger_close_applied');
  });

  test('최초 표적 위치만 본다: 수정으로 600 m 안에 들어와도 걸리지 않는다', () => {
    const { sim } = toReadback(LOC_CLEAR, DESC(0)); // 686 m, on 방위각 0800 from the post
    toAdjust(sim);
    // 100 m nearer: the aim is now 586 m from the post. Then a 200 m drop, over the 위험근접 limit, is taken as usual.
    expect(send(sim, corr(800, 'right', 0, 'drop', 100, 'adjust')).ok).toBe(true);
    toAdjust(sim);
    const a = sim.state.missions[0]!.aim!;
    expect(Math.hypot(a.x - sim.state.op.x, a.y - sim.state.op.y)).toBeLessThan(600);
    expect(send(sim, corr('right', 0, 'drop', 200, 'adjust')).ok).toBe(true);
    const u = quiet(sim, 200);
    expect(by(u, 'fdc', 'correction')).toMatchObject({ slots: { rangeDir: 'drop', range: 200 } });
    expect(kinds(u).filter((k) => k.includes('danger_close'))).toEqual([]);
    expect(sim.record().score).toBe(0);
  });
});

/** Steps `ticks` times with no input; returns the impacts and the utterances. */
function watch(sim: Sim, ticks: number) {
  const events: SimEvent[] = [];
  for (let k = 0; k < ticks; k++) events.push(...sim.step([]).events);
  return { impacts: events.filter(isImpact), u: said(events) };
}

describe('F-07: 위험근접은 조정 후 효력사', () => {
  test('바로 효력사는 거절되어 수정탄부터 쏘고, 효력사는 수정 뒤에만 나간다', () => {
    const declared = toReadback(LOC_NEAR, DESC(1), CALL_FFE);
    expect(kinds(declared.u)).toEqual(['fdc description', 'fdc danger_close_adjust_first']);
    expect(by(declared.u, 'fdc', 'danger_close_adjust_first')!.ending).toBe('over');
    expect(declared.after).toBe(0);
    const missed = toReadback(LOC_NEAR, DESC(0), CALL_FFE); // the two notices, in this order
    expect(kinds(missed.u)).toEqual(['fdc description', 'fdc danger_close_applied', 'fdc danger_close_adjust_first']);
    expect(missed.after - missed.before).toBe(-30);

    for (const { sim } of [declared, missed]) {
      // 포대 사격준비 끝 (no fuze named), one quick round, then nothing until a correction.
      const first = watch(sim, 1600);
      expect(by(first.u, 'fdc', 'ready')).toMatchObject({ slots: {} });
      expect(first.impacts.map((i) => i.fuze)).toEqual(['quick']);
      const rounds = sim.state.missions[0]!.mto!.rounds;
      expect(send(sim, corr(800, 'right', 0, 'add', 0, 'ffe')).ok).toBe(true);
      const ffe = watch(sim, 2400);
      expect(by(ffe.u, 'fdc', 'ready')!).toMatchObject({ slots: { fuze: 'quick' } });
      expect(ffe.impacts).toHaveLength(6 * rounds);
    }
  });

  test('위험근접이 아니면 바로 효력사가 그대로 나간다', () => {
    const clear = toReadback(LOC_CLEAR, DESC(0), CALL_FFE);
    expect(kinds(clear.u)).toEqual(['fdc description']);
    const first = watch(clear.sim, 1600);
    expect(by(first.u, 'fdc', 'ready')).toMatchObject({ slots: { fuze: 'quick' } });
    expect(first.impacts).toHaveLength(6 * clear.sim.state.missions[0]!.mto!.rounds);
  });
});

/** A started empty field whose accepted inputs are kept as an 입력 기록 (the assembly keeps accepted inputs only). */
function recorded(seed = 7) {
  const sim = unstarted(seed);
  const inputs: RecordedInput[] = [];
  const rec: Sim = {
    get state() {
      return sim.state;
    },
    record: () => sim.record(),
    hash: () => sim.hash(),
    step(list) {
      const t = sim.state.tick;
      const r = sim.step(list);
      list.forEach((input, i) => r.accepted[i] && inputs.push({ t, ...input }));
      return r;
    },
  };
  rec.step([START]);
  return { sim: rec, inputs };
}

describe('F-07: 위험근접 100 m 상한', () => {
  test('축당 100 m를 넘는 수정은 재송신을 요구받고, 그 입력은 받아들인 입력이다', () => {
    const { sim, inputs } = recorded();
    openRadio(sim);
    for (const input of [CALL_ADJUST, LOC_NEAR, DESC(1)]) {
      expect(send(sim, input).ok).toBe(true);
      answered(sim, input.a as 'call' | 'loc' | 'desc');
    }
    toAdjust(sim);
    const m = () => sim.state.missions[0]!;
    const aim = { ...m().aim! };

    // 110 m across: refused. The observer said it; 기러기 asks again 2.5 s later; nothing in the mission moves.
    const tick = sim.state.tick;
    const over = send(sim, corr(800, 'right', 110, 'add', 0, 'adjust'));
    expect(over.ok).toBe(true);
    expect(by(over.events.map((e) => e.utterance), 'observer', 'correction')).toMatchObject({ slots: { direction: 800, lateralDir: 'right', lateral: 110 } });
    const back = radioEvents(sim, 400);
    expect(back.map((e) => `${e.utterance.speaker} ${e.utterance.kind}`)).toEqual(['fdc danger_close_resend']);
    expect(back[0]!.tick - tick).toBe(50); // 2.5 s after the step it was sent in began
    expect(back[0]!.utterance.ending).toBe('over');
    expect(m().aim).toEqual(aim);
    expect(m().direction).toBeNull();
    expect(m().corrections).toBe(0);

    // The resend still carries 방향 (none was kept); 120 m in range snaps to 100 and is taken.
    expect(send(sim, corr(800, 'right', 100, 'add', 120, 'adjust')).ok).toBe(true);
    const taken = watch(sim, 1600);
    expect(by(taken.u, 'fdc', 'correction')).toMatchObject({ slots: { direction: 800, lateral: 100, range: 100 } });
    expect(kinds(taken.u)).not.toContain('fdc danger_close_resend');
    expect(taken.impacts).toHaveLength(1);
    radioEvents(sim, 30);
    // 140 m snaps to 150: refused.
    expect(send(sim, corr('right', 0, 'add', 140, 'adjust')).ok).toBe(true);
    expect(kinds(watch(sim, 100).u)).toEqual(['fdc danger_close_resend']);

    // Replayed, the record has no ignored input and the same result.
    const r = replay(replayData(inputs, sim.state.tick, 7), flatTerrain(), { ...BASE_SCENARIO, units: [] });
    expect(r.ignored).toBe(0);
    expect(r.record).toEqual(sim.record());
  });

  test('효과 관측의 수정 후 효력사도 100 m를 넘으면 거절되고, 보고 점수는 기러기가 받은 보고에 한 번', () => {
    // A declared 위험근접 바로 효력사 on a platoon: the adjusting round, a correction to 효력사, then the 효과 관측.
    const INF = oneUnit({ type: 'inf', route: 'B', t0: 0 });
    const sim = aimedAt(INF, 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 1, 'unknown'));
    untilLanded(sim);
    radioEvents(sim, 30);
    expect(send(sim, corr(0, 'right', 0, 'add', 0, 'ffe')).ok).toBe(true);
    // Sent from the first tick 기러기 takes a 수정 후 효력사: 200 m across is refused, and scores nothing.
    let before: number;
    for (let k = 0; ; k++) {
      before = sim.record().score; // the volley's kills are scored as they happen; the report alone counts here
      if (sim.step([corr('right', 200, 'add', 0, 'ffe', 'neutralized')]).accepted[0]) break;
      expect(k).toBeLessThan(4000);
    }
    expect(sim.record().score).toBe(before);
    expect(sim.state.missions[0]!.report).toBeNull();
    expect(kinds(watch(sim, 60).u)).toEqual(['fdc danger_close_resend']);
    // Back at the 효과 관측: the resend is taken and scored once.
    expect(send(sim, corr('right', 50, 'add', 0, 'ffe', 'neutralized')).ok).toBe(true);
    const points = sim.record().score - before;
    expect([30, -20]).toContain(points);
    expect(sim.state.missions[0]!.score).toBe(points);
    watch(sim, 100);
    expect(sim.record().score - before).toBe(points);
  });
});

describe('F-07: 극좌표 위치법', () => {
  test('방위각·거리는 기러기가 아는 관측소 위치에서 환산되고, 방위각이 방향을 대신한다', () => {
    const sim = called();
    // The post stands at (320, 320); 기러기 still knows it at the planned post (no 위치 보고 yet).
    const known = sim.state.knownOp;
    expect(known).toEqual(BASE_SCENARIO.plannedOp);
    expect(sim.state.op).not.toEqual(known);

    const sent = send(sim, POLAR(800, 1004));
    expect(sent.ok).toBe(true);
    expect(by(sent.events.map((e) => e.utterance), 'observer', 'location')!).toMatchObject({ slots: { method: 'polar', azimuth: 800, distance: 1000 } });
    expect(by(said(answered(sim, 'loc')), 'fdc', 'location')).toMatchObject({ slots: { method: 'polar', azimuth: 800, distance: 1000 } });
    const a = 800 / MIL;
    const m = sim.state.missions[0]!;
    expect(m.aim!.x).toBeCloseTo(known.x + Math.sin(a) * 1000, 6);
    expect(m.aim!.y).toBeCloseTo(known.y + Math.cos(a) * 1000, 6);

    // The round lands there (with the mission's bias), not 1 km from where the observer really stands.
    expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
    const { impact } = untilImpact(sim);
    expect(Math.hypot(impact.x - (m.aim!.x + m.bias.x), impact.y - (m.aim!.y + m.bias.y))).toBeLessThan(100);
    const fromOp = { x: sim.state.op.x + Math.sin(a) * 1000, y: sim.state.op.y + Math.cos(a) * 1000 };
    expect(Math.hypot(impact.x - fromOp.x, impact.y - fromOp.y)).toBeGreaterThan(2000);

    // The 방위각 was the 방향: the first correction carries none.
    for (let k = 0; k < 30; k++) sim.step([]);
    expect(send(sim, corr(800, 'right', 50, 'add', 0, 'adjust')).ok).toBe(false);
    const c = send(sim, corr('right', 50, 'add', 0, 'adjust'));
    expect(c.ok).toBe(true);
    expect(by(c.events.map((e) => e.utterance), 'observer', 'correction')!).toMatchObject({ slots: { lateralDir: 'right', lateral: 50, next: 'adjust' } });
    expect(sim.state.missions[0]!.direction).toBe(800);
  });

  test('거리만 다른 두 극좌표 표적위치는 상태 해시가 다르다', () => {
    const near = called();
    const far = called();
    expect(send(near, POLAR(800, 1000)).ok).toBe(true);
    expect(send(far, POLAR(800, 1100)).ok).toBe(true);
    expect(near.hash()).not.toBe(far.hash());
    // 1004 snaps to the same 1000 m: the same state.
    const same = called();
    expect(send(same, POLAR(800, 1004)).ok).toBe(true);
    expect(same.hash()).toBe(near.hash());
  });

  test('범위 밖의 방위각·거리는 무시된다', () => {
    for (const v of [POLAR(6400, 1000), POLAR(800, 99), POLAR(800, 15001)]) {
      const sim = called();
      const twin = called();
      expect(send(sim, v).ok).toBe(false);
      twin.step([]);
      expect(sim.hash()).toBe(twin.hash());
    }
    expect(send(called(), POLAR(0, 15000)).ok).toBe(true);
  });
});
