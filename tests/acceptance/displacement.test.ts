// 포대 진지 변환 (F-20의 포대 쪽, M3-20, #123 규칙 3): through the simulation's public interface only.
import { expect, test } from 'vitest';
import { createSim, type Input, type MtoSlots, type RadioEvent, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { combatInit, START } from './init';
import { CALL_ADJUST, CALL_FFE, DESC_AMC, DESC_UNKNOWN, EOM, FIRE, LOC, corr, openRadio, radioEvents, send, toAdjust, toReady, untilSaid, untilTaken } from './mission';

const sec = (s: number) => s * 20;
const GAP = sec(1300 * 0.25); // the 기본 포's 진지 변환 시간 × 0.25: 325 s
function game(): Sim {
  const sim = createSim({ ...combatInit(7), scenario: { ...BASE_SCENARIO, units: [] } });
  sim.step([START]);
  openRadio(sim);
  return sim;
}
const rbMto = (m: MtoSlots): Input => ({ a: 'readback', v: ['mto', m.fuze, m.rounds, m.control, m.targetNumber] });
const RB_SHOT: Input = { a: 'readback', v: ['shot'] };
const RB_RC: Input = { a: 'readback', v: ['rounds_complete'] };
const readMto = (sim: Sim) => expect(send(sim, rbMto({ ...sim.state.missions.at(-1)!.mto! })).ok).toBe(true);
const tickOf = (said: readonly RadioEvent[], kind: string) => said.find((e) => e.utterance.speaker === 'fdc' && e.utterance.kind === kind)?.tick;
const DISPLACING = { speaker: 'fdc', ending: 'wait', kind: 'displacing' };
const DISPLACED = { speaker: 'fdc', ending: 'none', kind: 'displaced' };
const words = (said: readonly RadioEvent[]) => said.filter((e) => e.utterance.kind === 'displacing' || e.utterance.kind === 'displaced');

test('F-20: 포대 진지 변환 — 첫 발 600초 뒤에는 사격준비 끝이 진지 변환 시간 × 0.25만큼 늦고 기러기가 두 마디로 알린다', () => {
  const sim = game();
  expect(words(radioEvents(sim, sec(700)))).toEqual([]); // before the first round the stay is not counted
  // The first round: a 효력사 mission, read back, ended.
  toReady(sim, DESC_UNKNOWN, CALL_FFE);
  readMto(sim);
  const first = tickOf(untilSaid(sim, 'fdc', 'shot'), 'shot')!;
  expect(send(sim, RB_SHOT).ok).toBe(true);
  untilSaid(sim, 'fdc', 'rounds_complete');
  expect(send(sim, RB_RC).ok).toBe(true);
  untilTaken(sim, EOM('ineffective'));
  // 600 s after it, nothing being fired: 기러기 says the first word at once.
  const before = radioEvents(sim, first + sec(600) - 1 - sim.state.tick);
  expect(words(before)).toEqual([]);
  const [start] = words(radioEvents(sim, 1));
  expect(start).toEqual({ type: 'radio', tick: first + sec(600), utterance: DISPLACING });
  // Meanwhile the call, the location and the 표적성질 are taken and read back as ever; only 사격준비 끝 waits.
  const said: RadioEvent[] = [];
  for (const input of [CALL_ADJUST, LOC, DESC_UNKNOWN]) {
    const r = send(sim, input);
    expect(r.ok, input.a).toBe(true);
    said.push(...r.events, ...untilSaid(sim, 'fdc', input.a === 'call' ? 'call_ack' : input.a === 'loc' ? 'location' : 'description'));
  }
  said.push(...untilSaid(sim, 'fdc', 'mto'));
  readMto(sim);
  said.push(...untilSaid(sim, 'fdc', 'ready', GAP));
  expect(tickOf(said, 'ready')).toBe(start!.tick + GAP);
  expect(words(said)).toEqual([{ type: 'radio', tick: start!.tick + GAP, utterance: DISPLACED }]);
  expect(said.findIndex((e) => e.utterance.kind === 'displaced')).toBeLessThan(said.findIndex((e) => e.utterance.kind === 'ready'));
  // The new position's first round starts the count again.
  const next = tickOf(untilSaid(sim, 'fdc', 'shot'), 'shot')!;
  expect(send(sim, RB_SHOT).ok).toBe(true);
  const after = radioEvents(sim, next + sec(600) - sim.state.tick);
  expect(words(after)).toEqual([{ type: 'radio', tick: next + sec(600), utterance: DISPLACING }]);
  expect(sim.state.battery!.until).toBe(next + sec(600) + GAP);

  // A fire whose 사격준비 끝 is out when the stay runs out is fired first: here a 지명사 round waiting for 준비 쏴.
  const amc = game();
  toReady(amc, DESC_AMC, CALL_ADJUST);
  readMto(amc);
  const shot = tickOf(send(amc, FIRE).events.concat(untilSaid(amc, 'fdc', 'shot')), 'shot')!;
  expect(send(amc, RB_SHOT).ok).toBe(true);
  toAdjust(amc);
  radioEvents(amc, shot + sec(560) - amc.state.tick);
  expect(send(amc, corr(800, 'right', 50, 'add', 0, 'adjust')).ok).toBe(true);
  untilSaid(amc, 'fdc', 'ready');
  expect(words(radioEvents(amc, shot + sec(660) - amc.state.tick))).toEqual([]); // past the stay, 준비 쏴 not sent
  expect(send(amc, FIRE).ok).toBe(true);
  const fired = untilSaid(amc, 'fdc', 'shot');
  const [late] = words([...fired, ...radioEvents(amc, 1)]);
  expect(late).toEqual({ type: 'radio', tick: tickOf(fired, 'shot'), utterance: DISPLACING }); // as soon as it is fired
}, 30_000); // about 1.5 s locally: two games of some 2,300 s and 700 s
