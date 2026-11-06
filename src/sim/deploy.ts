// 실제 배치 (demo makePlatoons, lines 420–447): the seed decides the enemy's routes, the mortar's spot and every
// member's place in its formation, all from the scenario stream when the simulation is created.
// Draw order: route choices in unit order, then the mortar's spot, then each unit's members and route jitter.
import { layout } from './enemy';
import { gauss, next, type Stream } from './rng';
import { heightAt, surfaceAt, type Point, type TerrainData } from './terrain';
import type { Member, Platoon, RouteKey, Scenario } from './types';

const TAU = Math.PI * 2;
const MORTAR_TRIES = 40;
const CANOPY_M = 3; // the mortar sits in the open: surface no more than this above the ground

// `x, y` are placed by `layout` and `vis` by the visibility pass.
const member = (s: Stream, kind: Member['kind'], u: number, v: number, uc = u, vc = v): Member => ({ kind, u, v, uc, vc, ph: next(s) * TAU, x: 0, y: 0, prone: false, vis: false });

function members(s: Stream, type: Platoon['type']): Member[] {
  const out: Member[] = [];
  // Arguments are evaluated before `member` draws the phase, as in the demo.
  if (type === 'inf')
    // 횡대 150 m × 30 m and the approach column of three squads, 80 m × 72 m
    for (let q = 0; q < 3; q++)
      for (let m = 0; m < 10; m++) {
        const u = (q - 1) * 55 + (m - 4.5) * 5 + gauss(s) * 3;
        const v = (q === 1 ? 12 : 0) + gauss(s) * 10;
        const uc = (q - 1) * 40 + gauss(s) * 1.5;
        const vc = -m * 8 + gauss(s) * 1.5;
        out.push(member(s, 'man', u, v, uc, vc));
      }
  if (type === 'recon') for (const u of [-15, -5, 6, 16]) out.push(member(s, 'man', u, gauss(s) * 4));
  if (type === 'apc') out.push(member(s, 'veh', 0, 0), member(s, 'veh', 4, -45));
  if (type === 'mortar')
    for (const u of [-25, 0, 25]) out.push(member(s, 'tube', u, 0), member(s, 'man', u - 3, -4), member(s, 'man', u + 3, -5), member(s, 'man', u, -9));
  return out;
}

const open = (t: TerrainData, x: number, y: number) => surfaceAt(t, x, y) - heightAt(t, x, y) < CANOPY_M;

export function deploy(sc: Scenario, t: TerrainData, s: Stream): Platoon[] {
  const routes: (RouteKey | null)[] = sc.units.map((u) => {
    if (u.type === 'mortar') return null;
    if (typeof u.route === 'string') return u.route;
    return next(s) < u.route.p ? u.route.first : u.route.second;
  });
  const spots: (Point | null)[] = sc.units.map((u) => {
    if (u.type !== 'mortar') return null;
    const nai = sc.nais[u.nai]!;
    let spot: Point = nai;
    for (let k = 0; k < MORTAR_TRIES; k++) {
      spot = { x: nai.x + (next(s) - 0.5) * u.spread.x, y: nai.y + (next(s) - 0.5) * u.spread.y };
      if (open(t, spot.x, spot.y) && open(t, spot.x + 30, spot.y)) break; // the last try stands if none is open
    }
    return spot;
  });
  return sc.units.map((u, i) => {
    const ms = members(s, u.type);
    const route = routes[i] ?? null;
    const path = route ? sc.routes[route].map((p) => ({ x: p.x + gauss(s) * 30, y: p.y + gauss(s) * 30 })) : [];
    const at = path[0] ?? spots[i]!;
    const p: Platoon = {
      type: u.type,
      route,
      path,
      x: at.x,
      y: at.y,
      members: ms,
      state: 'wait',
      t0: Math.round(u.t0 * 20),
      wp: 1,
      dir: u.type === 'mortar' ? Math.PI : 0, // the mortar faces south, the rest north until they move
      form: u.type === 'inf' ? 0 : 1, // infantry starts in its approach column
      moving: false,
      assaultTick: -1,
      nextFire: 0,
      lastFire: -1,
      dustTick: 0,
    };
    layout(p, 0, 0);
    return p;
  });
}
