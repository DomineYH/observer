import { expect, test } from 'vitest';
import { createSim, replay, validateReplay } from '@sim';
import type { Input } from '@sim';
import { CLEAR_WEATHER } from '@app/clearWeather';
import { createSession } from '@app/session';
import { fovOf, pxToMil, QUALITIES } from '@render/projection';
import { createAimControl } from '@ui/aim';
import { terrainColours } from '@render/shade';
import { createViewBuffers, renderView } from '@render/voxel';
import { BASE_SCENARIO } from '@content/scenario';
import { init, replayData, START } from './init';
import { flatTerrain } from './terrain';

const terrain = flatTerrain();
const colours = terrainColours(terrain, CLEAR_WEATHER);
const EYE = { x: 320, y: 320, z: 103.5 };

test('F-01: 육안 시야각', () => {
  for (const w of Object.values(QUALITIES))
    for (const bino of [false, true]) {
      const buf = createViewBuffers(w);
      const v = renderView(buf, terrain, colours, EYE, { h: 100, p: -20 }, bino, CLEAR_WEATHER);
      expect(buf.h).toBe((w * 9) / 16);
      expect((2 * Math.atan(w / 2 / v.focal) * 180) / Math.PI).toBeCloseTo(bino ? 7 : 60, 12);
      // The edge columns sit half the field of view off the line of sight.
      expect(pxToMil(-w / 2, v.focal)).toBeCloseTo(-fovOf(bino) / 2, 9);
      expect(pxToMil(w / 2, v.focal)).toBeCloseTo(fovOf(bino) / 2, 9);
      // Ground was drawn below the horizon: the bottom row isn't sky.
      expect(buf.pix32[(buf.h - 1) * w]).not.toBe(buf.pix32[0]);
    }
});

test('F-03: 조준과 쌍안경 입력', () => {
  const sim = createSim(init(5));
  const twin = createSim(init(5));
  expect(sim.state.aim).toEqual({ az: 204, el: -220 });
  expect(sim.state.bino).toBe(false);

  // Malformed values are ignored and change nothing.
  const bad: Input[] = [
    { a: 'cam', v: [64000, 0] },
    { a: 'cam', v: [-1, 0] },
    { a: 'cam', v: [0, 2001] },
    { a: 'cam', v: [1, 2, 3] },
    { a: 'cam', v: [1.5, 0] },
    { a: 'cam' },
    { a: 'bino', v: [2] },
    { a: 'bino' },
    { a: 'constructor', v: [] },
  ];
  expect(sim.step(bad).accepted).toEqual(bad.map(() => false));
  twin.step([]);
  expect(sim.hash()).toBe(twin.hash());

  // 조준 and 쌍안경 are accepted, read back from the state, and enter the state hash.
  expect(sim.step([{ a: 'cam', v: [1234, -50] }]).accepted).toEqual([true]);
  twin.step([]);
  expect(sim.state.aim).toEqual({ az: 1234, el: -50 });
  expect(sim.hash()).not.toBe(twin.hash());
  twin.step([{ a: 'cam', v: [1234, -50] }]);
  sim.step([]);
  expect(sim.hash()).toBe(twin.hash());
  expect(sim.step([{ a: 'bino', v: [1] }]).accepted).toEqual([true]);
  twin.step([]);
  expect(sim.state.bino).toBe(true);
  expect(sim.hash()).not.toBe(twin.hash());
  sim.step([{ a: 'bino', v: [0] }]);
  expect(sim.state.bino).toBe(false);
});

test('입력 기록: 받아들인 입력만 남긴다', () => {
  const { terrain: t, ...rest } = init(9);
  const sim = createSim({ ...rest, terrain: t });
  const session = createSession(sim);
  session.send(START);
  session.step();
  session.send({ a: 'cam', v: [500, 10] });
  session.send({ a: 'cam', v: [500, 9999] }); // out of range: ignored
  session.step();
  session.step();
  session.send({ a: 'zz' }); // unknown kind: ignored
  session.send({ a: 'bino', v: [1] });
  session.step();
  session.step();
  expect(session.log).toEqual([
    { t: 0, ...START },
    { t: 1, a: 'cam', v: [500, 10] },
    { t: 3, a: 'bino', v: [1] },
  ]);

  // The log replays with nothing ignored, to the same state.
  const data = replayData([...session.log], 5, 9);
  const checked = validateReplay(data);
  if (!checked.ok) throw new Error(checked.error);
  const r = replay(checked.data, t, BASE_SCENARIO);
  expect(r.ignored).toBe(0);
  const twin = createSim({ ...rest, terrain: t });
  for (let i = 0; i < 5; i++) twin.step(data.inputs.filter((x) => x.t === i));
  expect(twin.hash()).toBe(sim.hash());
  expect(r.record).toEqual(sim.record());
});

test('F-01: 화질은 결과를 바꾸지 않는다', () => {
  // The same player actions at each 화질; the view is drawn after every tick that had an action (drawing is the
  // costly part, and a frame between actions draws the same aim again).
  const play = (w: number) => {
    const sim = createSim(init(11));
    const session = createSession(sim);
    const aim = createAimControl(sim.state, session.send);
    const buf = createViewBuffers(w);
    const actions: (() => void)[] = [
      () => aim.key('ArrowRight', false),
      () => aim.key('ArrowUp', true),
      () => aim.drag(37, -12, 800),
      () => aim.toggleBino(),
      () => aim.key('ArrowLeft', true),
      () => aim.drag(-5, 3, 800),
      () => aim.key('ArrowDown', false),
      () => aim.toggleBino(),
    ];
    const hashes: string[] = [];
    for (let tick = 0; tick < 30; tick++) {
      const action = actions[tick % 4 === 0 ? tick / 4 : -1];
      action?.();
      session.step();
      if (action) renderView(buf, terrain, colours, EYE, aim.aim(), aim.bino(), CLEAR_WEATHER);
      hashes.push(sim.hash());
    }
    return { hashes, log: session.log };
  };
  const [medium, high, max] = Object.values(QUALITIES).map(play);
  // The actions really sent 조준 and 쌍안경 (the last two moves stay under 1 mil from the value sent).
  expect(medium!.log.map((i) => i.a)).toEqual(['cam', 'cam', 'cam', 'bino', 'cam', 'bino']);
  expect(high).toEqual(medium);
  expect(max).toEqual(medium);
});
