// 적 움직임 묘사 (F-27): the sprites come from the simulation's state, and only what it decided is seen is drawn.
import { describe, expect, test } from 'vitest';
import type { ReadonlySimState, Sim } from '@sim';
import { CLEAR_WEATHER } from '@app/clearWeather';
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
