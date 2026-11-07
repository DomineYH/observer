// 발각과 보복, 관측반 손실 (F-21, PRD 5.1): the model numbers from the pure function, the rest through the simulation's
// public interface only.
import { describe, expect, test } from 'vitest';
import type { FieldEffect, PostEvent, Scenario, Sim, SimEvent } from '@sim';
import { replay } from '@sim';
import { exposureChance } from '@sim/exposure';
import { replayData, START } from './init';
import { flatTerrain } from './terrain';
import { dist, oneUnit, started } from './enemy';
import { CALL_FFE, DESC_UNKNOWN, openRadio, started as empty, toReady, untilImpact } from './mission';
import { gridAt } from './strike';

const NONE = { moving: false, canopy: false, forward: false, recon: false };

/** A unit standing about 300 m north of the flat-terrain post (320, 320), in plain sight. */
const near = (type: 'inf' | 'recon') => oneUnit({ type, route: 'A', t0: 0 }, [{ x: 320, y: 700 }, { x: 320, y: 650 }, { x: 320, y: 620 }]);
/** The same with the enemy mortar section dug in 5 km north (off the small map: it only fires). */
const withMortar: Scenario = { ...near('inf'), units: [near('inf').units[0]!, { type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0 }], nais: [{ x: 320, y: 5000, r: 100, conf: 'low' }] };

const post = (events: readonly SimEvent[]) => events.filter((e): e is PostEvent => e.type === 'post');
type Run = { notes: PostEvent[]; bursts: (FieldEffect & { at: number })[]; scores: Map<number, number> };

/** Runs `ticks` steps with no input, collecting the post notes, the enemy's bursts (small, no unit) and the score by tick. */
function watch(sim: Sim, ticks: number): Run {
  const r: Run = { notes: [], bursts: [], scores: new Map() };
  for (let k = 0; k < ticks && sim.state.phase !== 'ended'; k++) {
    r.notes.push(...post(sim.step([]).events));
    for (const e of sim.state.effects) if (e.kind === 'burst' && e.small && e.tick === sim.state.tick) r.bursts.push({ ...e, at: e.tick });
    r.scores.set(sim.state.tick, sim.state.score);
  }
  return r;
}
const first = (r: Run, what: string) => r.notes.find((n) => n.what === what);

describe('F-21', () => {
  test('F-21: 발각 확률과 배율', () => {
    // 0.12 × (1 − 거리/1.1 km) for each enemy unit that can see the post, none beyond 1.1 km.
    expect(exposureChance(0, NONE)).toBeCloseTo(0.12, 12);
    expect(exposureChance(550, NONE)).toBeCloseTo(0.06, 12);
    expect(exposureChance(1100, NONE)).toBe(0);
    expect(exposureChance(1101, NONE)).toBe(0);
    // 이동 중 ×1.8 · 숲 속 ×0.35 · 전선 전방 ×1.3 · 정찰조 ×1.6, each alone and all together.
    expect(exposureChance(0, { ...NONE, moving: true })).toBeCloseTo(0.216, 12);
    expect(exposureChance(0, { ...NONE, canopy: true })).toBeCloseTo(0.042, 12);
    expect(exposureChance(0, { ...NONE, forward: true })).toBeCloseTo(0.156, 12);
    expect(exposureChance(0, { ...NONE, recon: true })).toBeCloseTo(0.192, 12);
    expect(exposureChance(0, { moving: true, canopy: true, forward: true, recon: true })).toBeCloseTo(0.12 * 1.8 * 0.35 * 1.3 * 1.6, 12);
    expect(exposureChance(550, { moving: true, canopy: false, forward: true, recon: false })).toBeCloseTo(0.06 * 1.8 * 1.3, 12);
  });

  test('F-21: 발각과 보복', () => {
    // Infantry 300 m away finds the post at a 5 s check; the live mortar answers: 4 rounds at the post as it stood, from
    // 60 s on, 4 s apart; within 150 s nobody finds it again. (Seed: the first of 1–20 whose 관측반 lives through it.)
    let checked = false;
    for (let seed = 1; seed <= 20 && !checked; seed++) {
      const sim = started(withMortar, { seed });
      const r = watch(sim, 9000);
      const found = first(r, 'compromised');
      expect(found, `seed ${seed}`).toBeDefined();
      if (first(r, 'lost')) continue;
      checked = true;
      expect(found).toMatchObject({ pid: 0, fire: 'mortar' });
      expect(found!.tick % 100).toBe(0);
      const c = found!.tick;
      expect(r.bursts.filter((b) => b.at < c + 3000).map((b) => b.at)).toEqual([0, 1, 2, 3].map((k) => c + 1200 + 80 * k));
      for (const b of r.bursts.filter((b) => b.at < c + 3000)) expect(dist(b, { x: 320, y: 320 })).toBeLessThan(140);
      expect(r.notes.filter((n) => n.what === 'compromised' && n.tick < c + 3000)).toHaveLength(1);
    }
    expect(checked).toBe(true);
    // No mortar: the infantry within 800 m fires directly from 20 s on (no burst to see), the first round a near miss.
    const direct = watch(started(near('inf'), { seed: 7 }), 9000);
    const c = first(direct, 'compromised')!;
    expect(c).toMatchObject({ pid: 0, fire: 'direct' });
    expect(first(direct, 'near_miss')).toEqual({ type: 'post', tick: c.tick + 400, what: 'near_miss', fire: 'direct' });
    expect(direct.bursts).toEqual([]);
    // A recon team cannot fire: found, and nothing comes.
    const recon = watch(started(near('recon'), { seed: 7 }), 9000);
    expect(first(recon, 'compromised')).toMatchObject({ pid: 0, fire: null });
    expect(recon.notes.filter((n) => n.what !== 'compromised')).toEqual([]);
  });

  test('F-21: 발각과 보복 — 관측반 손실로 작전이 끝난다', () => {
    // Standing still under the mortar: on some seeds a round lands within 25 m and the 관측반 is lost (−400); 4 s later
    // the operation is over: the clock stops and every input is ignored. Others live through it.
    let lost = 0;
    let lived = 0;
    let far = 0; // the farthest round that hit: 25 m is the reach, not a few metres
    for (let seed = 1; seed <= 20; seed++) {
      const sim = started(withMortar, { seed });
      const r = watch(sim, 9000);
      const l = first(r, 'lost');
      if (!l) {
        lived++;
        continue;
      }
      lost++;
      expect(l).toEqual({ type: 'post', tick: l.tick, what: 'lost', cause: 'mortar' });
      expect(r.scores.get(l.tick)! - r.scores.get(l.tick - 1)!).toBe(-400);
      expect(sim.state.observerLost).toBe(true);
      expect(sim.state.phase).toBe('ended');
      expect(sim.state.tick).toBe(l.tick + 80);
      const hit = r.bursts.find((b) => b.at === l.tick)!;
      expect(dist(hit, sim.state.op)).toBeLessThan(25);
      far = Math.max(far, dist(hit, sim.state.op));
      const tick = sim.state.tick;
      expect(sim.step([{ a: 'cam', v: [100, 0] }]).accepted).toEqual([false]);
      expect(sim.state.tick).toBe(tick);
      // The replayer runs such a game to its end: the record stops at the end.
      if (lost === 1) expect(replay(replayData([{ t: 0, ...START }], tick + 200, seed), flatTerrain(), withMortar).record.ticks).toBe(tick);
    }
    expect(lost).toBeGreaterThan(0);
    expect(lived).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(10);
  });

  test('F-21: 아군 포탄의 관측소 오사', () => {
    // A mission on the post's own grid (위험근접: one adjusting round first): a round within 45 m puts the 관측반 out of
    // action 60 % of the time, drawn from the 탄도 stream only then (an empty field: nothing else draws at an impact).
    let lost = 0;
    let spared = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sim = empty(seed);
      openRadio(sim);
      toReady(sim, DESC_UNKNOWN, CALL_FFE, gridAt(sim.state.op));
      const bal = sim.state.rng.bal.count;
      const { impact } = untilImpact(sim);
      const d = dist(impact, sim.state.op);
      const drew = sim.state.rng.bal.count - bal - 4; // the round's own 공산오차: two gaussians (four draws) at the shot
      watch(sim, 1);
      if (d >= 45) {
        expect(drew, `seed ${seed}`).toBe(0);
        expect(sim.state.observerLost).toBe(false);
        continue;
      }
      expect(drew, `seed ${seed}`).toBe(1);
      if (sim.state.observerLost) lost++;
      else spared++;
    }
    expect(lost).toBeGreaterThan(0);
    expect(spared).toBeGreaterThan(0);
  });
});
