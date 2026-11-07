// 효력사 (#29): the battery's six guns fire for effect, straight from the call or after a correction, and 접근신관 rounds
// burst in the air. Public interface only: create, step, events, read-only state.
import { describe, expect, test } from 'vitest';
import { fromGrid, type ImpactEvent, type Input, type RadioEvent, type Sim, type SimEvent } from '@sim';
import { radioSentence, spoken } from '@ui/radio/sentence';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@app/clearWeather';
import { drawEffects } from '@render/effects';
import { focalOf, MIL, project, type ViewGeometry } from '@render/projection';
import { createViewBuffers } from '@render/voxel';
import { CALL_ADJUST, CALL_FFE, corr, desc, FIRE, LOC, LOC_CLEAR, openRadio, send, started, toAdjust, toReady } from './mission';
import { START } from './init';
import { flatTerrain } from './terrain';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const opened = (seed = 7): Sim => {
  const sim = started(seed);
  openRadio(sim);
  return sim;
};
const isRadio = (e: SimEvent): e is RadioEvent => e.type === 'radio';
const isImpact = (e: SimEvent): e is ImpactEvent => e.type === 'impact';
const said = (e: RadioEvent) => [e.utterance.speaker, e.utterance.kind, e.utterance.ending];
const saying = (speaker: string, kind: string) => (e: SimEvent) => isRadio(e) && e.utterance.speaker === speaker && e.utterance.kind === kind;

/** Steps with no input until `done` holds for an event (at most `limit` ticks); returns every event up to it. */
function until(sim: Sim, done: (e: SimEvent) => boolean, limit = 3000): SimEvent[] {
  const out: SimEvent[] = [];
  for (let k = 0; k < limit; k++) {
    const events = sim.step([]).events;
    out.push(...events);
    if (events.some(done)) return out;
  }
  throw new Error(`not seen in ${limit} ticks`);
}
const quiet = (sim: Sim, ticks: number) => {
  const out: SimEvent[] = [];
  for (let k = 0; k < ticks; k++) out.push(...sim.step([]).events);
  return out;
};
const within = (d: number, lo: number, hi: number, what: string) => expect(d >= lo && d <= hi, `${what}: ${d} in ${lo}–${hi}`).toBe(true);

/** The rounds per gun 기러기 announced in the 사격지휘통보 (it may fire one fewer than asked). */
const roundsOf = (events: readonly SimEvent[]) => {
  const mto = events.filter(isRadio).find((e) => e.utterance.kind === 'mto')!.utterance;
  return mto.kind === 'mto' ? mto.slots.rounds : 0;
};

/** From 하나발 떳다 on, everything up to 마감탄 떳다's readback and 60 s more: by then every round has landed. */
function volley(sim: Sim) {
  const events = until(sim, saying('observer', 'rounds_complete'));
  events.push(...quiet(sim, 1200));
  return events;
}

/** Each gun's k-th rounds land together: the impacts in groups of six, every group within the 2.2 s jitter, 9 s apart. */
function expectVolleys(impacts: readonly ImpactEvent[], rounds: number) {
  expect(impacts).toHaveLength(6 * rounds);
  for (let k = 0; k < rounds; k++) {
    const g = impacts.slice(6 * k, 6 * k + 6).map((e) => e.tick);
    within(g.at(-1)! - g[0]!, 0, 45, `volley ${k} spread`);
    if (k > 0) within(g[0]! - impacts[0]!.tick, 180 * k - 45, 180 * k + 45, `volley ${k} after the first`);
  }
}

/** The line of fire at the sent grid: impacts spread across it like the battery's W (120 m) and around the aim. */
function expectSheaf(impacts: readonly ImpactEvent[]) {
  const [, e, n] = LOC.v as [string, number, number];
  const aim = fromGrid(e, n, flatTerrain().grid);
  const g = { x: aim.x - BASE_SCENARIO.battery.x, y: aim.y - BASE_SCENARIO.battery.y };
  const d = Math.hypot(g.x, g.y);
  const across = impacts.map((i) => ((i.x - aim.x) * g.y - (i.y - aim.y) * g.x) / d);
  expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(90);
  for (const i of impacts) expect(Math.hypot(i.x - aim.x, i.y - aim.y)).toBeLessThan(250); // bias ≤ 90 m + sheaf + 공산오차
}

describe('F-07: 바로 효력사', () => {
  const D = desc(2, 'quick', 'ready', 0, 'unknown');

  test('효력사 호출이면 수정탄 없이 포대가 효력사를 쏘고 마감탄 떳다가 온다', () => {
    const sim = opened();
    const before = toReady(sim, D, CALL_FFE);
    const rounds = roundsOf(before);
    const ready = before.at(-1)!;
    expect(ready.utterance).toEqual({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: { fuze: 'quick' } });
    expect(spoken(radioSentence(ready.utterance, NAMES))).toBe('순발신관 사격준비 끝.');

    const events = volley(sim);
    const talk = events.filter(isRadio);
    expect(talk.map(said)).toEqual([
      ['fdc', 'shot', 'over'],
      ['observer', 'shot', 'wait'],
      ['fdc', 'rounds_complete', 'over'],
      ['observer', 'rounds_complete', 'wait'],
    ]);
    const [shot, readback, complete, completeBack] = talk;
    expect(shot!.tick - ready.tick).toBe(30); // 준비되는 대로: 1.5 s after 사격준비 끝
    expect(readback!.tick - shot!.tick).toBe(24);
    // 마감탄 떳다 2.3 s after the last gun fired: the last round goes 9 s per round after the first, + up to 2.2 s.
    within(complete!.tick - shot!.tick, Math.ceil(((rounds - 1) * 9 + 2.3) * 20), Math.ceil(((rounds - 1) * 9 + 4.5) * 20), '마감탄 떳다');
    expect(spoken(radioSentence(complete!.utterance, NAMES))).toBe('마감탄 떳다, 이상.');
    expect(completeBack!.tick - complete!.tick).toBe(24);

    // No adjusting round: every impact is part of the battery's volleys, each a quick-fuze round.
    const impacts = events.filter(isImpact);
    expectVolleys(impacts, rounds);
    expectSheaf(impacts);
    expect(impacts.every((i) => i.fuze === 'quick')).toBe(true);
    expect(impacts[0]!.tick).toBeGreaterThan(shot!.tick);
  });

  test('효력사 뒤에는 수정도 준비 쏴도 받지 않는다', () => {
    const sim = opened();
    const twin = opened();
    toReady(sim, D, CALL_FFE);
    toReady(twin, D, CALL_FFE);
    volley(sim);
    volley(twin);
    const dir = 800;
    for (const input of [corr(dir, 'right', 50, 'add', 0, 'ffe'), corr('right', 50, 'add', 0, 'adjust'), FIRE] as Input[]) {
      expect(send(sim, input).ok).toBe(false);
      twin.step([]);
      expect(sim.hash()).toBe(twin.hash());
    }
  });

  test('지명사 효력사는 준비 쏴를 기다린다', () => {
    const sim = opened();
    const before = toReady(sim, desc(1, 'none', 'amc', 0, 'unknown'), CALL_FFE);
    expect(quiet(sim, 400)).toEqual([]); // 기러기 waits
    const fire = send(sim, FIRE);
    expect(fire.ok).toBe(true);
    const events = volley(sim);
    const shot = events.find(saying('fdc', 'shot'))!;
    within(shot.tick - fire.events[0]!.tick, 20, 40, '준비 쏴 → 하나발 떳다');
    expectVolleys(events.filter(isImpact), roundsOf(before));
  });
});

/** The 방향 from the observation post to the sent grid, mils. */
function trueDirection(): number {
  const [, e, n] = LOC.v as [string, number, number];
  const aim = fromGrid(e, n, flatTerrain().grid);
  const [ox, oy] = START.v as [number, number];
  return Math.round(((Math.atan2(aim.x - ox, aim.y - oy) * 3200) / Math.PI + 6400) % 6400);
}

describe('F-07: 수정 뒤 효력사', () => {
  test('수정에 효력사를 붙이면 신관 사격준비 끝 뒤 포대가 옮긴 조준점에 효력사를 쏜다', () => {
    const dir = trueDirection();
    const sim = opened();
    const before = toReady(sim, desc(3, 'quick', 'ready', 0, 'unknown'));
    const rounds = roundsOf(before);
    const first = toAdjust(sim);

    const sent = send(sim, corr(dir, 'right', 100, 'add', 0, 'ffe'));
    expect(sent.ok).toBe(true);
    const t0 = sent.events[0]!.tick - 1;
    expect(spoken(radioSentence(sent.events[0]!.utterance, NAMES))).toMatch(/, 우로 하나백, 효력사, 이상\.$/);

    const replies = until(sim, saying('fdc', 'ready')).filter(isRadio);
    expect(replies.map(said)).toEqual([
      ['fdc', 'correction', 'wait'],
      ['fdc', 'ready', 'none'],
    ]);
    const [readback, ready] = replies;
    expect(spoken(radioSentence(readback!.utterance, NAMES))).toMatch(/, 효력사, 잠깐대기\.$/);
    expect(ready!.utterance).toEqual({ speaker: 'fdc', ending: 'none', kind: 'ready', slots: { fuze: 'quick' } });
    expect(spoken(radioSentence(ready!.utterance, NAMES))).toBe('순발신관 사격준비 끝.');
    within(ready!.tick - t0, 280, 440, '사격준비 끝 after the correction'); // 14–22 s

    const events = volley(sim);
    expect(events.filter(isRadio).map(said)).toEqual([
      ['fdc', 'shot', 'over'],
      ['observer', 'shot', 'wait'],
      ['fdc', 'rounds_complete', 'over'],
      ['observer', 'rounds_complete', 'wait'],
    ]);
    const impacts = events.filter(isImpact);
    expectVolleys(impacts, rounds);
    // The volley's centre is the adjusting round moved 100 m right along the 방향 (± its 공산오차 and the sheaf's).
    const a = (dir * Math.PI) / 3200;
    const want = { x: first.x + 100 * Math.cos(a), y: first.y - 100 * Math.sin(a) };
    const mean = { x: impacts.reduce((t, i) => t + i.x, 0) / impacts.length, y: impacts.reduce((t, i) => t + i.y, 0) / impacts.length };
    expect(Math.hypot(mean.x - want.x, mean.y - want.y)).toBeLessThan(40);
    // The mission is past adjusting: another correction is not taken.
    expect(send(sim, corr('right', 50, 'add', 0, 'adjust')).ok).toBe(false);
  });
});

describe('F-09: 접근신관', () => {
  const VT = desc(1, 'vt', 'ready', 0, 'unknown');
  const W = 640;
  const EYE = { x: 320, y: 320, z: 103.5 }; // the post at the middle of the flat test terrain (ground 100 m)
  const view = (sim: Sim, at: { x: number; y: number }): ViewGeometry => ({
    eye: EYE,
    h: Math.atan2(at.x - EYE.x, at.y - EYE.y) * MIL,
    focal: focalOf(W, sim.state.bino),
    cx: W / 2,
    hor: (W * 9) / 32,
  });
  /** The row the burst's flash is centred on: the mean row of the flash-bright pixels of the effects drawn alone. */
  const flashRow = (sim: Sim, v: ViewGeometry) => {
    const buf = createViewBuffers(W);
    drawEffects(buf, v, sim.state, CLEAR_WEATHER);
    let n = 0;
    let rows = 0;
    for (let i = 0; i < buf.pix.length; i += 4)
      if (buf.pix[i]! > 220 && buf.pix[i + 2]! > 120) {
        n++;
        rows += Math.floor(i / 4 / buf.w) + 0.5;
      }
    expect(n, 'flash pixels').toBeGreaterThan(0);
    return rows / n;
  };
  /** The first impact of a mission sent with `call` and `d` to the grid 686 m from the post (just outside 위험근접, so a
   * 바로 효력사 stays one), one tick after it lands. */
  const firstBurst = (call: Input, d: Input) => {
    const sim = opened();
    toReady(sim, d, call, LOC_CLEAR);
    const impact = until(sim, isImpact).find(isImpact)!;
    return { sim, impact };
  };

  test('접근신관 효력사는 공중 파열로 알려지고 수정탄은 순발이다', () => {
    const sim = opened();
    const before = toReady(sim, VT, CALL_FFE);
    expect(spoken(radioSentence(before.at(-1)!.utterance, NAMES))).toBe('접근신관 사격준비 끝.');
    const impacts = volley(sim).filter(isImpact);
    expect(impacts).toHaveLength(6 * roundsOf(before));
    expect(impacts.every((i) => i.fuze === 'vt')).toBe(true);

    // The same request on an adjusting mission: the adjusting round is quick.
    const adj = firstBurst(CALL_ADJUST, VT);
    expect(adj.impact.fuze).toBe('quick');
  });

  test('접근신관의 섬광은 지면 7 m 위에서, 순발은 지면에서 터진다', () => {
    const air = firstBurst(CALL_FFE, VT);
    const v = view(air.sim, air.impact);
    const at = (z: number) => project(v, { x: air.impact.x, y: air.impact.y, z })!.sy;
    expect(Math.abs(at(107) - at(100))).toBeGreaterThan(4); // the two heights are rows apart at this range
    expect(Math.abs(flashRow(air.sim, v) - at(107))).toBeLessThan(1.5);

    const ground = firstBurst(CALL_ADJUST, desc(1, 'quick', 'ready', 0, 'unknown'));
    const g = view(ground.sim, ground.impact);
    expect(Math.abs(flashRow(ground.sim, g) - project(g, { x: ground.impact.x, y: ground.impact.y, z: 100 })!.sy)).toBeLessThan(1.5);
  });
});
