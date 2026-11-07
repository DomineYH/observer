import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim, type ImpactEvent, type RadioEvent, type Sim } from '@sim';
import { silentVoice } from '@adapters/mock/voice';
import { BASE_SCENARIO } from '@content/scenario';
import { init, START } from '../../tests/acceptance/init';
import { CALL_ADJUST, LOC, openRadio, started, toAdjust, toReady, untilImpact, untilSaid } from '../../tests/acceptance/mission';
import { RadioLog } from './RadioLog';
import { createSound } from './sound';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };

/** A sim whose every step's events go to a sound with a recording voice and recording effects. */
function listening(sim: Sim = started()) {
  const voice = silentVoice();
  const played: { kind: 'boom' | 'squelch'; tick: number; distance?: number }[] = [];
  const sound = createSound(
    voice,
    { boom: (distance) => void played.push({ kind: 'boom', tick: sim.state.tick, distance }), squelch: () => void played.push({ kind: 'squelch', tick: sim.state.tick }) },
    NAMES,
  );
  const impacts: ImpactEvent[] = [];
  const step = sim.step.bind(sim);
  sim.step = (inputs) => {
    const r = step(inputs);
    for (const e of r.events) if (e.type === 'impact') impacts.push(e);
    sound.hear(r.events, sim.state);
    return r;
  };
  return { sim, sound, voice, played, impacts };
}
const run = (sim: Sim, ticks: number) => {
  for (let k = 0; k < ticks; k++) sim.step([]);
};

test('F-10: 폭음 지연', () => {
  const { sim, played, impacts } = listening();
  openRadio(sim);
  toReady(sim);
  while (!impacts.length) sim.step([]);
  const impact = impacts[0]!;
  const op = sim.state.op;
  const distance = Math.hypot(impact.x - op.x, impact.y - op.y);
  // The round lands 6939 m from the post (with clear weather's 기상 잔차): 6939 ÷ 343 = 20.23 s, 405 ticks later the
  // 폭음 is heard, once.
  expect(Math.round(distance)).toBe(6939);
  run(sim, 404);
  expect(played.filter((p) => p.kind === 'boom')).toEqual([]);
  run(sim, 100);
  expect(played.filter((p) => p.kind === 'boom')).toEqual([{ kind: 'boom', tick: impact.tick + 405, distance }]);
});

test('F-28: 기러기 교신을 읽는다', () => {
  const { sim, sound, voice } = listening();
  sound.set({ voice: true });
  openRadio(sim);
  toReady(sim);
  // Each of 기러기's utterances once, in order, as its sentence; the observer's are not read.
  expect(voice.said).toEqual(
    [
      '갈매기, 여기는 기러기, 감명 보고, 이상.',
      '갈매기, 여기는 기러기, 조정, 좌표 송신바람, 이상.',
      '좌표 찰리호텔 넷칠둘공 삼하나오공, 이상.',
      '미상 표적, 포대 삼발, 잠깐대기.',
      '사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 하나공공하나, 잠깐대기.',
      '포대 사격준비 끝.',
    ].map((text) => ({ speaker: 'fdc', text })),
  );
});

test('F-28: 병기는 읽지 않는다', () => {
  const sim = createSim({ ...init(7), mode: 'training', scenario: { ...BASE_SCENARIO, units: [] } });
  sim.step([START]);
  const { sound, voice } = listening(sim);
  sound.set({ voice: true });
  const said: RadioEvent[] = [...openRadio(sim), ...toReady(sim)].filter((e) => e.utterance.speaker === 'fdc');
  // The training-mode log shows the numerals beside 기러기's words …
  const log = renderToStaticMarkup(<RadioLog lines={said} callsign={NAMES.callsign} gridLetters={NAMES.gridLetters} mode="training" />);
  expect(log).toContain('(1001)');
  expect(log).toContain('(4720)');
  // … the voice reads the words only.
  expect(voice.said.map((s) => s.text)).toContain('사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 하나공공하나, 잠깐대기.');
  expect(voice.said).toHaveLength(said.length);
  for (const { text } of voice.said) expect(text).not.toMatch(/[0-9()]/);
});

test('F-28: 음성 켬과 끔', () => {
  const { sim, sound, voice } = listening();
  // Off at first: 감명 보고 goes unread.
  openRadio(sim);
  expect(voice.said).toEqual([]);
  sound.set({ voice: true });
  sim.step([CALL_ADJUST]);
  untilSaid(sim, 'fdc', 'call_ack');
  expect(voice.said.map((s) => s.text)).toEqual(['갈매기, 여기는 기러기, 조정, 좌표 송신바람, 이상.']);
  // Off again: whatever is being read stops, and the next answer is not read.
  sound.set({ voice: false });
  expect(voice.stops).toBe(1);
  sim.step([LOC]);
  untilSaid(sim, 'fdc', 'location');
  expect(voice.said).toHaveLength(1);
  // Setting it off again while off stops nothing more.
  sound.set({ voice: false });
  expect(voice.stops).toBe(1);
});

test('F-28: 시뮬레이션에 영향 없음', () => {
  const { sim, sound, voice, played } = listening();
  sound.set({ voice: true, effects: true });
  // A twin without sound takes the same inputs on the same ticks.
  const twin = started();
  const step = sim.step.bind(sim);
  sim.step = (inputs) => {
    const r = step(inputs);
    twin.step(inputs);
    expect(sim.hash()).toBe(twin.hash());
    return r;
  };
  openRadio(sim);
  toReady(sim);
  toAdjust(sim);
  run(sim, 500);
  // It read, squelched and boomed, and the two games are the same.
  expect(voice.said.length).toBeGreaterThan(0);
  expect(played.some((p) => p.kind === 'boom')).toBe(true);
  expect(played.some((p) => p.kind === 'squelch')).toBe(true);
  expect(sim.record()).toEqual(twin.record());
});

test('F-10: 소리를 끄면 폭음과 스퀠치가 없다', () => {
  const { sim, sound, played } = listening();
  openRadio(sim);
  toReady(sim);
  expect(played.some((p) => p.kind === 'squelch')).toBe(true);
  const before = played.length;
  // Off before the round goes: its 떳다 and 탄착 lines are silent, and its 폭음 never comes.
  sound.set({ effects: false });
  const { impact, said } = untilImpact(sim);
  run(sim, 500);
  expect(said.length).toBeGreaterThan(0);
  expect(impact.tick).toBeGreaterThan(0);
  expect(played.slice(before)).toEqual([]);
});
