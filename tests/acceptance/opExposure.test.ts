// 관측소 노출과 적 포병 사격 (F-20의 관측소 쪽, M3-18, #123 규칙 2): through the simulation's public interface only.
import { expect, test } from 'vitest';
import { createSim, type Input, type MtoSlots, type PostEvent, type Sim, type SimEvent } from '@sim';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { COMBAT } from '@content/combat';
import { combatInit, init, START } from './init';
import { dist } from './enemy';
import { flatTerrain } from './terrain';
import { CALL_FFE, DESC_UNKNOWN, EOM, MOVE, POS, openRadio, radioEvents, send, toReady, untilSaid } from './mission';

const N = COMBAT.numbers;
const SCENARIO = { ...BASE_SCENARIO, units: [] };
const ROOM = flatTerrain({ n: 128 }); // 1.28 km: room to walk 150 m east of the post inside the 200 m margin
function game(mode: 'training' | 'standard' | 'combat', seed = 7): Sim {
  const sim = createSim({ ...(mode === 'combat' ? combatInit(seed, ROOM) : { ...init(seed, ROOM), mode }), scenario: SCENARIO });
  sim.step([START]);
  return sim;
}
/** `sim` with every step's inputs written down, to send the same script to a twin, and its 진지 변환 words. */
function recorded(sim: Sim): { sim: Sim; log: Input[][]; moved: SimEvent[] } {
  const log: Input[][] = [];
  const moved: SimEvent[] = [];
  const step: Sim['step'] = (i) => {
    log.push([...i]);
    const r = sim.step(i);
    moved.push(...displacement(r.events));
    return r;
  };
  return { log, moved, sim: { ...sim, state: sim.state, step } };
}

const RB_SHOT: Input = { a: 'readback', v: ['shot'] };
const RB_RC: Input = { a: 'readback', v: ['rounds_complete'] };
const rbMto = (m: MtoSlots): Input => ({ a: 'readback', v: ['mto', m.fuze, m.rounds, m.control, m.targetNumber] });
const mtoOf = (sim: Sim): MtoSlots => ({ ...sim.state.missions.at(-1)!.mto! });
const WRONG = (sim: Sim): Input => rbMto({ ...mtoOf(sim), rounds: mtoOf(sim).rounds + 1 });
const LASE: Input = { a: 'lase', v: [204, -220] }; // the opening aim, at the ground
const SKY: Input = { a: 'lase', v: [32000, 50] }; // nothing to reflect
const points = (sim: Sim) => sim.state.signature!.points;
const shellNotes = (events: readonly SimEvent[]) =>
  events.filter((e): e is PostEvent => e.type === 'post' && (e.what === 'ranging' || e.what === 'barrage' || e.what === 'lost'));

/** A wrong 사격지휘통보 readback (1 point), then 기러기's 정정 so the next one is taken. */
function wrongOnce(sim: Sim): void {
  expect(send(sim, WRONG(sim)).ok).toBe(true);
  untilSaid(sim, 'fdc', 'mto_correction');
}
/** Talks (wrong readbacks) until the count is `n`. */
function talkTo(sim: Sim, n: number): void {
  while (points(sim) < n) wrongOnce(sim);
  expect(points(sim)).toBe(n);
}
/** Runs `ticks` steps with no input; the enemy artillery's notes on the way. */
function watch(sim: Sim, ticks: number): PostEvent[] {
  const out: PostEvent[] = [];
  for (let k = 0; k < ticks && sim.state.phase !== 'ended'; k++) out.push(...shellNotes(sim.step([]).events));
  return out;
}
const sec = (s: number) => s * 20;
const displacement = (events: readonly SimEvent[]) =>
  events.filter((e) => e.type === 'radio' && (e.utterance.kind === 'displacing' || e.utterance.kind === 'displaced'));

/** A 효력사 mission whose 사격지휘통보 the observer reads back wrong to 39 points, then the 40th; the mission ended at
 * once and the post 150 m east: the rounds' notes, the place exposed and the tick of the 40th. */
function exposedAndMoved(sim: Sim): { at: number; place: { x: number; y: number }; notes: PostEvent[] } {
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_FFE);
  talkTo(sim, N.exposureLimit - 1);
  const place = { ...sim.state.signature!.place! };
  expect(watch(sim, sec(400))).toEqual([]); // 39: nothing happens
  expect(sim.state.artillery).toBeNull();
  const at = sim.state.tick;
  expect(send(sim, WRONG(sim)).ok).toBe(true); // the 40th
  expect(points(sim)).toBe(0);
  untilSaid(sim, 'fdc', 'mto_correction');
  for (const input of [rbMto(mtoOf(sim)), RB_SHOT, RB_RC, EOM('ineffective'), MOVE(place.x + 150, place.y)]) expect(send(sim, input).ok).toBe(true);
  expect(points(sim)).toBe(0); // five words, none counted until the enemy artillery is done
  return { at, place, notes: watch(sim, sec(400)) };
}

test('F-20: 관측소 노출 — 한 자리에서 40점이면 240초 뒤 시사탄, 90초 뒤 본사격 6발', () => {
  const sim = game('combat');
  const { at, place, notes } = exposedAndMoved(sim);
  const ranging = notes.filter((n) => n.what === 'ranging');
  const barrage = notes.filter((n) => n.what === 'barrage');
  expect(ranging.map((n) => n.tick)).toEqual([at + sec(240)]);
  expect(dist(ranging[0] as unknown as { x: number; y: number }, place)).toBeCloseTo(150, 6); // off the exposed place
  expect(barrage.map((n) => n.tick)).toEqual([0, 1, 2, 3, 4, 5].map((k) => at + sec(240 + 90 + 4 * k)));
  expect(sim.state.artillery).toBeNull(); // done: the count runs again
  expect(send(sim, LASE).ok).toBe(true);
  expect(points(sim)).toBe(N.laserExposure);
});

test('F-20: 100 m 밖에서 말하면 셈이 새로 시작되고, 본사격의 판정은 탄착점에서 지금의 관측소까지 40 m로 잰다', () => {
  // The restart: count at the post, walk 150 m, report the new place — the count starts again there from that word.
  const walker = game('combat');
  openRadio(walker);
  expect(send(walker, LASE).ok).toBe(true);
  const a = { ...walker.state.signature!.place! };
  expect(points(walker)).toBeGreaterThan(N.laserExposure); // 감명 양호 and the lase
  expect(send(walker, MOVE(a.x + 150, a.y)).ok).toBe(true);
  for (let k = 0; k < 20000 && walker.state.post.state !== 'ready'; k++) walker.step([]);
  expect(walker.state.post.state).toBe('ready');
  expect(send(walker, POS(4047, 3032)).ok).toBe(true); // 위치 보고: one word
  expect(points(walker)).toBe(N.radioExposure);
  expect(walker.state.signature!.place).toEqual({ x: walker.state.op.x, y: walker.state.op.y });
  expect(dist(walker.state.signature!.place!, a)).toBeCloseTo(150, 6);
  // The judgement: fixed seed and script (exposure, then 150 m east at once). Every barrage round fell more than 40 m
  // from the moved post, though some fell within 40 m of where it was exposed, and the 관측반 lives. (Seed 1: measured
  // from the exposed place instead, its 관측반 would be lost by the second round; seed 7 would survive both by its draws.)
  const sim = game('combat', 1);
  const { place, notes } = exposedAndMoved(sim);
  const rounds = notes.filter((n) => n.what === 'barrage') as unknown as { x: number; y: number }[];
  expect(rounds).toHaveLength(6);
  const now = sim.state.op;
  expect(dist(now, place)).toBeCloseTo(150, 6);
  for (const r of rounds) expect(dist(r, now)).toBeGreaterThan(40);
  expect(rounds.some((r) => dist(r, place) < 40)).toBe(true);
  expect(sim.state.observerLost).toBe(false);
  expect(notes.some((n) => n.what === 'lost')).toBe(false);
});

test('F-20: 훈련·표준에서는 노출도 진지 변환도 없고 발각 스트림을 더 뽑지 않는다', () => {
  const combat = recorded(game('combat'));
  exposedAndMoved(combat.sim);
  expect(combat.sim.state.rng.exp.count).toBeGreaterThan(0); // the ranging round's direction, the barrage's gaussians
  expect(combat.moved.map((e) => e.type === 'radio' && e.utterance.kind)).toEqual(['displacing']); // 600 s after the 효력사
  for (const mode of ['standard', 'training'] as const) {
    const sim = game(mode);
    const events = combat.log.flatMap((inputs) => sim.step(inputs).events);
    const notes = shellNotes(events);
    expect(notes, mode).toEqual([]);
    expect(sim.state.signature, mode).toBeNull();
    expect(sim.state.artillery, mode).toBeNull();
    expect(displacement(events), mode).toEqual([]);
    expect(sim.state.battery, mode).toBeNull();
    expect(sim.state.rng.exp.count, mode).toBe(0); // as now: no enemy to find the post, nothing else draws
  }
});

test('실전: 복창과 노출 — 받아들여진 복창은 맞든 틀리든 1점이고 무시된 복창은 세지 않는다', () => {
  const sim = game('combat');
  openRadio(sim);
  toReady(sim);
  // 하나발 떳다: in a combat game it does not go out by itself, so it counts once, when the player reads it back.
  untilSaid(sim, 'fdc', 'shot');
  let p = points(sim);
  radioEvents(sim, sec(5));
  expect(points(sim)).toBe(p);
  expect(send(sim, RB_SHOT).ok).toBe(true);
  expect(points(sim)).toBe(++p);
  expect(send(sim, RB_SHOT).ok).toBe(false);
  expect(points(sim)).toBe(p);
  wrongOnce(sim);
  expect(points(sim)).toBe(++p); // wrong: +1
  expect(send(sim, rbMto(mtoOf(sim))).ok).toBe(true);
  expect(points(sim)).toBe(++p); // right: +1
  expect(send(sim, rbMto(mtoOf(sim))).ok).toBe(false);
  expect(points(sim)).toBe(p); // nothing owed: ignored, +0
});

test('실전: 레이저와 노출 — 받아들여진 레이저는 2점이고 무시된 레이저는 세지 않는다', () => {
  const sim = game('combat');
  openRadio(sim);
  let p = points(sim);
  for (const [lase, hit] of [[LASE, true], [SKY, false], [LASE, true], [SKY, false], [LASE, true]] as const) {
    expect(send(sim, lase).ok).toBe(true);
    expect(sim.state.lases[0]!.range !== null).toBe(hit); // 반사 있음 and 반사 없음 alike
    expect(points(sim)).toBe((p += 2));
  }
  expect(send(sim, LASE).ok).toBe(false); // the sixth: over the 레이저 한도
  expect(points(sim)).toBe(p);
  // While the post moves, a lase is ignored and not counted (the 이동 신고 itself is one word).
  const moving = game('combat');
  expect(send(moving, MOVE(470, 320)).ok).toBe(true);
  const q = points(moving);
  expect(send(moving, SKY).ok).toBe(false);
  expect(points(moving)).toBe(q);
});
