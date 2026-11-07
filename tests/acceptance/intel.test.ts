// 탐지와 적정 (F-04): the `id` input carries angles only and the simulation picks the target, then watching it through
// the binoculars reveals type, activity and size. Through the simulation's public interface only.
import { describe, expect, test } from 'vitest';
import { createSim, signalAt, validateReplay, type Member, type Point, type Scenario, type Sim, type Weather } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { drawEffects } from '@render/effects';
import { angleAt, focalOf, MIL, project, QUALITIES } from '@render/projection';
import { terrainColours } from '@render/shade';
import { createViewBuffers, renderView } from '@render/voxel';
import { init, replayData } from './init';
import { angleTo, idAt, mortarAt, oneUnit, run, started, until, wallTerrain } from './enemy';
import { flatTerrain } from './terrain';

const BINO_ON = { a: 'bino', v: [1] };
const BINO_OFF = { a: 'bino', v: [0] };
const cam = (az: number, el = -26) => ({ a: 'cam', v: [Math.round(az + 64000) % 64000, el] });
/** A route walking north, away from the observer, starting 1 km out at east `x`. */
const away = (x: number, y = 1320): Point[] => [
  { x, y },
  { x, y: y + 1000 },
  { x, y: y + 2000 },
];
const recons = (...xs: number[]): Scenario => ({
  ...BASE_SCENARIO,
  routes: { A: away(xs[0]!), B: away(xs[1] ?? xs[0]!), C: away(xs[0]!) },
  units: xs.map((_, i) => ({ type: 'recon' as const, route: i ? ('B' as const) : ('A' as const), t0: 0 })),
});
/** Signed azimuth around north, 0.1 mils. */
const signed = (az: number) => ((az + 32000) % 64000) - 32000;
const intel = (sim: Sim, i = 0) => sim.state.platoons[i]!.intel;
/** The member furthest east (clockwise) of platoon `i`. */
const eastmost = (sim: Sim, i = 0) =>
  sim.state.platoons[i]!.members.reduce((a, b) => (signed(angleTo(sim, b).az) > signed(angleTo(sim, a).az) ? b : a)) as Member;

/** Centres of the dust and smoke discs the view paints, as `id` angles (0.1 mils), west to east, with their painted
 * half-width `half` (0.1 mils): a 640 px view from the flat-terrain observer aimed at `h`, `p` mils. */
function painted(sim: Sim, w: Weather, h: number, p: number): { az: number; el: number; half: number }[] {
  const W = 640;
  const focal = focalOf(W, sim.state.bino);
  const geom = { eye: { x: 320, y: 320, z: 103.5 }, h, focal, cx: W / 2, hor: (W * 9) / 32 + Math.tan(p / MIL) * focal };
  const buf = createViewBuffers(W);
  drawEffects(buf, geom, sim.state, w);
  const lit = (x: number, y: number) => buf.pix[(y * W + x) * 4] !== 0;
  const cols = [...Array(W).keys()].map((x) => [...Array(buf.h).keys()].filter((y) => lit(x, y)));
  const out: { az: number; el: number; half: number }[] = [];
  for (let x = 0; x < W; x++) {
    if (!cols[x]!.length || (x > 0 && cols[x - 1]!.length)) continue;
    let x1 = x;
    while (x1 + 1 < W && cols[x1 + 1]!.length) x1++;
    const ys = cols.slice(x, x1 + 1).flat();
    expect(x > 0 && x1 < W - 1 && Math.min(...ys) > 0 && Math.max(...ys) < buf.h - 1).toBe(true); // wholly in view
    const y = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    out.push({ ...angleAt(geom, 1, (x + x1 + 1) / 2, y), half: signed(angleAt(geom, 1, x1 + 1, y).az - angleAt(geom, 1, x, y).az) / 2 });
  }
  return out;
}

describe('F-04', () => {
  test('F-04: 각도로 누르기', () => {
    // Before the operation starts nothing can be identified.
    const prep = createSim({ ...init(7), scenario: recons(320) });
    expect(prep.step([{ a: 'id', v: [0, -26] }]).accepted).toEqual([false]);

    /** A recon 1 km north, walking away, seen by eye or (`bino`) through the binoculars. */
    const fresh = (bino: boolean) => {
      const sim = started(recons(320));
      if (bino) sim.step([BINO_ON]);
      expect(sim.state.platoons[0]!.members.every((m) => m.vis)).toBe(true);
      return sim;
    };
    /** Whether an `id` that far (0.1 mils) east of / above the eastmost man is accepted; a miss changes nothing. */
    const press = (bino: boolean, dAz: number, dEl: number) => {
      const sim = fresh(bino);
      const twin = fresh(bino);
      const [ok] = sim.step([idAt(angleTo(sim, eastmost(sim)), dAz, dEl)]).accepted;
      twin.step([]);
      if (ok) expect(intel(sim)).toMatchObject({ stage: 1, tnum: 1, cue: 'man' });
      else expect(sim.hash()).toBe(twin.hash());
      return ok;
    };
    // 쌍안경: 3 mils across, 4.5 mils up and down.
    expect(press(true, 29, 0)).toBe(true);
    expect(press(true, 31, 0)).toBe(false);
    expect(press(true, 0, 44)).toBe(true);
    expect(press(true, 0, 46)).toBe(false);
    // 육안: 12 and 18 mils.
    expect(press(false, 119, 0)).toBe(true);
    expect(press(false, 121, 0)).toBe(false);
    expect(press(false, 0, -179)).toBe(true);
    expect(press(false, 0, -181)).toBe(false);

    // Two units side by side: the click goes to the nearer man, whichever unit he belongs to, and each new unit found
    // gets the next target number.
    const pair = () => started(recons(320, 320));
    const probe = pair();
    const men = probe.state.platoons.flatMap((p, pid) => p.members.map((m) => ({ pid, a: angleTo(probe, m) })));
    men.sort((a, b) => signed(a.a.az) - signed(b.a.az));
    const k = men.findIndex((m, i) => i > 0 && m.pid !== men[i - 1]!.pid);
    expect(k).toBeGreaterThan(0);
    const [m, n] = [men[k - 1]!, men[k]!];
    const gap = signed(n.a.az) - signed(m.a.az);
    expect(gap).toBeLessThan(160); // both inside the 12 mil reach of a click between them
    for (const [f, winner] of [
      [0.4, m.pid],
      [0.6, n.pid],
    ] as const) {
      const sim = pair();
      expect(sim.step([idAt(m.a, gap * f)]).accepted).toEqual([true]);
      expect(intel(sim, winner).stage).toBe(1);
      expect(intel(sim, 1 - winner).stage).toBe(0);
      expect(sim.step([idAt(angleTo(sim, sim.state.platoons[1 - winner]!.members[0]!))]).accepted).toEqual([true]);
      expect(intel(sim, 1 - winner)).toMatchObject({ stage: 1, tnum: 2 });
      expect(intel(sim, winner).tnum).toBe(1);
    }

    // A man too small to be seen (1.2 km by eye) cannot be picked.
    const far = started(oneUnit({ type: 'recon', route: 'A', t0: 0 }, away(320, 1520)));
    const hidden = far.state.platoons[0]!.members[0]!;
    expect(hidden.vis).toBe(false);
    expect(far.step([idAt(angleTo(far, hidden))]).accepted).toEqual([false]);

    // The 재생 자료 format: exactly an azimuth 0–63999 and an elevation within ±6000.
    const valid = (v: number[]) => validateReplay(replayData([{ t: 0, a: 'id', v }])).ok;
    expect(valid([63999, 6000])).toBe(true);
    expect(valid([0, -6000])).toBe(true);
    expect(valid([0, 6001])).toBe(false);
    expect(valid([64000, 0])).toBe(false);
    expect(valid([0, 0, 0])).toBe(false);
  });

  test('F-04: 식별은 화면과 무관', () => {
    // The same man pressed on every 화질, CSS width and pixel ratio: the view turns the press into the same angle, so
    // the simulation finds the same unit and ends in the same state.
    const flat = flatTerrain();
    const colours = terrainColours(flat, CLEAR_WEATHER);
    const EYE = { x: 320, y: 320, z: 103.5 };
    const watching = () => {
      const sim = started(recons(320));
      sim.step([BINO_ON]);
      return sim;
    };
    const probe = watching();
    const m = eastmost(probe);
    const target = { x: m.x, y: m.y, z: 100.9 };
    // Aimed 1 mil left of him and 2 mils high, so he is off the centre of the view.
    const aim = { h: Math.atan2(m.x - EYE.x, m.y - EYE.y) * MIL - 1, p: 2 };
    const results = new Set<string>();
    let count = 0;
    for (const w of Object.values(QUALITIES))
      for (const css of [390, 960])
        for (const dpr of [1, 2]) {
          const buf = createViewBuffers(w);
          const geom = renderView(buf, flat, colours, EYE, aim, true, CLEAR_WEATHER);
          const at = project(geom, target)!;
          // The pointer lands on a whole device pixel; events report it in CSS pixels from the canvas' corner.
          const rect = { width: css, height: (css * 9) / 16 };
          const cx = Math.round(((at.sx * rect.width) / buf.w) * dpr) / dpr;
          const cy = Math.round(((at.sy * rect.height) / buf.h) * dpr) / dpr;
          const a = angleAt(geom, buf.w / rect.width, cx, cy);
          const sim = watching();
          expect(sim.step([{ a: 'id', v: [a.az, a.el] }]).accepted).toEqual([true]);
          results.add(JSON.stringify([intel(sim), sim.hash()]));
          count++;
        }
    expect(count).toBe(12);
    expect(results.size).toBe(1);
    expect(JSON.parse([...results][0]!)[0]).toMatchObject({ stage: 1, tnum: 1, cue: 'man' });
  });

  test('F-04: 적정 세 단계', () => {
    // The mortar section 1 km due north: type and activity after 3 + 2.5 = 5.5 s of watching, its size after
    // 5.5 + 6 + 4 = 15.5 s. Watching with men or tubes in view counts 2 half-ticks a tick.
    const MORTAR = { x: 320, y: 1320 };
    const found = (terrain = flatTerrain()) => {
      const sim = started(mortarAt(MORTAR), { terrain });
      sim.step([BINO_ON, cam(0)]);
      return sim;
    };
    const sim = found();
    const crew = sim.state.platoons[0]!.members[1]!;
    expect(sim.step([idAt(angleTo(sim, crew))]).accepted).toEqual([true]);
    expect(intel(sim)).toMatchObject({ stage: 1, tnum: 1, cue: 'man', prog: 2, firstTick: sim.state.tick - 1, size: null });
    expect(sim.state.score).toBe(10);
    run(sim, 108); // 109 ticks watched
    expect(intel(sim)).toMatchObject({ stage: 1, prog: 218 });
    sim.step([]);
    expect(intel(sim)).toMatchObject({ stage: 2, prog: 220 });
    run(sim, 199);
    expect(intel(sim)).toMatchObject({ stage: 2, prog: 618 });
    sim.step([]);
    expect(intel(sim)).toMatchObject({ stage: 3, prog: 620, tubes: 3, seenMax: 9, size: { unit: 'tubes', n: 3 } });
    expect(sim.state.score).toBe(30);
    expect(sim.state.platoons[0]!.activity).toBe('halted');
    run(sim, 10);
    expect(intel(sim).prog).toBe(620);
    expect(intel(sim).seenTick).toBe(sim.state.tick); // still watched, so still seen
    expect(sim.state.score).toBe(30);

    // 쌍안경 안 is the middle 84% of the field: 52.27 mils either side of the line of sight.
    const progAfter = (inputs: { a: string; v: number[] }[]) => {
      const s = found();
      s.step([idAt(angleTo(s, s.state.platoons[0]!.members[1]!))]);
      const before = intel(s).prog;
      s.step(inputs);
      run(s, 9);
      return intel(s).prog - before;
    };
    const west = Math.min(...sim.state.platoons[0]!.members.map((m) => signed(angleTo(sim, m).az)));
    expect(progAfter([cam(west - 520)])).toBe(20);
    expect(progAfter([cam(west - 525)])).toBe(0);
    expect(progAfter([BINO_OFF])).toBe(0); // only the binoculars reveal more

    // Behind a wall only the smoke of its volley is seen: found by the smoke, and watched at half the rate.
    const walled = found(wallTerrain(400, 6));
    until(walled, () => walled.state.effects.some((e) => e.vis), 5000);
    const [puff] = painted(walled, CLEAR_WEATHER, 0, 10);
    expect(walled.step([idAt(puff!)]).accepted).toEqual([true]);
    expect(intel(walled)).toMatchObject({ stage: 1, cue: 'muzzle', prog: 1 });
    run(walled, 49);
    expect(intel(walled)).toMatchObject({ stage: 1, prog: 50, seenMax: 0, tubes: 0 });
    expect(walled.state.platoons[0]!.activity).toBe('firing');
  });

  test('F-04: 규모는 본 만큼', () => {
    // An infantry platoon walking in from 3 km in its column of three files, 40 m (≈ 13 mils) apart. Its size is the
    // most men seen at once in the binoculars' middle 84%: the whole platoon, two files or one.
    const route = [
      { x: 320, y: 3320 },
      { x: 320, y: 2000 },
      { x: 320, y: 600 },
    ];
    const sizeSeen = (dAz: number, later?: number) => {
      const sim = started(oneUnit({ type: 'inf', route: 'A', t0: 0 }, route));
      const p = sim.state.platoons[0]!;
      const centre = signed(angleTo(sim, { kind: 'man', prone: false, x: p.x, y: p.y }).az);
      sim.step([BINO_ON, cam(centre + dAz)]);
      const m = p.members.find((q) => Math.abs(signed(angleTo(sim, q).az) - centre - 133) < 30)!; // the east file
      expect(sim.step([idAt(angleTo(sim, m))]).accepted).toEqual([true]);
      if (later !== undefined) {
        run(sim, 100);
        sim.step([cam(centre + later)]);
      }
      until(sim, () => intel(sim).stage === 3, 2000);
      expect(p.form).toBe(0); // still in column
      return intel(sim).size;
    };
    expect(sizeSeen(0)).toEqual({ unit: 'platoon', n: 30 });
    expect(sizeSeen(450)).toEqual({ unit: 'platoon_minus', n: 20 });
    expect(sizeSeen(600)).toEqual({ unit: 'squad', n: 10 });
    // Seen whole once, then only one file: the most seen stands.
    expect(sizeSeen(0, 600)).toEqual({ unit: 'platoon', n: 30 });

    // A recon team is counted in men.
    const recon = started(recons(320));
    recon.step([BINO_ON, cam(signed(angleTo(recon, recon.state.platoons[0]!.members[0]!).az))]);
    expect(recon.step([idAt(angleTo(recon, eastmost(recon)))]).accepted).toEqual([true]);
    until(recon, () => intel(recon).stage === 3, 2000);
    expect(intel(recon).size).toEqual({ unit: 'men', n: 4 });
  });

  test('F-04: 보이는 연기를 누르고 지켜본다', () => {
    // The mortar section 1 km north behind a 6 m wall: its crew is hidden, the smoke of its volley rises into view.
    const behindWall = (w: Weather) => {
      const sim = started(mortarAt({ x: 320, y: 1320 }), { terrain: wallTerrain(400, 6), weather: w });
      sim.step([BINO_ON]);
      until(sim, () => sim.state.effects.length > 0, 5000);
      expect(sim.state.platoons[0]!.members.some((m) => m.vis)).toBe(false);
      return sim;
    };
    // Pressing the middle of a painted puff 5 s old finds the mortar.
    const sim = behindWall(CLEAR_WEATHER);
    run(sim, 99);
    const puffs = painted(sim, CLEAR_WEATHER, 13, 20);
    expect(puffs).toHaveLength(3);
    expect(sim.step([idAt(puffs[1]!)]).accepted).toEqual([true]);
    expect(intel(sim)).toMatchObject({ stage: 1, cue: 'muzzle' });
    // Anywhere on the painted disc counts: 6 mils east of the east puff's centre is still the puff, and so is a
    // press within the binoculars' 3 × 4.5 mil reach of its edge. Past that, nothing is pressed, diagonally too.
    const pressEast = (dAz: (east: { half: number }) => number, dEl = 0) => {
      const s = behindWall(CLEAR_WEATHER);
      run(s, 99);
      const east = painted(s, CLEAR_WEATHER, 13, 20)[2]!;
      expect(east.half).toBeGreaterThan(90); // 10.5 m at 1 km
      return s.step([idAt(east, dAz(east), dEl)]).accepted[0];
    };
    expect(pressEast(() => 60)).toBe(true);
    expect(pressEast((east) => east.half + 30 - 5)).toBe(true);
    expect(pressEast((east) => east.half + 30 + 5)).toBe(false);
    // (12.9, 14.4) mils off a ≈ 10.5 mil disc: within radius + reach on each axis, but 8.8 mils out from its edge.
    expect(pressEast(() => 129, 144)).toBe(false);

    // A 20 m/s wind from the west carries the smoke about 100 m (≈ 100 mils) east in 5 s. Watching counts where the
    // smoke is seen, at half rate: aimed at the drifted plume it counts, aimed at where it was fired it does not.
    const gale = { ...CLEAR_WEATHER, windFromDeg: 270, windSpeedTenthMs: 200 };
    const watched = (aimAt: 'plume' | 'origin') => {
      const s = behindWall(gale);
      run(s, 99);
      const [, mid] = painted(s, gale, 100, 20);
      expect(signed(mid!.az)).toBeGreaterThan(800);
      expect(s.step([idAt(mid!)]).accepted).toEqual([true]);
      const before = intel(s).prog;
      s.step([cam(aimAt === 'plume' ? mid!.az : 0)]);
      run(s, 9);
      expect(intel(s).seenMax).toBe(0);
      return intel(s).prog - before;
    };
    expect(watched('plume')).toBe(10);
    expect(watched('origin')).toBe(0);
  });

  test('F-04: 연기의 모서리는 연기가 아니다', () => {
    // The mortar in the open, 1 km north, 5 ticks after its volley: one of its crew stands just outside a puff's
    // ≈ 3 mil disc, within the square around it. A press a little past him, still within that square, is outside the
    // disc too: the puff counts only as near as its edge, so the man nearer the press is found, not the smoke.
    const sim = started(mortarAt({ x: 320, y: 1320 }));
    sim.step([BINO_ON]);
    until(sim, () => sim.state.effects.length > 0, 5000);
    run(sim, 5);
    const k = 32000 / Math.PI;
    const { op, tick } = sim.state;
    const discs = sim.state.effects.map((e) => {
      const c = signalAt(e, tick, CLEAR_WEATHER);
      const d = Math.hypot(c.x - op.x, c.y - op.y);
      return { az: Math.atan2(c.x - op.x, c.y - op.y) * k, el: Math.atan2(c.z - 103.5, d) * k, r: Math.atan2(c.r, d) * k };
    });
    expect(sim.state.effects.every((e) => e.vis)).toBe(true);
    const corner = sim.state.platoons[0]!.members.flatMap((m) => {
      const a = angleTo(sim, m);
      return m.vis && m.kind === 'man' ? discs.map((c) => ({ a, c, da: (a.az - c.az) / c.r, de: (a.el - c.el) / c.r })) : [];
    }).find(({ da, de }) => Math.abs(da) < 1 && Math.abs(de) < 1 && Math.hypot(da, de) > 1.05)!;
    expect(corner).toBeDefined();
    // 3 tenths of a mil on outwards, away from the puff's centre.
    const h = Math.hypot(corner.da, corner.de);
    const press = { az: corner.a.az + (corner.da / h) * 3, el: corner.a.el + (corner.de / h) * 3 };
    expect(Math.abs(press.az - corner.c.az)).toBeLessThan(corner.c.r);
    expect(Math.abs(press.el - corner.c.el)).toBeLessThan(corner.c.r);
    expect(sim.step([idAt(press)]).accepted).toEqual([true]);
    expect(intel(sim).cue).toBe('man');
  });
});
