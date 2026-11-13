import { expect, test } from 'vitest';
import { COVER, createSim, replay, validateReplay } from '@sim';
import type { Input } from '@sim';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { mockTerrain } from '@adapters/mock/terrain';
import { createSession } from '@app/session';
import { fovOf, pxToMil, QUALITIES } from '@render/projection';
import { createAimControl } from '@ui/aim';
import { startInput } from '@ui/prep';
import { atmosphere, fbm, terrainColours } from '@render/shade';
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
  // The same player actions at each 화질, from 작전 개시 on, so deployment, movement, 보임 and 첩보 all run; the view
  // is drawn after every tick that had an action (drawing is the costly part, and a frame between actions draws the
  // same aim again). The full-size flat terrain keeps the enemy on the map, in binocular range of the planned post.
  const big = flatTerrain({ n: 800 });
  const bigColours = terrainColours(big, CLEAR_WEATHER);
  const eye = { ...BASE_SCENARIO.plannedOp, z: EYE.z };
  const play = (w: number) => {
    const sim = createSim(init(11, big));
    const session = createSession(sim);
    const aim = createAimControl(sim.state, session.send);
    const buf = createViewBuffers(w);
    const actions: (() => void)[] = [
      () => session.send(startInput(sim.state, session.queued)),
      () => aim.toggleBino(),
      () => aim.key('ArrowRight', false),
      () => aim.key('ArrowUp', true),
      () => aim.drag(37, -12, 800),
      () => aim.key('ArrowLeft', true),
      () => aim.drag(-5, 3, 800),
      () => aim.key('ArrowDown', false),
      () => aim.toggleBino(),
    ];
    const hashes: string[] = [];
    let seen = 0;
    for (let tick = 0; tick < 40; tick++) {
      const action = actions[tick % 4 === 0 ? tick / 4 : -1];
      action?.();
      session.step();
      if (action) renderView(buf, big, bigColours, eye, aim.aim(), aim.bino(), CLEAR_WEATHER);
      hashes.push(sim.hash());
      seen = Math.max(seen, sim.state.platoons.flatMap((p) => p.members).filter((m) => m.vis).length);
    }
    return { hashes, log: session.log, phase: sim.state.phase, tick: sim.state.tick, seen };
  };
  const [medium, high, max] = Object.values(QUALITIES).map(play);
  // The operation really ran, and the binoculars saw enemy members.
  expect(medium!.phase).toBe('live');
  expect(medium!.tick).toBeGreaterThan(0);
  expect(medium!.seen).toBeGreaterThan(0);
  // The actions really sent 작전 개시, 조준 and 쌍안경 (the last two moves stay under 1 mil from the value sent).
  expect(medium!.log.map((i) => i.a)).toEqual(['start', 'bino', 'cam', 'cam', 'cam', 'cam', 'bino']);
  expect(high).toEqual(medium);
  expect(max).toEqual(medium);
}, 30000);

// 안개 띠 (#76): with `edge: 'veil'` the ground outside the square fades to the fog colour over 600 m.
const fnv = (a: Uint32Array) => {
  let h = 0x811c9dc5;
  for (const v of a) h = Math.imul(h ^ v, 0x01000193) >>> 0;
  return h.toString(16);
};

test('안개 띠: mirror인 mock 화면은 그대로', async () => {
  const mock = await mockTerrain.load(20261106);
  expect(mock.edge).toBe('mirror');
  const mockColours = terrainColours(mock, CLEAR_WEATHER);
  // From 600 m inside the south edge, looking south across it (육안 and 쌍안경): the mirrored ground fills the view.
  const eye = { x: 5120, y: 600, z: 0 };
  eye.z = mock.ground[60 * mock.n + 512]! + 3.5;
  const frames = [false, true].map((bino) => {
    const buf = createViewBuffers(480);
    renderView(buf, mock, mockColours, eye, { h: 3200, p: -15 }, bino, CLEAR_WEATHER);
    return fnv(buf.pix32);
  });
  // Taken from the renderer before the 안개 띠 existed.
  expect(frames).toEqual(['486aed15', '119cf875']);
}, 30000);

test('안개 띠: veil이면 정사각 밖 600 m부터 안개색', () => {
  // A flat 1 280 m square; the drawn ground ends at its last cell row, y = 1 270 m. From (640, 1000) looking due north
  // through 쌍안경, the centre column reads the ground at y = 1000 + distance.
  const veiled = { ...flatTerrain({ n: 128 }), edge: 'veil' as const };
  const fog = atmosphere(CLEAR_WEATHER).fog;
  const centre = (t: typeof veiled | ReturnType<typeof flatTerrain>) => {
    const buf = createViewBuffers(480);
    renderView(buf, t, terrainColours(t, CLEAR_WEATHER), { x: 640, y: 1000, z: 103.5 }, { h: 0, p: -30 }, true, CLEAR_WEATHER);
    const rows: { out: number; fogged: boolean }[] = [];
    for (let y = 0; y < buf.h; y++) {
      const i = y * buf.w + buf.w / 2;
      if (buf.dbuf[i] === Infinity) continue;
      const o = i * 4;
      // Within the dot look's dither of the fog colour.
      const fogged = [0, 1, 2].every((ch) => Math.abs(buf.pix[o + ch]! - fog[ch]!) <= 16);
      rows.push({ out: 1000 + buf.dbuf[i]! - 1270, fogged });
    }
    return rows;
  };
  const rows = centre(veiled);
  const far = rows.filter((r) => r.out >= 600);
  const inside = rows.filter((r) => r.out < 0);
  expect(far.length).toBeGreaterThan(5);
  expect(inside.length).toBeGreaterThan(5);
  expect(far.every((r) => r.fogged)).toBe(true);
  expect(inside.some((r) => r.fogged)).toBe(false);
  // The same ground mirrored is not fog.
  expect(centre(flatTerrain({ n: 128 })).some((r) => r.out >= 600 && r.fogged)).toBe(false);
});

test('관측 화면: 11월 팔레트 7종', () => {
  // The demo's cover colours (genTerrain): every cell is one of its class's colours times the light it got, and each
  // colour shows somewhere. Flat ground in seven bands of 36 columns, wide enough for the forest and field patterns.
  const palette: Record<(typeof COVER)[number], number[][]> = {
    open: [[152, 138, 84]],
    field: [[182, 162, 104], [164, 150, 92], [148, 126, 78]],
    forest: [[56, 76, 44], [126, 90, 46], [152, 108, 48]],
    water: [[78, 104, 122]],
    road: [[160, 150, 128]],
    village: [[176, 164, 128], [152, 138, 84], [182, 162, 104], [164, 150, 92], [148, 126, 78]], // roofless: open or field (demo 283)
    building: [[150, 72, 56], [72, 92, 132], [122, 122, 116], [82, 112, 92], [172, 104, 62], [196, 190, 178]],
  };
  const t = flatTerrain({ n: 256 });
  for (let k = 0; k < t.cover.length; k++) t.cover[k] = Math.min(6, Math.floor((k % 256) / 36));
  const { r, g, b, light } = terrainColours(t, CLEAR_WEATHER);
  const seen = new Set<string>();
  for (let k = 0; k < t.cover.length; k++) {
    const c = COVER[t.cover[k]!]!;
    // The channel is the colour × light truncated (light is kept as float32, hence the slack).
    const fit = palette[c].find((rgb) => [r[k]!, g[k]!, b[k]!].every((v, ch) => Math.abs(v + 0.5 - rgb[ch]! * light[k]!) <= 0.5001));
    if (!fit) throw new Error(`${c} cell ${k}: ${[r[k], g[k], b[k]]} at light ${light[k]}`);
    seen.add(`${c} ${fit}`);
  }
  expect(seen.size).toBe(Object.values(palette).flat().length);
});

// The demo's own noise, copied verbatim from PRD/OBSERVER_demo_v0.2.html lines 213–215, as the reference.
function demoHash(ix: number, iy: number, s: number) {let h=(Math.imul(ix,374761393)+Math.imul(iy,668265263)+Math.imul(s,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function demoVnoise(x: number, y: number, s: number) {const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=demoHash(ix,iy,s),b=demoHash(ix+1,iy,s),c=demoHash(ix,iy+1,s),d=demoHash(ix+1,iy+1,s);return(a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy)*2-1}
function demoFbm(x: number, y: number, s: number, o: number) {let v=0,a=.5,f=1;for(let i=0;i<o;i++){v+=a*demoVnoise(x*f,y*f,s+i*17);a*=.5;f*=2.03}return v}

test('관측 화면: 데모 fbm', () => {
  const points: [number, number, number, number][] = [[0, 0, 71, 2], [3.7, -1.2, 71, 2], [12.5, 8.25, 83, 3], [-4.4, 0.9, 91, 2], [25.6, 25.6, 83, 3]];
  for (const [x, y, s, o] of points) expect(fbm(x, y, s, o), `${x},${y}`).toBe(demoFbm(x, y, s, o));
});

test('관측 화면: 지붕 없는 마을 칸', () => {
  // A village cell whose roof hash is ≤ 0.35 (demo 280–284): below 175 m it is a field where the demo's 500 m fbm is
  // above −0.15, else open ground; above 175 m always open.
  const FIELD = [[182, 162, 104], [164, 150, 92], [148, 126, 78]];
  const OPEN = [152, 138, 84];
  const colourAt = (h: number, want: (x: number, y: number) => boolean) => {
    const t = flatTerrain({ n: 128, h });
    t.cover.fill(COVER.indexOf('village'));
    const { r, g, b, light } = terrainColours(t, CLEAR_WEATHER);
    for (let j = 0; j < t.n; j++)
      for (let i = 0; i < t.n; i++) {
        const x = i * t.cell;
        const y = j * t.cell;
        if (demoHash(i, j, 23) > 0.35 || !want(x, y)) continue;
        const k = j * t.n + i;
        return { x, y, rgb: [r[k]!, g[k]!, b[k]!], light: light[k]! };
      }
    throw new Error('no such cell');
  };
  const lit = (rgb: number[], c: { rgb: number[]; light: number }) => c.rgb.every((v, ch) => Math.abs(v + 0.5 - rgb[ch]! * c.light) <= 0.5001);
  const fielded = (x: number, y: number) => demoFbm(x / 500, y / 500, 83, 3) > -0.15;
  const low = colourAt(100, fielded);
  const p = (((Math.floor(low.x / 160) + Math.floor(low.y / 120) * 2) % 3) + 3) % 3;
  expect(lit(FIELD[p]!, low), `${low.rgb}`).toBe(true);
  expect(lit(OPEN, colourAt(100, (x, y) => !fielded(x, y)))).toBe(true);
  expect(lit(OPEN, colourAt(200, fielded))).toBe(true);
});
