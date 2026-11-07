// 사격요구 교신 (F-07, F-09): 통신 점검, the three transmissions and 기러기's replies, through the public interface only.
import { describe, expect, test } from 'vitest';
import { validateReplay, type Input, type RadioEvent, type Sim } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { radioSentence, spoken } from '@ui/radio/sentence';
import { replayData, START } from './init';
import { answered, CALL_ADJUST, CALL_FFE, desc, DESC_UNKNOWN, LOC, openRadio, radioEvents, send, started, toReady, unstarted } from './mission';

const said = (events: readonly RadioEvent[]) =>
  events.map((e) => ({ tick: e.tick, speaker: e.utterance.speaker, kind: e.utterance.kind, ending: e.utterance.ending }));

/** Steps both to the same tick, `sim` with `input` at that step, its twin with nothing. */
function ignoredLikeTwin(sim: Sim, twin: Sim, input: Input) {
  const r = sim.step([input]);
  const t = twin.step([]);
  expect(r.accepted).toEqual([false]);
  expect(r.events).toEqual(t.events);
  expect(sim.hash()).toBe(twin.hash());
}

describe('F-09: 통신 점검', () => {
  test('기러기가 개시 4초 뒤 감명 보고를 묻고 1.5초 뒤 감명 양호가 나간다', () => {
    const sim = started();
    const events = radioEvents(sim, 120);
    expect(said(events)).toEqual([
      { tick: 80, speaker: 'fdc', kind: 'radio_check', ending: 'over' },
      { tick: 110, speaker: 'observer', kind: 'radio_check_reply', ending: 'over' },
    ]);
    expect(sim.state.rng.fdc.count).toBe(0);
  });

  test('점검이 끝나야 호출을 받는다', () => {
    const sim = started();
    const twin = started();
    for (const t of [1, 80, 109]) {
      while (sim.state.tick < t) {
        sim.step([]);
        twin.step([]);
      }
      ignoredLikeTwin(sim, twin, CALL_ADJUST);
    }
    expect(sim.state.tick).toBe(110);
    expect(send(sim, CALL_ADJUST).ok).toBe(true);
  });

  test('openRadio stops at the first step that takes calls', () => {
    const sim = started();
    openRadio(sim);
    expect(sim.state.tick).toBe(110);
  });
});

describe('F-07: 세 송신의 순서와 상태 가드', () => {
  /** Two opened sims kept in step; `act(sim)` drives only the first, `both` steps them together. */
  const pair = () => {
    const sim = started();
    const twin = started();
    openRadio(sim);
    openRadio(twin);
    return { sim, twin };
  };
  const sendBoth = (sim: Sim, twin: Sim, input: Input) => {
    expect(sim.step([input]).accepted).toEqual([true]);
    expect(twin.step([input]).accepted).toEqual([true]);
  };
  /** Both run until 기러기 has answered the transmission `a`. */
  const runBoth = (sim: Sim, twin: Sim, a: 'call' | 'loc' | 'desc') => {
    answered(sim, a);
    answered(twin, a);
    expect(sim.state.tick).toBe(twin.state.tick);
  };

  test('호출 → 좌표 → 성질 순서로만 받고 어긋난 입력은 무시된다', () => {
    const { sim, twin } = pair();
    // idle: only a call
    ignoredLikeTwin(sim, twin, LOC);
    ignoredLikeTwin(sim, twin, DESC_UNKNOWN);
    sendBoth(sim, twin, CALL_ADJUST);
    // waiting for call_ack: nothing
    ignoredLikeTwin(sim, twin, CALL_ADJUST);
    ignoredLikeTwin(sim, twin, LOC);
    runBoth(sim, twin, 'call');
    ignoredLikeTwin(sim, twin, CALL_ADJUST);
    ignoredLikeTwin(sim, twin, DESC_UNKNOWN);
    sendBoth(sim, twin, LOC);
    runBoth(sim, twin, 'loc');
    ignoredLikeTwin(sim, twin, LOC);
    ignoredLikeTwin(sim, twin, CALL_ADJUST);
    sendBoth(sim, twin, DESC_UNKNOWN);
    ignoredLikeTwin(sim, twin, DESC_UNKNOWN);
    runBoth(sim, twin, 'desc');
    expect(sim.hash()).toBe(twin.hash());
  });

  test('작전 준비 중에는 호출을 받지 않는다', () => {
    const sim = unstarted();
    const twin = unstarted();
    ignoredLikeTwin(sim, twin, CALL_ADJUST);
    expect(sim.state.tick).toBe(0);
  });

  test('받아들인 송신은 상태를 바꾼다', () => {
    const { sim, twin } = pair();
    sim.step([CALL_ADJUST]);
    twin.step([]);
    expect(sim.hash()).not.toBe(twin.hash());
  });
});

describe('F-07: 표적성질 슬롯', () => {
  /** An opened sim at the 표적성질 stage. */
  const atDesc = () => {
    const sim = started();
    openRadio(sim);
    send(sim, CALL_ADJUST);
    answered(sim, 'call');
    send(sim, LOC);
    answered(sim, 'loc');
    return sim;
  };
  const HEAD = [3, 'none', 'ready', 0] as const;

  test.each([
    ['미상 표적', [...HEAD, 'unknown'], { targetType: 'unknown' }],
    ['공격중인 보병 1개 소대', [...HEAD, 'infantry', 'attacking', 'platoon'], { targetType: 'infantry', activity: 'attacking', unit: 'platoon' }],
    ['이동중인 장갑차 2대', [2, 'vt', 'amc', 1, 'apc', 'moving', 'vehicles', 2], { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 }],
    ['사격중인 박격포 3문', [...HEAD, 'mortar', 'firing', 'tubes', 3], { targetType: 'mortar', activity: 'firing', unit: 'tubes', count: 3 }],
    ['정지한 보병, 규모 없음', [...HEAD, 'infantry', 'halted', 'none'], { targetType: 'infantry', activity: 'halted', unit: 'none' }],
  ] as const)('받아들인다: %s', (_, v, target) => {
    const sim = atDesc();
    const r = send(sim, desc(...v));
    expect(r.ok).toBe(true);
    const [rounds, fuzeRequest, control, dangerClose] = v;
    expect(r.events.map((e) => e.utterance)).toEqual([
      { speaker: 'observer', ending: 'over', kind: 'description', slots: { rounds, fuzeRequest, control, dangerClose, ...target } },
    ]);
  });

  test.each([
    ['미상 표적에 활동', [...HEAD, 'unknown', 'moving']],
    ['명 단위에 수 없음', [...HEAD, 'infantry', 'attacking', 'men']],
    ['소대에 수', [...HEAD, 'infantry', 'attacking', 'platoon', 2]],
    ['수 0', [...HEAD, 'infantry', 'attacking', 'men', 0]],
    ['수 100', [...HEAD, 'infantry', 'attacking', 'men', 100]],
    ['발수 0', [0, 'none', 'ready', 0, 'unknown']],
    ['발수 6', [6, 'none', 'ready', 0, 'unknown']],
    ['모르는 열거값', [...HEAD, 'tank', 'attacking', 'platoon']],
    ['열거값 자리에 수', [3, 1, 'ready', 0, 'unknown']],
    ['수 자리에 문자열', ['3', 'none', 'ready', 0, 'unknown']],
    ['위험근접 2', [3, 'none', 'ready', 2, 'unknown']],
    ['정수가 아닌 수', [...HEAD, 'apc', 'moving', 'vehicles', 1.5]],
  ] as const)('무시한다: %s', (_, v) => {
    const sim = atDesc();
    const twin = atDesc();
    ignoredLikeTwin(sim, twin, desc(...v));
  });

  test('재생 자료 형식 검사도 같은 판정이다', () => {
    const at = (v: readonly (number | string)[]) => replayData([{ t: 0, ...START }, { t: 5, a: 'desc', v }]);
    expect(validateReplay(at([3, 'vt', 'amc', 1, 'apc', 'moving', 'vehicles', 2])).ok).toBe(true);
    expect(validateReplay(at([3, 'none', 'ready', 0, 'unknown', 'moving'])).ok).toBe(false);
    expect(validateReplay(replayData([{ t: 0, ...START }, { t: 5, a: 'call', v: ['ffe'] }])).ok).toBe(true);
    expect(validateReplay(replayData([{ t: 0, ...START }, { t: 5, a: 'call', v: ['repeat'] }])).ok).toBe(false);
  });
});

describe('F-09: 복창과 끝말', () => {
  test('기러기는 각 송신을 같은 슬롯으로 복창하고 끝말을 고른다', () => {
    const sim = started();
    openRadio(sim);
    const events = toReady(sim);
    const u = events.map((e) => e.utterance);
    expect(u.map((x) => [x.speaker, x.kind, x.ending])).toEqual([
      ['observer', 'call', 'over'],
      ['fdc', 'call_ack', 'over'],
      ['observer', 'location', 'over'],
      ['fdc', 'location', 'over'],
      ['observer', 'description', 'over'],
      ['fdc', 'description', 'wait'],
      ['fdc', 'mto', 'wait'],
      ['fdc', 'ready', 'none'],
    ]);
    const slots = (x: (typeof u)[number]) => ('slots' in x ? x.slots : undefined);
    expect(slots(u[1]!)).toEqual(slots(u[0]!));
    expect(slots(u[3]!)).toEqual({ method: 'grid', easting: 4720, northing: 3150 });
    expect(slots(u[3]!)).toEqual(slots(u[2]!));
    expect(slots(u[5]!)).toEqual(slots(u[4]!));
    expect(slots(u[7]!)).toEqual({}); // adjusting: 포대 사격준비 끝, no fuze
  });

  test('응답 시간은 기러기 스트림이 정한 범위 안이다', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const sim = started(seed);
      openRadio(sim);
      const e = toReady(sim);
      // An input sent at tick t is said in the step ending at t + 1; delays count from t.
      const sent = (i: number) => e[i]!.tick - 1;
      const within = (d: number, lo: number, hi: number) => expect(d >= lo && d <= hi, `seed ${seed}: ${d} in ${lo}–${hi}`).toBe(true);
      within(e[1]!.tick - sent(0), 50, 80);
      within(e[3]!.tick - sent(2), 50, 80);
      within(e[5]!.tick - sent(4), 60, 90);
      within(e[6]!.tick - sent(4), 180, 240);
      within(e[7]!.tick - sent(4), 480, 760);
    }
  });
});

describe('F-09: 사격지휘통보와 표적번호', () => {
  const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
  const find = (events: readonly RadioEvent[], kind: string) => events.find((e) => e.utterance.speaker === 'fdc' && e.utterance.kind === kind)!.utterance;

  // 임무마다 번호가 는다: a second mission needs 임무끝 (#30), which first returns the radio to a new call; #30 extends
  // this test with mission 2 → AB1002 (host decision, #29 Q2).
  test('첫 임무의 표적번호는 AB1001이다', () => {
    const sim = started();
    openRadio(sim);
    const mto = find(toReady(sim), 'mto');
    expect(mto.kind === 'mto' && mto.slots.targetNumber).toBe(1001);
    expect(sim.state.missions).toHaveLength(1);
    expect(sim.state.missions[0]!.mto).toEqual(mto.kind === 'mto' ? mto.slots : null);
    const sentence = spoken(radioSentence(mto, NAMES));
    expect(sentence).toContain('표적번호 알파브라보 하나공공하나');
    // 영문 2자 + 숫자 4자
    const letter = `(?:${Object.values(RADIO_GRAMMAR.phonetic.words).join('|')})`;
    const digit = `(?:${RADIO_GRAMMAR.digits.words.join('|')})`;
    expect(sentence).toMatch(new RegExp(`표적번호 ${letter}{2} ${digit}{4},`));
  });

  test('지명사 요청은 통보에 실리고 효력사 호출만 준비 끝에 신관을 붙인다', () => {
    const sim = started();
    openRadio(sim);
    const e = toReady(sim, desc(2, 'vt', 'amc', 0, 'unknown'), CALL_FFE);
    const mto = find(e, 'mto');
    expect(mto).toMatchObject({ kind: 'mto', slots: { fuze: 'vt', control: 'amc' } });
    expect(find(e, 'ready')).toEqual({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: { fuze: 'vt' } });
    expect(spoken(radioSentence(find(e, 'ready'), NAMES))).toBe('접근신관 사격준비 끝.');
  });
});

describe('F-09: 신관 판단', () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
  /** 기러기's 사격지휘통보 for `d` on each seed. */
  const mtos = (d: Input) =>
    SEEDS.map((seed) => {
      const sim = started(seed);
      openRadio(sim);
      const u = toReady(sim, d).find((e) => e.utterance.kind === 'mto')!.utterance;
      if (u.kind !== 'mto') throw new Error('no mto');
      return u.slots;
    });
  const fuzes = (d: Input) => new Set(mtos(d).map((m) => m.fuze));

  test('노출된 보병에는 접근신관을 고를 수 있다', () => {
    expect(fuzes(desc(3, 'none', 'ready', 0, 'infantry', 'attacking', 'platoon'))).toEqual(new Set(['vt', 'quick']));
    expect(fuzes(desc(3, 'quick', 'ready', 0, 'infantry', 'moving', 'squad'))).toEqual(new Set(['vt', 'quick']));
    expect(fuzes(desc(3, 'none', 'ready', 0, 'infantry', 'halted', 'platoon'))).toEqual(new Set(['quick']));
    expect(fuzes(DESC_UNKNOWN)).toEqual(new Set(['quick']));
    expect(fuzes(desc(3, 'vt', 'ready', 0, 'infantry', 'halted', 'platoon'))).toEqual(new Set(['vt']));
  });

  test('발수는 하나 줄 수 있지만 1발은 그대로다', () => {
    expect(new Set(mtos(DESC_UNKNOWN).map((m) => m.rounds))).toEqual(new Set([3, 2]));
    expect(new Set(mtos(desc(1, 'none', 'ready', 0, 'unknown')).map((m) => m.rounds))).toEqual(new Set([1]));
  });

  test('판단은 기러기 스트림에서만 뽑는다', () => {
    const sim = started();
    const before = structuredClone(sim.state.rng);
    openRadio(sim);
    toReady(sim, desc(3, 'none', 'ready', 0, 'infantry', 'attacking', 'platoon'));
    const { fdc, bal, ...others } = sim.state.rng;
    const { fdc: fdc0, bal: bal0, ...others0 } = before;
    expect(fdc.count).toBeGreaterThan(fdc0.count);
    expect(bal.count - bal0.count).toBe(2); // the mission's 비표준 조건 오차, drawn at the call (F-10)
    expect(others).toEqual(others0);
  });
});
