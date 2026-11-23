// 실전의 임무 중 관측소 이동 (M4-10, #182, ADR 0022): through the simulation's public interface only. The flat test
// terrain is 640 m square with the post at its middle (320, 320); a move must stay 200 m inside every side.
import { expect, test } from 'vitest';
import { createSim, moveCheck, type Input, type MtoSlots, type RadioEvent, type Scenario, type Sim, type SimEvent } from '@sim';
import { COMBAT } from '@content/combat';
import { combatInit, init, START } from './init';
import { oneUnit } from './enemy';
import { answered, CALL_ADJUST, CALL_FFE, corr, DESC_UNKNOWN, EOM, LOC, MOVE, openRadio, POLAR, POS, POS_SKIP, REPEAT, send, untilImpact } from './mission';
import { gridAt, NEAR } from './strike';
import { flatTerrain } from './terrain';

// One enemy unit that never sets off (so a 방향 has an error to score) and no friendly troops.
const SCENARIO = oneUnit({ type: 'inf', route: 'A', t0: 1e6 });
type Mode = 'training' | 'standard' | 'combat';
function game(mode: Mode, scenario: Scenario = SCENARIO, seed = 7): Sim {
  const sim = createSim({ ...(mode === 'combat' ? combatInit(seed) : { ...init(seed), mode }), scenario });
  sim.step([START]);
  openRadio(sim);
  return sim;
}
/** 170 m off, about 140 s on foot: the round of a mission lands while the post still walks. */
const FAR = MOVE(440, 440);
const RB_SHOT: Input = { a: 'readback', v: ['shot'] };
const RB_RC: Input = { a: 'readback', v: ['rounds_complete'] };
const rbMto = (sim: Sim): Input => {
  const m: MtoSlots = sim.state.missions.at(-1)!.mto!;
  return { a: 'readback', v: ['mto', m.fuze, m.rounds, m.control, m.targetNumber] };
};
const kinds = (events: readonly RadioEvent[], speaker: string) => events.filter((e) => e.utterance.speaker === speaker).map((e) => `${e.utterance.kind}@${e.tick}`);
/** Steps with no input until `done`; returns every event on the way. */
function until(sim: Sim, done: () => boolean, limit = 8000): SimEvent[] {
  const out: SimEvent[] = [];
  for (let k = 0; k < limit && !done(); k++) out.push(...sim.step([]).events);
  if (!done()) throw new Error('not reached');
  return out;
}
const mission = (sim: Sim) => sim.state.missions.at(-1)!;
/** The call and the location, each answered: the next input is the 표적성질. */
function located(sim: Sim, call: Input, loc: Input): void {
  for (const [input, a] of [[call, 'call'], [loc, 'loc']] as const) {
    expect(send(sim, input).ok).toBe(true);
    answered(sim, a);
  }
}

test('실전: 임무 중 관측소 이동 — 임무가 이어지고 예약된 교신과 탄이 그대로 간다', () => {
  const sim = game('combat');
  const still = game('combat'); // the same game without the move
  for (const s of [sim, still]) {
    located(s, CALL_ADJUST, POLAR(800, 2000));
    expect(send(s, DESC_UNKNOWN).ok).toBe(true);
  }
  // Refused for the mission by default; the 실전 수치's value lifts that and nothing else.
  const to = { x: 440, y: 440 };
  expect(COMBAT.numbers.moveInMission).toBe(1);
  expect([moveCheck(sim.state, flatTerrain(), to), moveCheck(sim.state, flatTerrain(), to, true)]).toEqual(['mission', null]);
  expect(moveCheck(sim.state, flatTerrain(), { x: 100, y: 320 }, true)).toBe('edge');
  // Taken at once: the observer's 이동 통보 goes on that tick and the radio stage stays the mission's.
  const stage = sim.state.radio.stage;
  const moved = send(sim, FAR);
  still.step([]);
  expect(moved.ok).toBe(true);
  expect(moved.events.map((e) => [e.utterance.speaker, e.utterance.kind])).toEqual([['observer', 'move_notice']]);
  expect([sim.state.radio.stage, sim.state.post.state, sim.state.reportDue]).toEqual([stage, 'moving', true]);
  expect(send(sim, FAR).ok).toBe(false); // already moving, as before
  still.step([]);
  // What 기러기 had planned comes at the same ticks as without the move, and so does the round; its own answer to the
  // 이동 통보 comes between.
  const a = untilImpact(sim);
  const b = untilImpact(still);
  expect(a.impact).toEqual(b.impact);
  expect(kinds(a.said, 'fdc').filter((k) => !k.startsWith('move_notice'))).toEqual(kinds(b.said, 'fdc'));
  expect(kinds(a.said, 'fdc').filter((k) => k.startsWith('move_notice'))).toHaveLength(1);
  expect(a.said.find((e) => e.utterance.speaker === 'fdc' && e.utterance.kind === 'move_notice')!.tick - moved.events[0]!.tick).toBeGreaterThanOrEqual(50);
  expect(sim.state.post.state).toBe('moving'); // still on the way when the round lands
});

test('실전: 임무 중 관측소 이동 — 걷는 동안 수정과 재효력사는 받아들여지지 않고 나머지 임무 교신은 된다', () => {
  // 조정: the readback goes while walking; the correction does not, with or without a 방향.
  const sim = game('combat');
  located(sim, CALL_ADJUST, LOC);
  expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
  expect(send(sim, FAR).ok).toBe(true);
  until(sim, () => mission(sim).mto !== null && !!mission(sim).readback?.mto);
  expect(send(sim, rbMto(sim)).ok).toBe(true);
  untilImpact(sim);
  until(sim, () => sim.state.radio.stage === 'adjust');
  expect(send(sim, RB_SHOT).ok).toBe(true);
  expect(sim.state.post.state).toBe('moving');
  for (const c of [corr(800, 'right', 60, 'drop', 200, 'adjust'), corr('right', 60, 'drop', 200, 'adjust')]) expect(send(sim, c).ok).toBe(false);
  // Arrived: during the 장비 설치 the correction goes.
  until(sim, () => sim.state.post.state === 'setup');
  expect(send(sim, corr(800, 'right', 60, 'drop', 200, 'adjust')).ok).toBe(true);

  // 바로 효력사: 재효력사 waits for the arrival, 임무끝 does not.
  const ffe = game('combat');
  located(ffe, CALL_FFE, LOC);
  expect(send(ffe, DESC_UNKNOWN).ok).toBe(true);
  expect(send(ffe, FAR).ok).toBe(true);
  until(ffe, () => !!mission(ffe).readback?.mto);
  expect(send(ffe, rbMto(ffe)).ok).toBe(true);
  until(ffe, () => ffe.state.radio.stage === 'effect' && !!mission(ffe).readback?.rounds_complete);
  for (const rb of [RB_SHOT, RB_RC]) expect(send(ffe, rb).ok).toBe(true);
  expect(ffe.state.post.state).toBe('moving');
  expect(send(ffe, REPEAT('ineffective', 2)).ok).toBe(false);
  expect(send(ffe, EOM('ineffective')).ok).toBe(true);
  expect(ffe.state.radio.stage).toBe('idle');
});

test('실전: 임무 중 관측소 이동 — 도착하면 다음 수정이 방향을 다시 싣고 방향 오차는 첫 방향 그대로다', () => {
  // A unit 2 km north to aim at, so the first 방향 has an error to score.
  const sim = game('combat', NEAR);
  located(sim, CALL_ADJUST, gridAt(sim.state.platoons[0]!));
  expect(mission(sim).target).toBe(0);
  expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
  /** The adjusting round lands and is read back: 기러기 takes a correction. */
  const landed = () => {
    untilImpact(sim);
    until(sim, () => sim.state.radio.stage === 'adjust');
    expect(send(sim, RB_SHOT).ok).toBe(true);
  };
  until(sim, () => !!mission(sim).readback?.mto);
  expect(send(sim, rbMto(sim)).ok).toBe(true);
  landed();
  // The mission's first correction carries the 방향; its error is scored.
  expect(send(sim, corr(800, 'right', 60, 'drop', 200, 'adjust')).ok).toBe(true);
  const error = mission(sim).directionError;
  expect([mission(sim).direction, error === null]).toEqual([800, false]);
  // Set off while that round is on its way: the 방향 stands until the post arrives.
  expect(send(sim, FAR).ok).toBe(true);
  landed();
  expect([sim.state.post.state, mission(sim).direction]).toEqual(['moving', 800]);
  const arrival = until(sim, () => sim.state.post.state === 'setup');
  expect(arrival.some((e) => e.type === 'post' && e.what === 'arrived')).toBe(true);
  expect([mission(sim).direction, mission(sim).directionError]).toEqual([null, error]);
  // No 방향, no correction; with one it is the new 기준선, and the scored error is still the first one's.
  expect(send(sim, corr('right', 60, 'drop', 200, 'adjust')).ok).toBe(false);
  const sent = send(sim, corr(1450, 'right', 60, 'drop', 200, 'adjust'));
  expect(sent.ok).toBe(true);
  expect('slots' in sent.events[0]!.utterance && sent.events[0]!.utterance.slots).toMatchObject({ direction: 1450 });
  expect([mission(sim).direction, mission(sim).directionError, mission(sim).corrections]).toEqual([1450, error, 2]);
  // The next one carries none, as before.
  landed();
  expect(send(sim, corr(1450, 'left', 20, 'add', 50, 'adjust')).ok).toBe(false);
  expect(send(sim, corr('left', 20, 'add', 50, 'adjust')).ok).toBe(true);
});

test('실전: 임무 중 관측소 이동 — 위치 보고는 임무끝 뒤에만 나간다', () => {
  const sim = game('combat');
  located(sim, CALL_FFE, LOC);
  expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
  expect(send(sim, MOVE(340, 320)).ok).toBe(true); // 20 m: there and set up before the 효력사 is over
  until(sim, () => !!mission(sim).readback?.mto);
  expect(send(sim, rbMto(sim)).ok).toBe(true);
  until(sim, () => sim.state.radio.stage === 'effect' && !!mission(sim).readback?.rounds_complete && sim.state.post.state === 'ready');
  for (const rb of [RB_SHOT, RB_RC]) expect(send(sim, rb).ok).toBe(true);
  // The post is set up and the report is owed, but the mission holds the radio: neither the report nor its skip.
  expect([sim.state.reportDue, sim.state.post.state]).toEqual([true, 'ready']);
  for (const input of [POS(4034, 3032), POS_SKIP]) expect(send(sim, input).ok).toBe(false);
  expect(send(sim, EOM('ineffective')).ok).toBe(true);
  // 임무끝: the report goes, and until it does no new call.
  expect(send(sim, CALL_ADJUST).ok).toBe(false);
  const report = send(sim, POS(4034, 3032));
  expect(report.ok).toBe(true);
  expect(report.events.map((e) => e.utterance.kind)).toEqual(['position_report']);
  until(sim, () => !sim.state.reportDue);
  expect(send(sim, CALL_ADJUST).ok).toBe(true);
});

test('실전: 임무 중 관측소 이동 — 훈련·표준은 거절 그대로이고 난수 스트림의 뽑은 횟수가 같다', () => {
  for (const mode of ['training', 'standard'] as const) {
    const sim = game(mode);
    const twin = game(mode); // never asks to move
    for (const s of [sim, twin]) {
      located(s, CALL_ADJUST, POLAR(800, 2000));
      expect(send(s, DESC_UNKNOWN).ok).toBe(true);
    }
    expect(moveCheck(sim.state, flatTerrain(), { x: 440, y: 440 }), mode).toBe('mission');
    // Asked at every stage of the mission, to its 임무끝: refused each time, and nothing of the game moves for it.
    const drive = (s: Sim, ask: boolean) => {
      const asked: boolean[] = [];
      const step = (inputs: Input[] = []) => {
        const r = s.step(ask ? [...inputs, FAR] : inputs);
        if (ask) asked.push(r.accepted.at(-1)!);
        return r;
      };
      const run = (done: () => boolean) => {
        for (let k = 0; k < 8000 && !done(); k++) step();
      };
      run(() => s.state.radio.stage === 'adjust');
      for (let k = 0; k < 30; k++) step();
      expect(step([corr('right', 60, 'drop', 200, 'ffe')]).accepted[0], mode).toBe(true);
      run(() => s.state.radio.stage === 'effect');
      for (let k = 0; k < 400; k++) step();
      return asked;
    };
    const asked = drive(sim, true);
    drive(twin, false);
    expect(asked.length, mode).toBeGreaterThan(1000);
    expect(asked.every((ok) => !ok), mode).toBe(true);
    expect(sim.state.post, mode).toEqual(twin.state.post);
    expect(sim.state.rng, mode).toEqual(twin.state.rng);
    expect(sim.hash(), mode).toBe(twin.hash());
    // After 임무끝 the move goes, as before.
    expect(send(sim, EOM('ineffective')).ok, mode).toBe(true);
    expect(send(sim, FAR).ok, mode).toBe(true);
  }
});

test('실전: 임무 중 관측소 이동 — 위치 보고의 응답을 기다리는 동안에는 임무가 아니므로 이동이 거절된다', () => {
  // No mission yet: the post moves, sets up and reports. Until 기러기 answers, the radio is held by the report, not by a
  // mission: a move then would be answered by the report on its way, and the new post would go unreported.
  const sim = game('combat');
  expect(send(sim, MOVE(350, 320)).ok).toBe(true);
  until(sim, () => sim.state.post.state === 'ready');
  expect(send(sim, POS(4035, 3032)).ok).toBe(true);
  expect([sim.state.radio.stage, sim.state.missions.length]).toEqual(['wait', 0]);
  for (const to of [MOVE(351, 320), FAR]) expect(send(sim, to).ok).toBe(false);
  expect(moveCheck(sim.state, flatTerrain(), { x: 440, y: 440 }, true)).toBe('mission');
  // Answered: the report is no longer owed, and now the post may move; that move owes a report of its own.
  until(sim, () => sim.state.radio.stage === 'idle');
  expect(sim.state.reportDue).toBe(false);
  expect(send(sim, FAR).ok).toBe(true);
  expect(sim.state.reportDue).toBe(true);
  until(sim, () => sim.state.post.state === 'ready');
  expect(send(sim, CALL_ADJUST).ok).toBe(false); // not before the new post is reported (or the report skipped)
});
