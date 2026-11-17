// 실전의 복창 (M3-14, #121): the readback rules through the simulation's public interface only.
import { expect, test } from 'vitest';
import { createSim, type Input, type MtoSlots, type RadioEvent, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { combatInit, init, START } from './init';
import { corr, DESC_AMC, EOM, FIRE, MOVE, openRadio, radioEvents, send, toReady, untilImpact, untilTaken } from './mission';

const SCENARIO = { ...BASE_SCENARIO, units: [] };
/** A started game with no enemy, as `started` in mission.ts, in the given mode. */
function game(mode: 'training' | 'standard' | 'combat', seed = 7): Sim {
  const base = mode === 'combat' ? combatInit(seed) : { ...init(seed), mode };
  const sim = createSim({ ...base, scenario: SCENARIO });
  sim.step([START]);
  return sim;
}

const RB_SHOT: Input = { a: 'readback', v: ['shot'] };
const RB_RC: Input = { a: 'readback', v: ['rounds_complete'] };
const rbMto = (m: MtoSlots): Input => ({ a: 'readback', v: ['mto', m.fuze, m.rounds, m.control, m.targetNumber] });
/** The mission's first correction (방향 with it), 효력사 next. */
const CORR_FFE = corr(4720, 'right', 60, 'drop', 200, 'ffe');
const LASE: Input = { a: 'lase', v: [204, -220] };
const mtoOf = (sim: Sim): MtoSlots => ({ ...sim.state.missions.at(-1)!.mto! });
const said = (events: readonly RadioEvent[], speaker: string, kind: string) =>
  events.filter((e) => e.utterance.speaker === speaker && e.utterance.kind === kind);
/** Steps with no input until the radio stage is `stage`; returns the radio events on the way. */
function untilStage(sim: Sim, stage: string, limit = 4000): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let k = 0; k < limit && sim.state.radio.stage !== stage; k++) out.push(...radioEvents(sim, 1));
  if (sim.state.radio.stage !== stage) throw new Error(`stage ${stage} not reached`);
  return out;
}

test('실전: 복창 — 사격지휘통보·하나발 떳다·마감탄 떳다를 복창해야 그 임무의 다음 송신이 받아들여진다', () => {
  const sim = game('combat');
  const twin = game('standard');
  for (const s of [sim, twin]) {
    openRadio(s);
    toReady(s);
  }
  // 기러기 does not wait: the adjusting round goes and lands at the same ticks without any readback.
  const a = untilImpact(sim);
  const b = untilImpact(twin);
  expect(a.impact.tick).toBe(b.impact.tick);
  expect(said(a.said, 'fdc', 'shot').map((e) => e.tick)).toEqual(said(b.said, 'fdc', 'shot').map((e) => e.tick));
  radioEvents(sim, 30);
  expect(sim.state.radio.stage).toBe('adjust');
  expect(send(sim, CORR_FFE).ok).toBe(false); // 사격지휘통보 and 하나발 owed
  expect(send(sim, LASE).ok).toBe(true); // not blocked
  const shot = send(sim, RB_SHOT);
  expect(shot.ok).toBe(true);
  expect(shot.events.map((e) => e.utterance)).toEqual([{ speaker: 'observer', ending: 'wait', kind: 'shot' }]);
  expect(send(sim, RB_SHOT).ok).toBe(false); // nothing owed for it now
  expect(send(sim, CORR_FFE).ok).toBe(false); // 사격지휘통보 still owed
  const mto = mtoOf(sim);
  const rb = send(sim, rbMto(mto));
  expect(rb.ok).toBe(true);
  expect(rb.events.map((e) => e.utterance)).toEqual([{ speaker: 'observer', ending: 'wait', kind: 'mto', slots: mto }]);
  expect(send(sim, CORR_FFE).ok).toBe(true);
  // 효력사: 하나발 and 마감탄 both owed before 임무끝.
  untilStage(sim, 'effect');
  expect(send(sim, EOM('ineffective')).ok).toBe(false);
  expect(send(sim, RB_SHOT).ok).toBe(true);
  expect(send(sim, EOM('ineffective')).ok).toBe(false);
  expect(send(sim, RB_RC).ok).toBe(true);
  expect(send(sim, EOM('ineffective')).ok).toBe(true);

  // 지명사: "준비 쏴" waits for the 사격지휘통보 readback. The readback holds no 관측소 이동: a move mid-mission is
  // judged as in standard (refused for the mission, as before), and one after 임무끝 goes.
  const amc = game('combat');
  const std = game('standard');
  for (const s of [amc, std]) {
    openRadio(s);
    toReady(s, DESC_AMC);
  }
  expect(send(amc, FIRE).ok).toBe(false);
  std.step([]);
  expect(send(amc, LASE).ok).toBe(true);
  expect(send(std, LASE).ok).toBe(true);
  expect(send(amc, MOVE(400, 320)).ok).toBe(send(std, MOVE(400, 320)).ok);
  expect(send(amc, rbMto(mtoOf(amc))).ok).toBe(true);
  expect(send(amc, FIRE).ok).toBe(true);
  expect(send(sim, MOVE(400, 320)).ok).toBe(true); // after 임무끝
});

test('실전: 틀린 복창 — 넣은 대로 나가고 2.5초 뒤 기러기가 정정과 바른 전문을 말하며 복창은 밀린 채 남는다', () => {
  const sim = game('combat');
  const twin = game('combat'); // reads back right at once
  for (const s of [sim, twin]) {
    openRadio(s);
    toReady(s);
  }
  const mto = mtoOf(sim);
  const wrong = { ...mto, rounds: mto.rounds === 1 ? 2 : 1 };
  const sent = sim.state.tick;
  const r = send(sim, rbMto(wrong));
  expect(r.ok).toBe(true);
  expect(r.events.map((e) => e.utterance)).toEqual([{ speaker: 'observer', ending: 'wait', kind: 'mto', slots: wrong }]);
  expect(send(twin, rbMto(mto)).ok).toBe(true);
  // Until 기러기's 정정, no readback is taken, right or wrong.
  const between: RadioEvent[] = [];
  while (sim.state.tick < sent + 50) {
    const x = send(sim, rbMto(sim.state.tick % 2 ? mto : wrong));
    expect(x.ok, String(sim.state.tick)).toBe(false);
    between.push(...x.events);
    twin.step([]);
  }
  const correction = said(between, 'fdc', 'mto_correction');
  expect(correction.map((e) => ({ tick: e.tick, u: e.utterance }))).toEqual([
    { tick: sent + 50, u: { speaker: 'fdc', ending: 'wait', kind: 'mto_correction', slots: mto } },
  ]);
  // Still owed after the 정정: the right readback is taken now and frees the correction.
  untilStage(sim, 'adjust');
  while (twin.state.tick < sim.state.tick) twin.step([]);
  for (const s of [sim, twin]) expect(send(s, RB_SHOT).ok).toBe(true);
  expect(send(sim, CORR_FFE).ok).toBe(false);
  twin.step([]);
  expect(send(sim, rbMto(mto)).ok).toBe(true);
  twin.step([]);
  for (const s of [sim, twin]) expect(send(s, CORR_FFE).ok).toBe(true);
  radioEvents(sim, 400);
  radioEvents(twin, 400);
  expect(sim.state.tick).toBe(twin.state.tick);
  expect(sim.state.rng).toEqual(twin.state.rng); // no draw for a readback or a 정정
});

test('실전: 복창 입력 — 훈련·표준에서는 받아들이지 않고 관측자의 복창이 지금처럼 저절로 나간다', () => {
  for (const mode of ['training', 'standard'] as const) {
    const sim = game(mode);
    openRadio(sim);
    toReady(sim);
    expect(send(sim, rbMto(mtoOf(sim))).ok, mode).toBe(false);
    const { said: before } = untilImpact(sim);
    const after = radioEvents(sim, 30);
    const shot = said(before, 'fdc', 'shot')[0]!;
    expect(said([...before, ...after], 'observer', 'shot').map((e) => e.tick), mode).toEqual([shot.tick + 24]);
    expect(send(sim, RB_SHOT).ok, mode).toBe(false);
    expect(send(sim, CORR_FFE).ok, mode).toBe(true);
    const ffe = untilStage(sim, 'effect');
    const rc = said(ffe, 'fdc', 'rounds_complete')[0]!;
    expect(said(ffe, 'observer', 'rounds_complete').map((e) => e.tick), mode).toEqual([rc.tick + 24]);
    expect(send(sim, RB_RC).ok, mode).toBe(false);
    untilTaken(sim, EOM('ineffective'), 1);
  }
  // 실전: the two readbacks never go out by themselves.
  const sim = game('combat');
  openRadio(sim);
  toReady(sim);
  const { said: before } = untilImpact(sim);
  const after = radioEvents(sim, 400);
  expect(said([...before, ...after], 'observer', 'shot')).toEqual([]);
  send(sim, RB_SHOT);
  send(sim, rbMto(mtoOf(sim)));
  expect(send(sim, CORR_FFE).ok).toBe(true);
  const ffe = [...untilStage(sim, 'effect'), ...radioEvents(sim, 400)];
  expect(said(ffe, 'fdc', 'rounds_complete')).toHaveLength(1);
  expect([...said(ffe, 'observer', 'shot'), ...said(ffe, 'observer', 'rounds_complete')]).toEqual([]);
});
