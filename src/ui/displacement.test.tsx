// 진지 변환 중의 표시 (M4-13, #183 Q5): the 입력기 reads the battery's state of a combat game driven through the
// simulation's public interface; the clock is the simulation's ticks.
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim, type Input, type Mode, type MtoSlots, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { combatInit, init, START } from '../../tests/acceptance/init';
import { answered, CALL_FFE, DESC_UNKNOWN, EOM, LOC, openRadio, radioEvents, send, toReady, untilSaid, untilTaken } from '../../tests/acceptance/mission';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { waitClock } from './clock';
import { Composer } from './Composer';

const sec = (s: number) => s * 20;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
const LINE = /포대 진지 변환 중 · 사격준비 끝까지 약 (\d+:\d\d)/;
/** The line as the 입력기 shows it for this game now: its m:ss, or null when it is not there. */
const shown = (sim: Sim) =>
  text(
    renderToStaticMarkup(
      <Composer stage={sim.state.radio.stage} live platoons={sim.state.platoons} names={{ callsign: '갈매기', gridLetters: 'CH' }} grid={flatTerrain().grid} mode={sim.state.mode} send={() => {}} state={sim.state} />,
    ),
  ).match(LINE)?.[1] ?? null;
/** A game with no enemy whose battery fired a 효력사 mission through to 임무끝: the stay counts from its first round. */
function fired(mode: Mode): { sim: Sim; first: number } {
  const sim = createSim({ ...(mode === 'combat' ? combatInit(7) : { ...init(7), mode }), scenario: { ...BASE_SCENARIO, units: [] } });
  sim.step([START]);
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_FFE);
  const rb = (v: Input['v']): Input => ({ a: 'readback', v });
  const m: MtoSlots | null = sim.state.missions.at(-1)!.mto;
  if (mode === 'combat') send(sim, rb(['mto', m!.fuze, m!.rounds, m!.control, m!.targetNumber]));
  const first = untilSaid(sim, 'fdc', 'shot').at(-1)!.tick;
  if (mode === 'combat') send(sim, rb(['shot']));
  untilSaid(sim, 'fdc', 'rounds_complete');
  if (mode === 'combat') send(sim, rb(['rounds_complete']));
  untilTaken(sim, EOM('ineffective'));
  return { sim, first };
}

test('실전: 진지 변환 중 — 사격준비 끝까지 남은 시간이 서고 줄어들며 끝나면 사라지고 훈련·표준에는 서지 않는다', () => {
  expect([waitClock(sec(325)), waitClock(sec(324) + 1), waitClock(sec(60)), waitClock(1), waitClock(0)]).toEqual(['5:25', '5:25', '1:00', '0:01', '0:00']);
  const { sim, first } = fired('combat');
  // Before the 체류 한도 is out: nothing.
  radioEvents(sim, first + sec(600) - 1 - sim.state.tick);
  expect(shown(sim)).toBeNull();
  // 진지 변환 starts (기본 포: 1300 s × 0.25 = 325 s): the whole wait, at an idle radio too.
  radioEvents(sim, 1);
  expect([sim.state.radio.stage, shown(sim)]).toEqual(['idle', '5:25']);
  // It runs down with the game's clock.
  radioEvents(sim, sec(25));
  expect(shown(sim)).toBe('5:00');
  // A mission sent meanwhile: its 사격준비 끝 waits for the end, and the line is there at every stage on the way.
  for (const [input, a] of [[CALL_FFE, 'call'], [LOC, 'loc']] as const) {
    expect(send(sim, input).ok).toBe(true);
    answered(sim, a);
  }
  expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
  radioEvents(sim, sec(60)); // past the time its 사격준비 끝 would have come
  const left = sim.state.battery!.until - sim.state.tick;
  expect(sim.state.radio.stage).not.toBe('idle');
  expect(shown(sim)).toBe(waitClock(left));
  expect(left).toBeLessThan(sec(300));
  radioEvents(sim, left - 1);
  expect(shown(sim)).toBe('0:01');
  // Over: 기러기 says so and the line is gone.
  const said = radioEvents(sim, 1);
  expect(said.map((e) => e.utterance.kind)).toEqual(['displaced', 'ready']); // the held 사격준비 끝 comes with it
  expect(shown(sim)).toBeNull();
  // 훈련·표준: the battery never displaces, however long after its first round.
  for (const mode of ['training', 'standard'] as const) {
    const other = fired(mode);
    radioEvents(other.sim, other.first + sec(700) - other.sim.state.tick);
    expect([other.sim.state.battery, shown(other.sim)], mode).toEqual([null, null]);
  }
});
