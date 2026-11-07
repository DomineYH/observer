// 효과 보고와 임무끝 (#30): after 효력사 the observer reports the effect and repeats, ends or corrects the mission; the
// report is scored against the truth once per accepted transmission (B1). Public interface only: create, step, events,
// read-only state, record.
import { describe, expect, test } from 'vitest';
import type { Input, RadioEvent, Sim, SimEvent } from '@sim';
import { radioSentence, spoken } from '@ui/radio/sentence';
import { CALL_ADJUST, CALL_FFE, DESC_UNKNOWN, EOM, LOC, REPEAT, corr, desc, openRadio, send, started, toReady, untilSaid, untilTaken } from './mission';
import { angleTo, idAt, oneUnit, until } from './enemy';
import { aimedAt, isImpact, untilLanded } from './strike';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const isRadio = (e: SimEvent): e is RadioEvent => e.type === 'radio';
const radio = (events: readonly SimEvent[]) => events.filter(isRadio).map((e) => e.utterance);
const quiet = (sim: Sim, ticks: number) => {
  const out: SimEvent[] = [];
  for (let k = 0; k < ticks; k++) out.push(...sim.step([]).events);
  return out;
};

/** An empty field, radio open, a 바로 효력사 mission sent and its 사격준비 끝 come. */
function ffe(seed = 7): Sim {
  const sim = started(seed);
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_FFE);
  return sim;
}

const INF = oneUnit({ type: 'inf', route: 'B', t0: 0 });
const QUICK3 = desc(3, 'quick', 'ready', 0, 'unknown');
const EFFECTS = ['destroyed', 'neutralized', 'ineffective'] as const;
/** A 바로 효력사 on the approaching platoon, its rounds aimed at where it will be (seed 2: it is broken on the way). */
const hit = (call: Input = CALL_FFE, seed = 2) => aimedAt(INF, seed, 0, call, QUICK3);

/** The real effect on the unit the mission hit hardest, from its members (PRD 6장: 60% 파괴, 30% 무력화). */
function truthOf(sim: Sim) {
  const kills = sim.state.missions.at(-1)!.kills;
  let best = -1;
  kills.forEach((k, i) => {
    if (k !== null && (best < 0 || k > kills[best]!)) best = i;
  });
  const members = sim.state.platoons[best]!.members;
  const cas = members.filter((m) => !m.alive).length / members.length;
  return { effect: cas >= 0.6 ? 'destroyed' : cas >= 0.3 ? 'neutralized' : 'ineffective', pct: Math.round(cas * 100) };
}

/** Steps `sim` sending `input` and `twin` with nothing, while `input` is ignored: the two stay equal. Then sends `input`
 * twice in one step; returns the score the accepted one added and that step's events. */
function reportOnce(sim: Sim, twin: Sim, input: Input): { points: number; events: readonly SimEvent[] } {
  for (let k = 0; k < 6000; k++) {
    const before = sim.record().score - twin.record().score;
    const r = sim.step([input, input]);
    twin.step([]);
    if (r.accepted[0]) {
      expect(r.accepted).toEqual([true, false]); // the second one of the step is ignored
      return { points: sim.record().score - twin.record().score - before, events: r.events };
    }
    expect(r.accepted).toEqual([false, false]);
    expect(sim.hash()).toBe(twin.hash());
  }
  throw new Error(`${input.a} not taken`);
}

/** Through the volley and well into the 효과 관측 without sending anything: 2,500 ticks, the last round over 5 s ago. */
function toEffect(sim: Sim): void {
  let last = 0;
  for (let k = 0; k < 2500; k++) if (sim.step([]).events.some((e) => e.type === 'impact')) last = sim.state.tick;
  expect(last).toBeGreaterThan(0);
  expect(sim.state.tick - last).toBeGreaterThan(100);
}

describe('B1: 전과 보고는 받아들인 입력에 한 번', () => {
  test('맞는 보고는 +30, 틀린 보고는 −20, 한 번만; 무시된 보고는 채점하지 않는다', () => {
    const probe = hit();
    untilTaken(probe, EOM('destroyed'));
    const truth = truthOf(probe);
    expect(probe.state.platoons[0]!.members.some((m) => !m.alive)).toBe(true); // the rounds did hit
    for (const sent of EFFECTS) {
      const sim = hit();
      const delta = reportOnce(sim, hit(), EOM(sent)).points;
      expect(delta, sent).toBe(sent === truth.effect ? 30 : -20);
      expect(sim.state.missions[0]).toMatchObject({ report: sent, truth: truth.effect, truthPct: truth.pct, score: delta });
      // Afterwards: a malformed report, and a report the stage does not take, change nothing.
      const score = sim.record().score;
      expect(send(sim, { a: 'eom', v: ['broken'] }).ok).toBe(false);
      expect(send(sim, EOM(sent)).ok).toBe(false);
      expect(send(sim, REPEAT(sent, 2)).ok).toBe(false);
      expect(sim.record().score).toBe(score);
    }
  });

  test('보고할 부대가 없으면 채점하지 않는다', () => {
    const sim = ffe();
    const twin = ffe();
    expect(reportOnce(sim, twin, EOM('destroyed')).points).toBe(0);
    expect(sim.state.missions[0]).toMatchObject({ report: 'destroyed', truth: null, truthPct: -1, score: 0 });
  });
});

describe('B1: 수정 후 효력사는 방향을 동반한다', () => {
  const impacts = (events: readonly SimEvent[]) => events.filter((e) => e.type === 'impact');

  test('방향을 보낸 적 없는 임무는 방향과 함께 보내야 받아들여지고, 채점은 한 번이다', () => {
    const sim = hit();
    const twin = hit();
    // Without 방향 it is never taken, through the whole 효과 관측: nothing changes, nothing is scored.
    const bare = corr('right', 50, 'add', 0, 'ffe', 'neutralized');
    for (let k = 0; k < 2500; k++) {
      expect(sim.step([bare]).accepted).toEqual([false]);
      twin.step([]);
    }
    expect(sim.hash()).toBe(twin.hash());
    const truth = truthOf(sim).effect;
    const before = sim.record().score - twin.record().score;
    const r = sim.step([corr(800, 'right', 50, 'add', 0, 'ffe', 'neutralized')]);
    twin.step([]);
    expect(r.accepted).toEqual([true]);
    expect(sim.record().score - twin.record().score - before).toBe(truth === 'neutralized' ? 30 : -20);
    expect(radio(r.events)).toEqual([
      { speaker: 'observer', ending: 'over', kind: 'correction', slots: { direction: 800, lateralDir: 'right', lateral: 50, next: 'ffe' } },
    ]);
    expect(spoken(radioSentence(radio(r.events)[0]!, NAMES))).toBe('방향 공팔공공, 우로 오십, 효력사, 이상.');
    // 기러기 reads it back, gets the battery ready with the fuze named, and fires the 효력사 again.
    const sent = sim.state.tick;
    const ready = untilSaid(sim, 'fdc', 'ready').map((e) => e).at(-1)!;
    expect(ready.utterance).toEqual({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: { fuze: 'quick' } });
    expect(ready.tick - sent).toBeGreaterThanOrEqual(280);
    expect(ready.tick - sent).toBeLessThanOrEqual(440);
    const rounds = sim.state.missions[0]!.mto!.rounds;
    expect(impacts(quiet(sim, 2400))).toHaveLength(6 * rounds);
  });

  test('방향을 보낸 임무는 방향 없이 보내고, 효과는 효력사 뒤에만 실린다', () => {
    const sim = hit(CALL_ADJUST);
    // At the adjusting round's 수정 (it opens within these ticks): a correction with 효과 is never taken.
    for (let k = 0; k < 2500; k++) expect(sim.step([corr(800, 'right', 0, 'add', 0, 'ffe', 'neutralized')]).accepted).toEqual([false]);
    expect(send(sim, corr(800, 'right', 0, 'add', 0, 'ffe')).ok).toBe(true);
    // At the 효과 관측 (it opens within these ticks): 방향 again, or no 효과, is never taken.
    for (let k = 0; k < 3000; k++)
      expect(sim.step([corr(800, 'right', 0, 'add', 0, 'ffe', 'destroyed'), corr('right', 0, 'add', 0, 'ffe')]).accepted).toEqual([false, false]);
    expect(send(sim, corr('right', 0, 'add', 0, 'ffe', 'destroyed')).ok).toBe(true);
    // 다음 조정 with 효과 is not a format at all.
    expect(send(sim, corr('right', 0, 'add', 0, 'adjust', 'destroyed')).ok).toBe(false);
  });
});

describe('F-07: 재효력사', () => {
  const impacts = (events: readonly SimEvent[]) => events.filter((e) => e.type === 'impact');
  /** Events up to and including `speaker`'s `kind`, and that event. */
  const next = (sim: Sim, speaker: 'fdc' | 'observer', kind: RadioEvent['utterance']['kind']) => {
    const events = untilSaid(sim, speaker, kind, 3000);
    return events.at(-1)!;
  };

  test('같은 제원으로 다시 쏘고 그때마다 전과 보고를 채점한다', () => {
    const sim = hit();
    const twin = hit();
    const aim = { ...sim.state.missions[0]!.aim! };
    const truth = () => truthOf(sim).effect;
    for (const [effect, rounds] of [['neutralized', 2], ['destroyed', 1]] as const) {
      const r = reportOnce(sim, twin, REPEAT(effect, rounds));
      // An input is applied at the start of its step, a tick before the step's own.
      const sent = sim.state.tick - 1;
      expect(r.points, effect).toBe(truth() === effect ? 30 : -20);
      expect(radio(r.events)).toEqual([
        { speaker: 'observer', ending: 'over', kind: 'repeat', slots: { targetName: 'unknown', effect, rounds } },
      ]);
      expect(spoken(radioSentence(radio(r.events)[0]!, NAMES))).toContain('재효력사, 동제원, 포대');
      const ack = next(sim, 'fdc', 'repeat_ack');
      expect(ack.utterance).toEqual({ speaker: 'fdc', ending: 'wait', kind: 'repeat_ack', slots: { rounds } });
      expect(ack.tick - sent).toBe(60); // 3 s
      const ready = next(sim, 'fdc', 'ready');
      expect(ready.utterance).toEqual({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: { fuze: 'quick' } });
      expect(ready.tick - sent).toBe(460); // 3 s + 20 s to set the fuzes
      // The battery fires `rounds` per gun at the same aim, and the 효과 관측 opens again for the next report.
      const events = quiet(sim, 1500);
      for (let k = 0; k < 1500; k++) twin.step([]);
      expect(impacts(events)).toHaveLength(6 * rounds);
      expect(sim.state.missions[0]!.aim).toEqual(aim);
    }
    expect(sim.state.missions).toHaveLength(1);
  });

  test('접근신관이면 기러기가 순발신관으로 바꿔 10초 일찍 준비할 수 있다', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const sim = started(seed);
      openRadio(sim);
      toReady(sim, desc(2, 'vt', 'ready', 0, 'unknown'), CALL_FFE);
      untilTaken(sim, REPEAT('ineffective', 2));
      const sent = sim.state.tick - 1;
      const ready = next(sim, 'fdc', 'ready');
      const fuze = ready.utterance.kind === 'ready' ? ready.utterance.slots.fuze : undefined;
      seen.add(`${fuze} ${ready.tick - sent}`);
    }
    expect([...seen].sort()).toEqual(['quick 260', 'vt 460']);
  });
});

describe('F-09: 효과 보고의 표적 이름', () => {
  // A platoon walking in from 2 km north, struck by an aimed 바로 효력사; at the 효과 관측 the observer looks at it.
  const NEAR = oneUnit({ type: 'inf', route: 'A', t0: 0 }, [{ x: 320, y: 2320 }, { x: 320, y: 1500 }, { x: 320, y: 600 }]);
  const cam = (az: number, el = -40) => ({ a: 'cam', v: [Math.round(az + 64000) % 64000, el] });

  test('시뮬레이션이 적정만큼 이름을 정해 사건 슬롯에 싣는다', () => {
    const name = (stage: 0 | 1 | 2 | 3) => {
      const sim = aimedAt(NEAR, 2, 0, CALL_FFE, QUICK3);
      const p = sim.state.platoons[0]!;
      toEffect(sim);
      if (stage > 0) {
        const man = p.members.find((m) => m.alive && m.vis) ?? p.members.find((m) => m.alive)!;
        const at = angleTo(sim, man);
        sim.step([{ a: 'bino', v: [1] }, cam(at.az, Math.round(at.el))]);
        const seen = p.members.find((m) => m.alive && m.vis)!;
        expect(sim.step([idAt(angleTo(sim, seen))]).accepted).toEqual([true]);
        until(sim, () => p.intel.stage >= stage, 3000);
        expect(p.intel.stage).toBe(stage);
      }
      const effect = truthOf(sim).effect;
      const said = radio(untilTaken(sim, EOM(effect), 10))[0]!;
      return { slots: said.kind === 'end_of_mission' ? said.slots : null, sentence: spoken(radioSentence(said, NAMES)) };
    };
    const unseen = name(0);
    expect(unseen.slots).toMatchObject({ targetName: 'unknown' });
    expect(unseen.sentence).toMatch(/^임무끝, 표적 /);
    expect(name(1).slots).toMatchObject({ targetName: 'unknown' }); // found, not yet told apart
    const kind = name(2);
    expect(kind.slots).toMatchObject({ targetName: 'infantry', named: 0 });
    expect(kind.sentence).toMatch(/^임무끝, 적 보병 /);
    const size = name(3);
    expect(size.slots).toMatchObject({ targetName: 'infantry', named: 1 });
    expect(size.sentence).toMatch(/^임무끝, 적 보병소대 /);
  });
});

describe('F-07: 임무 요약', () => {
  const az = (sim: Sim) => {
    const { op, platoons } = sim.state;
    return ((Math.atan2(platoons[0]!.x - op.x, platoons[0]!.y - op.y) * 3200) / Math.PI + 6400) % 6400;
  };
  /** Sends `input` once it is taken; returns the score its 전과 보고 earned, judged from the members then. */
  const reported = (sim: Sim, input: Input) => {
    untilTaken(sim, input);
    return truthOf(sim).effect === input.v!.at(-1) ? 30 : -20;
  };

  test('초탄 오차·방향 오차·수정열·보고와 실제·임무 점수가 남는다', () => {
    const sim = hit(CALL_ADJUST);
    const first = untilLanded(sim).find(isImpact)!;
    const p = sim.state.platoons[0]!;
    const firstError = Math.round(Math.hypot(first.x - p.x, first.y - p.y));
    expect(firstError).toBeGreaterThan(0);
    const dir = Math.round(az(sim)) + 37;
    untilTaken(sim, corr(dir, 'right', 0, 'add', 120, 'adjust')); // 사거리 snaps to 100
    untilTaken(sim, corr('left', 0, 'drop', 50, 'ffe'));
    const points = reported(sim, corr('right', 30, 'drop', 0, 'ffe', 'neutralized')) + reported(sim, EOM('destroyed'));
    const m = sim.state.missions[0]!;
    expect(m).toMatchObject({ target: 0, firstError, rangeCorrections: [100, 50], corrections: 3, report: 'destroyed', truth: truthOf(sim).effect, score: points });
    expect(Math.abs(m.directionError! - 37)).toBeLessThanOrEqual(1);
    expect(m.mto!.targetNumber).toBe(1001); // 표적번호
  });

  test('바로 효력사에는 초탄 오차가 없고, 방향은 보낸 때에 잰다', () => {
    const sim = hit();
    toEffect(sim);
    const a = az(sim);
    const dir = Math.round(a < 3200 ? a + 3500 : a - 3500); // 3,500 mils off one way is 2,900 the short way round
    reported(sim, corr(dir, 'right', 0, 'add', 0, 'ffe', 'ineffective'));
    expect(sim.state.missions[0]).toMatchObject({ target: 0, firstError: null, rangeCorrections: [], corrections: 1 });
    expect(Math.abs(sim.state.missions[0]!.directionError! - 2900)).toBeLessThanOrEqual(1);
    const empty = ffe();
    untilTaken(empty, EOM('destroyed'));
    expect(empty.state.missions[0]).toMatchObject({ target: -1, firstError: null, directionError: null, corrections: 0 });
  });
});

describe('F-07: 임무끝', () => {
  test('임무끝 뒤 교신이 대기로 돌아가 새 호출을 받는다', () => {
    const sim = ffe();
    expect(send(sim, CALL_ADJUST).ok).toBe(false); // 효력사 under way: no new call
    const taken = untilTaken(sim, EOM('destroyed'));
    expect(radio(taken)).toEqual([
      { speaker: 'observer', ending: 'none', kind: 'end_of_mission', slots: { targetName: 'unknown', effect: 'destroyed' } },
    ]);
    expect(spoken(radioSentence(radio(taken)[0]!, NAMES))).toBe('임무끝, 표적 파괴.');
    // 기러기 does not answer 임무끝; nothing more of this mission is taken.
    for (const input of [EOM('destroyed'), REPEAT('neutralized', 2), corr(800, 'right', 50, 'add', 0, 'ffe', 'neutralized')] as Input[])
      expect(send(sim, input).ok, input.a).toBe(false);
    expect(radio(quiet(sim, 400))).toEqual([]);
    const call = send(sim, CALL_ADJUST);
    expect(call.ok).toBe(true);
    expect(radio(untilSaid(sim, 'fdc', 'call_ack')).at(-1)).toMatchObject({ speaker: 'fdc', kind: 'call_ack', slots: { warning: 'adjust' } });
  });
});

describe('F-09: 사격지휘통보와 표적번호', () => {
  test('임무끝 뒤 두 번째 임무의 표적번호는 AB1002다', () => {
    const sim = ffe();
    untilTaken(sim, EOM('ineffective'));
    const mto = radio(toReady(sim, DESC_UNKNOWN, CALL_ADJUST, LOC)).find((u) => u.speaker === 'fdc' && u.kind === 'mto')!;
    expect(mto.kind === 'mto' && mto.slots.targetNumber).toBe(1002);
    expect(spoken(radioSentence(mto, NAMES))).toContain('표적번호 알파브라보 하나공공둘');
    expect(sim.state.missions).toHaveLength(2);
  });
});
