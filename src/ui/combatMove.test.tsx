// 실전의 임무 중 관측소 이동, the screen (M4-11, #182 Q9): the panels read a combat game driven through the simulation's
// public interface. The tests have no DOM: a press is the button's own handler.
import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim, type Input, type Mode, type MtoSlots, type Sim } from '@sim';
import { COMBAT } from '@content/combat';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { combatInit, init, START } from '../../tests/acceptance/init';
import { answered, CALL_ADJUST, CALL_FFE, corr, DESC_UNKNOWN, EOM, LOC, MOVE, openRadio, send, untilImpact } from '../../tests/acceptance/mission';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { CorrectionForm } from './CorrectionForm';
import { MoveTo } from './MapPanel';

const SCENARIO = { ...BASE_SCENARIO, units: [] };
const TERRAIN = flatTerrain();
const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const TO = { x: 440, y: 440 }; // 170 m off: about 140 s on foot
const text = (html: string) => html.replace(/<[^>]*>/g, '');
/** A started game with its radio open and a mission sent up to the 표적성질. */
function mission(mode: Mode, call: Input = CALL_ADJUST): Sim {
  const sim = createSim({ ...(mode === 'combat' ? combatInit(7) : { ...init(7), mode }), scenario: SCENARIO });
  sim.step([START]);
  openRadio(sim);
  for (const [input, a] of [[call, 'call'], [LOC, 'loc']] as const) {
    send(sim, input);
    answered(sim, a);
  }
  expect(send(sim, DESC_UNKNOWN).ok).toBe(true);
  return sim;
}
const until = (sim: Sim, done: () => boolean) => {
  for (let k = 0; k < 8000 && !done(); k++) sim.step([]);
  expect(done()).toBe(true);
};
const owed = (sim: Sim) => sim.state.missions.at(-1)!.readback;
const rbMto = (sim: Sim): Input => {
  const m: MtoSlots = sim.state.missions.at(-1)!.mto!;
  return { a: 'readback', v: ['mto', m.fuze, m.rounds, m.control, m.targetNumber] };
};
/** The 지도 패널's move line for the 좌표자 at TO, as the panel draws it for this game. */
const moveLine = (sim: Sim, sent: Input[] = []) =>
  MoveTo({ terrain: TERRAIN, state: sim.state, to: TO, send: (i) => void sent.push(i), inMission: sim.state.mode === 'combat' && COMBAT.numbers.moveInMission === 1 }) as ReactElement;
/** The move button pressed, if the line has one: its own handler. */
function press(line: ReactElement): boolean {
  const find = (n: unknown): ReactElement | undefined => {
    if (Array.isArray(n)) return n.map(find).find(Boolean);
    if (!isValidElement(n)) return undefined;
    const { children, onClick } = n.props as { children?: unknown; onClick?: () => void };
    return n.type === 'button' && onClick ? n : find(children);
  };
  const button = find(line);
  (button?.props as { onClick: () => void } | undefined)?.onClick();
  return !!button;
}
const composer = (sim: Sim) =>
  renderToStaticMarkup(<Composer stage={sim.state.radio.stage} live platoons={sim.state.platoons} names={NAMES} grid={TERRAIN.grid} mode={sim.state.mode} send={() => {}} state={sim.state} />);
const sendable = (html: string) => [...html.matchAll(/<button type="button"( disabled="")?>송신<\/button>/g)].map((m) => !m[1]);
const WALKING = '이동 중에는 수정을 보낼 수 없습니다';

test('실전: 임무 중 관측소 이동 — 화면: 임무 중에도 여기로 관측소 이동이 눌리고 훈련·표준은 안내문 그대로다', () => {
  // 훈련·표준: the mission holds the post, with the words as before.
  for (const mode of ['training', 'standard'] as const) {
    const sim = mission(mode);
    const line = moveLine(sim);
    expect(text(renderToStaticMarkup(line)), mode).toBe('이동 불가: 사격 임무 중에는 이동할 수 없습니다. 임무끝을 먼저 보내십시오.');
    expect(press(line), mode).toBe(false);
  }
  // 실전: the button is there, and what it sends the simulation takes.
  const sim = mission('combat');
  const sent: Input[] = [];
  const line = moveLine(sim, sent);
  expect(text(renderToStaticMarkup(line))).toMatch(/^여기로 관측소 이동 · 170 m · 약 \d\d:\d\d$/);
  expect(press(line)).toBe(true);
  expect(sent).toEqual([MOVE(TO.x, TO.y)]);
  expect(send(sim, sent[0]!).ok).toBe(true);
  // On the way the other refusals stand, in 실전 too.
  expect(text(renderToStaticMarkup(moveLine(sim)))).toBe('이동 불가: 이미 이동 중입니다.');
});

test('실전: 임무 중 관측소 이동 — 화면: 걷는 동안 수정의 송신이 눌리지 않고 도착하면 방향 칸이 빈다', () => {
  const sim = mission('combat');
  // The first round, read back, and the mission's first correction with its 방향.
  until(sim, () => !!owed(sim)?.mto);
  send(sim, rbMto(sim));
  untilImpact(sim);
  until(sim, () => sim.state.radio.stage === 'adjust');
  send(sim, { a: 'readback', v: ['shot'] });
  expect(send(sim, corr(800, 'right', 60, 'drop', 200, 'adjust')).ok).toBe(true);
  expect(send(sim, MOVE(TO.x, TO.y)).ok).toBe(true);
  untilImpact(sim);
  until(sim, () => sim.state.radio.stage === 'adjust');
  send(sim, { a: 'readback', v: ['shot'] });
  // Walking: the form is there with the 방향 it sent, its 송신 cannot be pressed, and the screen says why.
  expect(sim.state.post.state).toBe('moving');
  const walking = composer(sim);
  expect(text(walking)).toContain(WALKING);
  expect(text(walking)).toContain('방향 0800 밀 (송신함)');
  expect(sendable(walking)).toEqual([false]);
  // Arrived: no words about walking, the 방향 field is back and empty, and 송신 waits for a 방향.
  until(sim, () => sim.state.post.state !== 'moving');
  const arrived = composer(sim);
  expect(text(arrived)).not.toContain(WALKING);
  expect(arrived).toContain('방향 <input inputMode="numeric" maxLength="4" size="4" value=""/> 밀');
  expect(text(arrived)).toContain('방향(밀)을 먼저 입력');
  expect(sendable(arrived)).toEqual([false]);
  // With a 방향 put in, the same form can be sent, and the simulation takes that correction.
  const filled = renderToStaticMarkup(<CorrectionForm sent={sim.state.missions.at(-1)!.direction} help={null} prefill="1450" names={NAMES} mode="combat" send={() => {}} />);
  expect(sendable(filled)).toEqual([true]);
  expect(send(sim, corr(1450, 'left', 0, 'drop', 0, 'adjust')).ok).toBe(true);
  // 훈련·표준 never show the words: a mission there holds the post.
  expect(text(composer(mission('standard')))).not.toContain(WALKING);
});

test('실전: 임무 중 관측소 이동 — 화면: 걷는 동안에도 임무끝은 나가고 위치 보고 양식은 임무가 끝난 뒤에 뜬다', () => {
  // 바로 효력사, the post set off for a place 20 m away: there and set up before the 효력사 is over.
  const sim = mission('combat', CALL_FFE);
  expect(send(sim, MOVE(340, 320)).ok).toBe(true);
  until(sim, () => !!owed(sim)?.mto);
  send(sim, rbMto(sim));
  until(sim, () => sim.state.radio.stage === 'effect' && !!owed(sim)?.rounds_complete && sim.state.post.state === 'ready');
  for (const kind of ['shot', 'rounds_complete']) send(sim, { a: 'readback', v: [kind] });
  // The report is owed and the post set up, but the mission is not over: no 위치 보고 form yet.
  expect([sim.state.reportDue, sim.state.post.state]).toEqual([true, 'ready']);
  const effect = composer(sim);
  expect(effect).not.toContain('aria-label="위치 보고"');
  expect(sendable(effect)).toEqual([true]); // 임무끝
  expect(send(sim, EOM('ineffective')).ok).toBe(true);
  const after = composer(sim);
  expect(after).toContain('<section aria-label="위치 보고">');
  expect(text(after)).not.toContain('경고명령'); // no call before the report or its skip, as before

  // Still walking when the 효력사 is over: the words stand, and 임무끝 (the form's first choice) can be sent.
  const far = mission('combat', CALL_FFE);
  expect(send(far, MOVE(TO.x, TO.y)).ok).toBe(true);
  until(far, () => !!owed(far)?.mto);
  send(far, rbMto(far));
  until(far, () => far.state.radio.stage === 'effect' && !!owed(far)?.rounds_complete);
  for (const kind of ['shot', 'rounds_complete']) send(far, { a: 'readback', v: [kind] });
  expect(far.state.post.state).toBe('moving');
  expect(text(composer(far))).toContain(WALKING);
  expect(sendable(composer(far))).toEqual([true]);
  expect(send(far, EOM('ineffective')).ok).toBe(true);
});
