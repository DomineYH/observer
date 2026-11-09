// 아군 손실의 확률 (#35, F-29): how often our men fall in a game, factor by factor, against the rates the rules give.
// Many fixed-seed trials through the public interface (create, step, read-only state); the exported model functions
// only say what each trial's chance should have been.
//
// Every trial is one man exposed once: to an enemy round landing within 15 m, or to one tick of enemy infantry fire.
// For a factor, each group pools its deaths `o`, the formula's expected deaths `e` = Σ chance, and `b` = Σ chance with
// that factor set neutral. `o / b` is the factor as the game shows it, `e / b` as the rule gives it. Deaths are rare per
// trial, so `o` is Poisson about `e`: each group must land within 3σ (|o − e| ≤ 3√e; the seeds below sit within 1.5σ,
// and seeds 2 and 3 were checked too). A chance wired to a fixed value, or a factor dropped, puts a group 4σ or more out.
import { describe, expect, test } from 'vitest';
import { enemyFireChance, friendlyLossChance, type Point, type Scenario, type UnitDef } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { dist, RESERVE, started } from './enemy';
import { flatTerrain } from './terrain';

interface Pool {
  n: number; // trials
  o: number; // deaths seen
  e: number; // deaths the rule expects
  b: number; // … with the factor under test neutral
}
const pool = (): Pool => ({ n: 0, o: 0, e: 0, b: 0 });
const add = (p: Pool, died: boolean, e: number, b: number) => {
  p.n++;
  p.o += died ? 1 : 0;
  p.e += e;
  p.b += b;
};
/** The group's deaths within 3 Poisson σ of the rule's, and so its factor `o / b` near the rule's `e / b`. */
function matches(p: Pool, label: string): void {
  expect(Math.abs(p.o - p.e), `${label}: ${p.o} fell, rule ${p.e.toFixed(1)}`).toBeLessThanOrEqual(3 * Math.sqrt(p.e));
  expect(p.e, `${label}: enough trials`).toBeGreaterThan(20);
}
const level = (p: Pool) => p.o / p.b;

/** Whether each man alive before a step lay down during it: survivors show it after the step; the fallen are laid
 * down by their fall, so for them the step before tells (it differs only on the one tick a man gets up or down). */
const proneDuring = (was: readonly { alive: boolean; prone: boolean }[], m: { alive: boolean; prone: boolean }, i: number) => (m.alive ? m.prone : was[i]!.prone);

describe('F-29: 아군 손실의 확률', () => {
  test('F-29: 박격포에 의한 손실 — 서 있음 30 %, 엎드림 10 %', () => {
    // 24 mortar sections on 40 positions 250 × 180 m apart: a position mostly takes its first round standing and the
    // next ones within 40 s lying down. No enemy comes near, so a man lies down only for the rounds.
    const friends: Point[] = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) friends.push({ x: 500 + i * 250, y: 900 + j * 180 });
    const units: UnitDef[] = Array.from({ length: 24 }, () => ({ type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0 }));
    const scenario: Scenario = { ...BASE_SCENARIO, units, nais: [{ x: 1700, y: 2400, r: 100, conf: 'low' }], friends };
    const sim = started(scenario, { seed: 1, terrain: flatTerrain({ n: 256 }) });
    const standing = pool();
    const prone = pool();
    while (sim.state.tick < 16000) {
      if (sim.state.phase !== 'live') throw new Error(`game over at ${sim.state.tick}`);
      const was = sim.state.friendlies.map((m) => ({ alive: m.alive, prone: m.prone }));
      sim.step([]);
      const t = sim.state.tick;
      for (const s of sim.state.effects.filter((e) => e.kind === 'burst' && e.small && e.pid === -1 && e.tick === t))
        sim.state.friendlies.forEach((m, i) => {
          const r = dist(m, s); // the fallen lie where the round found them
          if (!was[i]!.alive || r > 15) return;
          const down = proneDuring(was, m, i);
          // neutral: the 15 m fall-off alone, exp(−1.5 (r/15)²), so o / b is the chance at the burst itself
          add(down ? prone : standing, !m.alive, friendlyLossChance('mortar', r, down), Math.exp(-1.5 * (r / 15) * (r / 15)));
        });
    }
    matches(standing, 'standing');
    matches(prone, 'prone');
    expect(level(standing)).toBeGreaterThan(2 * level(prone)); // 0.3 against 0.1
  }, 30000);

  test('F-29: 적 보병 사격에 의한 손실 — 잔존률·근접도·엎드림', () => {
    // Three spots 1.1 km apart, each with two positions 60 m apart and twelve enemy platoons parked on it: about 30 m
    // from the positions at the two outer spots, 190–250 m at the middle one. Nothing else hurts our men. Parked on their
    // objectives, the platoons overrun them at once (진지 돌파: never judged again, still firing); our direct fire thins
    // them from whole, and about half our men lie down in their places. The RESERVE keeps the game going.
    const spots: Point[] = [{ x: 800, y: 2000 }, { x: 1900, y: 2000 }, { x: 3000, y: 2000 }];
    const friends = spots.flatMap((f) => [f, { x: f.x, y: f.y + 60 }]);
    const parked = (f: Point, d: number) => [{ x: f.x, y: f.y + d }, { x: f.x, y: f.y + d + 1 }];
    const routes = { A: parked(spots[0]!, 30), B: parked(spots[1]!, 250), C: parked(spots[2]!, 30) };
    const units: UnitDef[] = (['A', 'B', 'C'] as const).flatMap((route) => Array.from({ length: 12 }, () => ({ type: 'inf' as const, route, t0: 0 })));
    units.push(RESERVE);
    const sim = started({ ...BASE_SCENARIO, routes, units, friends }, { seed: 1, terrain: flatTerrain({ n: 384 }) });
    const far = (pos: number) => pos === 2 || pos === 3;
    const P = { standing: pool(), prone: pool(), near: pool(), far: pool(), whole: pool(), thinned: pool() };
    while (sim.state.tick < 10000) {
      if (sim.state.phase !== 'live') throw new Error(`game over at ${sim.state.tick}`);
      const was = sim.state.friendlies.map((m) => ({ alive: m.alive, prone: m.prone }));
      sim.step([]);
      // Per position, the platoons firing on it this tick: infantry, set off, not destroyed, not down, within 400 m.
      const fire = friends.map((f) =>
        sim.state.platoons
          .filter((p) => p.type === 'inf' && p.state !== 'wait' && p.state !== 'destroyed' && sim.state.tick >= p.pinnedUntil && dist(p, f) < 400)
          .map((p) => ({ ea: p.members.filter((q) => q.alive).length / p.members.length, d: dist(p, f) })),
      );
      sim.state.friendlies.forEach((m, i) => {
        const fs = fire[m.pos]!;
        if (!was[i]!.alive || !fs.length) return;
        const down = proneDuring(was, m, i);
        const sum = (f: (ea: number, d: number) => number) => fs.reduce((a, { ea, d }) => a + f(ea, d), 0);
        const e = sum((ea, d) => enemyFireChance(ea, d, down));
        const died = !m.alive;
        add(down ? P.prone : P.standing, died, e, sum((ea, d) => enemyFireChance(ea, d, false)));
        add(far(m.pos) ? P.far : P.near, died, e, sum((ea) => enemyFireChance(ea, 0, down)));
        const ea = fs.reduce((a, f) => a + f.ea, 0) / fs.length;
        if (ea >= 0.8 || ea < 0.65) add(ea >= 0.8 ? P.whole : P.thinned, died, e, sum((_, d) => enemyFireChance(1, d, down)));
      });
    }
    for (const k of ['standing', 'prone', 'near', 'far', 'whole', 'thinned'] as const) matches(P[k], k);
    expect(level(P.prone)).toBeLessThan(0.75 * level(P.standing)); // ½ lying down
    expect(level(P.far)).toBeLessThan(0.6 * level(P.near)); // (400 − d)/400: ≈ 0.4 against ≈ 0.92
    expect(level(P.thinned)).toBeLessThan(0.8 * level(P.whole)); // the enemy's men left: ≈ 0.55 against ≈ 0.9
  }, 30000);
});
