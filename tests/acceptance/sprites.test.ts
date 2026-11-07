// 적 움직임 묘사 (F-27): the sprites come from the simulation's state, and only what it decided is seen is drawn.
import { describe, expect, test } from 'vitest';
import type { FieldEffect, ReadonlySimState, Sim, TerrainData } from '@sim';
import { drawMap, type MapContext, type MapMarks } from '@render/map';
import { FULL_VIEW } from '@render/mapView';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { focalOf, MIL, type ViewGeometry } from '@render/projection';
import { drawEffects } from '@render/effects';
import { createViewBuffers } from '@render/voxel';
import { drawSprites, spritesOf, type Sprite, type SpriteContext } from '@render/sprites';
import { mortarAt, oneUnit, run, started, until } from './enemy';
import { flatTerrain } from './terrain';

const W = 640;
const EYE = { x: 320, y: 320, z: 103.5 };
const BINO_ON = { a: 'bino', v: [1] };
/** The view aimed at the first unit's centre, as the observation view would draw it. */
function view(state: ReadonlySimState): ViewGeometry {
  const p = state.platoons[0]!;
  const h = Math.atan2(p.x - EYE.x, p.y - EYE.y) * MIL;
  return { eye: EYE, h, focal: focalOf(W, state.bino), cx: W / 2, hor: (W * 9) / 32 };
}
const flat = flatTerrain();
const sprites = (sim: Sim) => spritesOf(sim.state, view(sim.state), flat, CLEAR_WEATHER);

/** Bounding box of everything one sprite fills. */
function box(list: Sprite[], bino: boolean) {
  const rects: [number, number, number, number][] = [];
  const c: SpriteContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: (x, y, w, h) => void rects.push([x, y, w, h]),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
  };
  drawSprites(c, list, 1, bino, 1, [200, 200, 196]);
  for (const r of rects) expect(Math.min(r[2], r[3])).toBeGreaterThanOrEqual(1);
  const x0 = Math.min(...rects.map((r) => r[0]));
  const y0 = Math.min(...rects.map((r) => r[1]));
  return { w: Math.max(...rects.map((r) => r[0] + r[2])) - x0, h: Math.max(...rects.map((r) => r[1] + r[3])) - y0 };
}

describe('F-27', () => {
  test('F-27: 적 움직임 묘사', () => {
    // Walking: the leg phase advances with time at the walking pace (2 × 3 rad/s), and only while the unit moves.
    const north = [
      { x: 320, y: 3600 },
      { x: 320, y: 2100 },
      { x: 320, y: 600 },
    ];
    const inf = started(oneUnit({ type: 'inf', route: 'B', t0: 0 }, north));
    inf.step([BINO_ON]);
    run(inf, 5);
    const a = sprites(inf);
    expect(a).toHaveLength(30);
    expect(a.every((s) => s.moving && s.kind === 'man' && !s.prone)).toBe(true);
    inf.step([]);
    const b = sprites(inf);
    const phases = (l: Sprite[]) => l.map((s) => s.ph).sort((x, y) => x - y);
    phases(b).forEach((ph, i) => expect(ph - phases(a)[i]!).toBeCloseTo(0.05 * 2 * 3, 9));

    // Running: from 900 m the platoon assaults, and its legs move at the running pace (2.8 × 3 rad/s).
    until(inf, () => inf.state.platoons[0]!.state === 'assault');
    run(inf, 6);
    const c = sprites(inf);
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((s) => s.moving && !s.prone)).toBe(true);
    inf.step([]);
    phases(sprites(inf)).forEach((ph, i) => expect(ph - phases(c)[i]!).toBeCloseTo(0.05 * 2.8 * 3, 9));

    // Lying down comes from the state: the holding recon shows one man up and three prone, standing still.
    const short = [
      { x: 320, y: 1400 },
      { x: 320, y: 1000 },
      { x: 320, y: 600 },
    ];
    const recon = started(oneUnit({ type: 'recon', route: 'A', t0: 0 }, short));
    recon.step([BINO_ON]);
    until(recon, () => recon.state.platoons[0]!.state === 'hold');
    run(recon, 6);
    const r = sprites(recon);
    expect(r.map((s) => s.prone).sort()).toEqual([false, true, true, true]);
    expect(r.some((s) => s.moving)).toBe(false);
    const up = box(r.filter((s) => !s.prone), true);
    const down = box([r.find((s) => s.prone)!], true);
    expect(up.h).toBeGreaterThan(up.w);
    expect(down.w).toBeGreaterThan(down.h);
    // 지각 배율 2.2 through binoculars, 1.4 by eye: drawing size only.
    expect(up.h / box(r.filter((s) => !s.prone), false).h).toBeCloseTo(2.2 / 1.4, 1);

    // Only members the simulation sees: the mortar crew at 1.2 km is hidden by eye, all twelve show in binoculars.
    const mortar = started(mortarAt({ x: 320, y: 1520 }));
    expect(sprites(mortar)).toEqual([]);
    mortar.step([BINO_ON]);
    expect(sprites(mortar)).toHaveLength(12);
    expect(sprites(mortar).filter((s) => s.kind === 'tube')).toHaveLength(3);

    // Dust behind a moving APC is painted only where it is seen: at 3 km through binoculars, not by eye.
    const painted = (bino: boolean) => {
      const apc = started(oneUnit({ type: 'apc', route: 'B', t0: 0 }, north));
      if (bino) apc.step([BINO_ON]);
      until(apc, () => apc.state.effects.length > 0);
      run(apc, 5);
      const buf = createViewBuffers(W);
      drawEffects(buf, view(apc.state), apc.state, CLEAR_WEATHER);
      return buf.pix.some((v) => v !== 0);
    };
    expect(painted(true)).toBe(true);
    expect(painted(false)).toBe(false);
  });
});

/** The view from the flat-terrain post aimed at `p`. */
const aimAt = (p: { x: number; y: number }, bino: boolean): ViewGeometry => ({
  eye: EYE,
  h: Math.atan2(p.x - EYE.x, p.y - EYE.y) * MIL,
  focal: focalOf(W, bino),
  cx: W / 2,
  hor: (W * 9) / 32,
});
/** The 아군 진지 boxes (14 × 8 strokeRects) the map draws from `sim`'s state. */
function mapBoxes(sim: Sim, scenario: MapMarks['scenario'], t: TerrainData) {
  const rects: number[][] = [];
  const ctx = new Proxy({ strokeRect: (x: number, y: number, w: number, h: number) => void rects.push([x, y, w, h]) } as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k as string] : () => {}),
    set: () => true,
  }) as unknown as MapContext;
  const s = sim.state;
  const marks: MapMarks = { scenario, op: s.op, knownOp: s.knownOp, dest: null, az: s.aim.az, fovMil: 1066, pin: null, platoons: s.platoons, mode: s.mode, missions: s.missions, tick: s.tick, weather: CLEAR_WEATHER };
  drawMap(ctx, t, {} as CanvasImageSource, FULL_VIEW, marks);
  return rects.filter((r) => r[2] === 14 && r[3] === 8);
}
/** Every fillRect's colour and box. */
function fills(list: Sprite[]) {
  const out: { col: string; w: number; h: number }[] = [];
  let arcs = 0;
  const c: SpriteContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect(_x, _y, w, h) {
      out.push({ col: String(this.fillStyle), w, h });
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => void arcs++,
    fill: () => {},
  };
  drawSprites(c, list, 1, true, 1, [200, 200, 196]);
  return { out, arcs };
}
const near = (kind: Sprite['kind'], side: Sprite['side'], rel = 0): Sprite => ({ sx: 320, sy: 200, fwd: 20, k: 30, fz: 0, kind, side, prone: false, moving: false, rel, ph: 0 });

describe('F-27: 아군', () => {
  test('F-27: 아군 묘사', () => {
    // A friendly position 660 m from the post, seen by eye; no enemy, so the walkers stroll. A road north from
    // (400, 400) carries the supply truck, 113 m from the post.
    const FRIEND = { x: 640, y: 900 };
    const scenario = { ...oneUnit({ type: 'recon', route: 'A', t0: 9999 }), friends: [FRIEND], supplyRoad: 1 };
    const field = (rows: number[] = []) => {
      const t = { ...flatTerrain({ n: 256 }), roads: [[], [{ x: 400, y: 400 }, { x: 400, y: 1400 }]] };
      for (const j of rows) for (let i = 0; i < t.n; i++) t.surface[j * t.n + i]! += 50;
      return t;
    };
    const open = field();
    const sim = started(scenario, { terrain: open });
    run(sim, 6);
    const v = aimAt(FRIEND, false);
    const friends = (s: Sim) => spritesOf(s.state, v, open, CLEAR_WEATHER).filter((x) => x.side === 'friend' && x.kind === 'man');
    const seen = sim.state.friendlies.filter((m) => m.vis).length;
    expect(seen).toBe(24);
    expect(friends(sim)).toHaveLength(seen);
    expect(friends(sim).every((x) => !x.prone)).toBe(true);
    // The map from the same state: a 아군 진지 box for each position with seen men (0.2 px/m on this 2.56 km field).
    const boxes = mapBoxes(sim, scenario, open);
    const shown = [...new Set(sim.state.friendlies.filter((m) => m.vis).map((m) => m.pos))];
    expect(shown).toEqual([0]);
    for (const pos of shown) {
      const f = scenario.friends[pos]!;
      expect(boxes).toContainEqual([f.x * 0.2 - 7, 512 - f.y * 0.2 - 4, 14, 8]);
    }
    // Walking: a strolling man's legs move at 1.2 × 3 rad/s, the others stand still.
    until(sim, () => friends(sim).some((x) => x.moving));
    const a = friends(sim);
    sim.step([]);
    const b = friends(sim);
    const match = (x: Sprite) => a.reduce((m, y) => (Math.abs(y.sx - x.sx) < Math.abs(m.sx - x.sx) ? y : m));
    for (const x of b.filter((x) => x.moving && match(x).moving)) expect(x.ph - match(x).ph).toBeCloseTo(0.05 * 1.2 * 3, 9);
    for (const x of b.filter((x) => !x.moving && !match(x).moving)) expect(x.ph).toBe(match(x).ph);
    // The truck, from the simulation's truck: one sprite facing its heading, up the road and back down.
    const trucks = (s: Sim, t = open, tv = aimAt(s.state.truck!, false)) => spritesOf(s.state, tv, t, CLEAR_WEATHER).filter((x) => x.kind === 'truck');
    for (const north of [true, false]) {
      until(sim, () => sim.state.truck!.moving && sim.state.truck!.vis && (north ? Math.cos(sim.state.truck!.dir) > 0.9 : Math.cos(sim.state.truck!.dir) < -0.9), 10000);
      const k = sim.state.truck!;
      const list = trucks(sim);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ side: 'friend', moving: true });
      expect(list[0]!.rel).toBeCloseTo(k.dir - aimAt(k, false).h / MIL, 9);
    }
    // Behind a wall across the field in front of the post nothing is seen, and nothing is drawn.
    const wall = field([35, 36]);
    const hidden = started(scenario, { terrain: wall });
    until(hidden, () => hidden.state.truck!.moving);
    run(hidden, 6);
    expect(hidden.state.friendlies.some((m) => m.vis)).toBe(false);
    expect(hidden.state.truck!.vis).toBe(false);
    expect(spritesOf(hidden.state, v, wall, CLEAR_WEATHER).filter((x) => x.side === 'friend')).toEqual([]);
    expect(trucks(hidden, wall)).toEqual([]);
  }, 30000);

  test('F-27: 아군 묘사 — 아군 색, 트럭의 진행 방향 모양', () => {
    // Close up and fog-free: friends in their own greens, the enemy in its olive (demo SPR_COL).
    expect(fills([near('man', 'friend')]).out.some((f) => f.col === 'rgb(40,54,40)')).toBe(true);
    expect(fills([near('man', 'friend')]).out.some((f) => f.col === 'rgb(52,54,38)')).toBe(false);
    expect(fills([near('man', 'enemy')]).out.some((f) => f.col === 'rgb(52,54,38)')).toBe(true);
    // The truck: side on it is 6.2 m long, head on 2.4 m wide; side on and close, a windscreen and three wheels.
    const side = fills([near('truck', 'friend', Math.PI / 2)]);
    const head = fills([near('truck', 'friend', 0)]);
    const width = (f: ReturnType<typeof fills>) => Math.max(...f.out.map((x) => x.w));
    expect(width(side) / width(head)).toBeCloseTo(6.2 / 2.4, 1);
    expect(side.out.some((f) => f.col === 'rgb(72,84,64)')).toBe(true);
    expect(side.out.some((f) => f.col === 'rgb(120,140,150)')).toBe(true);
    expect(side.arcs).toBe(3);
    expect(head.arcs).toBe(0);
  });

  test('F-27: 아군 묘사 — 총구 섬광은 0.12초만 번쩍인다', () => {
    const sim = started(oneUnit({ type: 'recon', route: 'A', t0: 9999 }));
    const at = { x: 320, y: 600 };
    const flash: FieldEffect = { kind: 'muzzle', x: at.x, y: at.y, gz: 101.3, tick: sim.state.tick, life: 10, pid: -1, small: true, vt: false, tiny: true, vis: true };
    const painted = (age: number, vis = true) => {
      const buf = createViewBuffers(W);
      drawEffects(buf, aimAt(at, false), { ...sim.state, tick: flash.tick + age, effects: [{ ...flash, vis }] }, CLEAR_WEATHER);
      return buf.pix.filter((v) => v !== 0).length;
    };
    expect(painted(0)).toBeGreaterThan(0);
    expect(painted(2)).toBe(painted(0)); // a flash, no smoke
    expect(painted(3)).toBe(0);
    expect(painted(0, false)).toBe(0); // only what the simulation sees
  });
});
