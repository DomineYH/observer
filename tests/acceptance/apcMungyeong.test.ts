// 장갑차 선두 (`apc-mungyeong`, #127): its 편제, 시간표 and 증원 on the committed 문경 지형 파일, through the simulation's
// public interface.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { createSim, type SimInit, type TerrainData } from '@sim';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { COMBAT } from '@content/combat';
import { BASE_GUNS } from '@content/guns';
import { PLACEMENTS } from '@content/lookup';
import { unitName } from '@ui/debrief';

const placement = PLACEMENTS.find((p) => p.scenario.id === 'apc-mungyeong');
let land: Promise<TerrainData> | undefined;
const terrain = () => (land ??= unpackTerrain(new Uint8Array(readFileSync('src/adapters/realTerrain/mungyeong/terrain.bin'))));
const initOf = async (seed: number, mode: 'standard' | 'combat' = 'standard'): Promise<SimInit> => ({
  seed,
  seedKind: 'practice',
  scenario: placement!.scenario,
  guns: BASE_GUNS,
  weather: CLEAR_WEATHER,
  mode,
  terrain: await terrain(),
  ...(mode === 'combat' ? { combat: COMBAT } : {}),
});
const start = () => ({ a: 'start', v: [placement!.scenario.plannedOp.x, placement!.scenario.plannedOp.y] }) as const;

describe('장갑차 선두', () => {
  test('시나리오: 장갑차 선두의 편제', async () => {
    expect(placement?.terrain).toEqual({ id: 'mungyeong', version: 2 });
    const routes = { apc2: new Set<string>(), inf: new Set<string>() };
    for (let seed = 1; seed <= 30; seed++) {
      const { platoons, friendlies } = createSim(await initOf(seed)).state;
      expect(platoons.map((p) => p.type), `${seed}`).toEqual(['recon', 'apc', 'apc', 'inf', 'mortar']);
      expect(platoons.reduce((n, p) => n + p.members.length, 0), `${seed}`).toBe(50);
      expect(friendlies, `${seed}`).toHaveLength(48);
      expect([platoons[0]!.route, platoons[1]!.route], `${seed}`).toEqual(['A', 'A']);
      routes.apc2.add(platoons[2]!.route!);
      routes.inf.add(platoons[3]!.route!);
      const names = platoons.map((_, pid) => unitName(platoons, pid));
      expect(names[1], `${seed}`).not.toBe(names[2]);
    }
    expect([...routes.apc2].sort()).toEqual(['A', 'B']);
    expect([...routes.inf].sort()).toEqual(['A', 'B']);
  }, 60_000);

  test('시나리오: 장갑차 선두의 시간표', async () => {
    const sim = createSim(await initOf(20261106));
    sim.step([start()]);
    const set: number[] = sim.state.platoons.map(() => -1);
    let firstFire = -1;
    while (sim.state.tick <= 3000) {
      sim.state.platoons.forEach((p, i) => {
        if (set[i] === -1 && p.state !== 'wait') set[i] = sim.state.tick;
      });
      sim.step([]);
      const mortar = sim.state.platoons[4]!;
      if (firstFire === -1 && mortar.lastFire >= 0) firstFire = mortar.lastFire;
    }
    // The second each combat unit sets off: the first tick after 작전 개시 for the 0 s 정찰조.
    expect(set.slice(0, 4).map((t) => t / 20)).toEqual([0.05, 60, 150, 120]);
    expect(firstFire).toBe(3000); // 사격 개시 150 s, none before
    expect(sim.state.phase).toBe('live');
  }, 60_000);
});

describe('장갑차 선두의 실전', () => {
  test('실전: 장갑차 선두의 증원', async () => {
    for (const seed of [20261106, 1]) {
      const standard = createSim(await initOf(seed));
      const combat = createSim(await initOf(seed, 'combat'));
      const { platoons } = combat.state;
      expect(platoons, `${seed}`).toHaveLength(6);
      expect(platoons.slice(0, 5), `${seed}`).toEqual(standard.state.platoons);
      expect(combat.state.friendlies, `${seed}`).toEqual(standard.state.friendlies);
      expect(platoons[5], `${seed}`).toMatchObject({ type: 'inf', state: 'wait', t0: 4800 });
      expect(['A', 'B'], `${seed}`).toContain(platoons[5]!.route);
      expect(unitName(platoons, 5), `${seed}`).toBe('적 2소대');
    }
    // It sets off at tick 4800, not before.
    const sim = createSim(await initOf(20261106, 'combat'));
    sim.step([start()]);
    const reinforcement = sim.state.platoons[5]!;
    while (sim.state.tick < 4799) sim.step([]);
    expect(reinforcement.state).toBe('wait');
    sim.step([]);
    expect(reinforcement.state).toBe('approach');
  }, 60_000);
});
