// 배치 묶음: the 배치 tests over every 배치 of the 배치 목록, each on its own 전장's 지형 (#116 "지형 위의 검사").
// A real 지형 is its committed 지형 파일 unpacked in Node with the app's own unpackTerrain; sight is measured with the
// simulation's lineOfSight from the 계획 관측소's eye (3.5 m) to a standing man (ground + 1.7 × 0.85 m).
// No network, no skip: a missing file fails.
//
// | 대상                 | 검사 |
// | 모든 배치(mock 포함)  | 지형의 짝 · 정사각 안 · 포대 · 입력 없는 한 판 (`base`: 증인 = `골든: ③ 사격 없이 시간 한도까지`) |
// | 실제 지형의 모든 배치 | 관측소 · 아군 진지 · 접근로의 모양과 감수성 · 접근로의 가시 기준 · 정찰조 자리 · 장갑차 정지 자리 ·
// |                      | NAI와 박격포 자리 · 보급 도로 · 시드 서른의 박격포 자리 |
// | `base-mungyeong`에만 | 식별자와 버전 · 보급 도로의 첫 점 · 데모 값은 그대로 |
// | `base`에만           | 계획 관측소 = mock 지형의 관측소 고지 · 아군 진지 = mock 지형의 아군 고지 |
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { COVER, createSim, EYE_HEIGHT, heightAt, lineOfSight, surfaceAt, underCanopy, type Point, type RouteKey, type TerrainData, type UnitType } from '@sim';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { generateTerrain } from '@adapters/mock/terrain';
import { FRIEND_HILLS, OP_HILL } from '@adapters/mock/terrain/features';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { BASE_GUNS } from '@content/guns';
import { PLACEMENTS } from '@content/lookup';
import type { Placement } from '@content/placement';
import { BASE, BASE_SCENARIO } from '@content/scenarios/base';
import { BASE_MUNGYEONG } from '@content/scenarios/base-mungyeong';

/** Who stands in for a 배치's 입력 없는 한 판 instead of running it again here (#128 Q6). */
const NO_INPUT_RUN_WITNESS: Readonly<Record<string, string>> = { base: '골든: ③ 사격 없이 시간 한도까지' };

/** 기본값 of the checks a 배치 may be excepted from, and 예외 표: every 배치 that misses one, with its decision. */
const DEFAULTS = { mortarUsable: 15 } as const;
const EXCEPTIONS: readonly { placement: string; check: keyof typeof DEFAULTS; value: number; decision: string }[] = [
  // no box within 5.0 km reaches 15 % (best 13.94 %): user decision on #82 (2026-11-11)
  { placement: 'base-mungyeong', check: 'mortarUsable', value: 13.5, decision: 'https://github.com/DomineYH/observer/issues/82' },
];
const exceptionOf = (id: string, check: keyof typeof DEFAULTS) => EXCEPTIONS.find((e) => e.placement === id && e.check === check);

const BINO_M = 5670; // a standing man (1.7 m) at the 쌍안경 limit 0.3밀
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const isReal = (p: Placement) => p.terrain.id !== 'mock';
const loaded = new Map<string, Promise<TerrainData>>();
/** The 배치's 지형: a real 전장's 지형 파일, or the mock generator at seed 1 (its authored features stay put for every seed). */
const terrainOf = (p: Placement): Promise<TerrainData> => {
  const id = p.terrain.id;
  if (!loaded.has(id))
    loaded.set(id, isReal(p) ? unpackTerrain(new Uint8Array(readFileSync(`src/adapters/realTerrain/${id}/terrain.bin`))) : Promise.resolve(generateTerrain(1)));
  return loaded.get(id)!;
};

const coverAt = (t: TerrainData, x: number, y: number) => {
  const c = (v: number) => Math.min(t.n - 1, Math.max(0, Math.round(v / t.cell)));
  return COVER[t.cover[c(y) * t.n + c(x)]!]!;
};
const house = (t: TerrainData, x: number, y: number) => ['village', 'building'].includes(coverAt(t, x, y));
const eyeOf = (t: TerrainData, p: Point) => ({ ...p, z: heightAt(t, p.x, p.y) + EYE_HEIGHT });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const lengthOf = (pts: readonly Point[]) => pts.slice(1).reduce((s, p, k) => s + dist(p, pts[k]!), 0);
/** Points every `step` m along the line, its last point included. */
const samples = (pts: readonly Point[], step: number): Point[] => {
  const out: Point[] = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s]!, b = pts[s + 1]!, d = dist(a, b);
    for (let m = 0; m < d; m += step) out.push({ x: a.x + ((b.x - a.x) * m) / d, y: a.y + ((b.y - a.y) * m) / d });
  }
  return [...out, pts.at(-1)!];
};
/** The last `m` metres of the line. */
const tail = (pts: readonly Point[], m: number): Point[] => {
  const out = [pts.at(-1)!];
  for (let q = pts.length - 1; q > 0 && m > 0; q--) {
    const a = pts[q]!, b = pts[q - 1]!, d = dist(a, b);
    if (d <= m) out.unshift(b);
    else out.unshift({ x: a.x + ((b.x - a.x) * m) / d, y: a.y + ((b.y - a.y) * m) / d });
    m -= d;
  }
  return out;
};
const share = (pts: readonly Point[], f: (p: Point) => boolean) => (100 * pts.filter(f).length) / pts.length;
/** Every 10 m cell centre in the box `[x0, x1] × [y0, y1]`. */
const cells = (x0: number, x1: number, y0: number, y1: number): Point[] => {
  const out: Point[] = [];
  for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) out.push({ x, y });
  return out;
};
const disc = (c: Point, r: number) => cells(c.x - r, c.x + r, c.y - r, c.y + r).filter((p) => dist(p, c) <= r);
/** The 1 m grid points within 30 m of the origin. */
const grid30: Point[] = [];
for (let v = -30; v <= 30; v++) for (let u = -30; u <= 30; u++) if (u * u + v * v <= 900) grid30.push({ x: u, y: v });
/** Every 접근로 a unit of this type can walk. */
const routesOf = (p: Placement, type: UnitType): RouteKey[] => {
  const picks = p.scenario.units.flatMap((u) => (u.type === type && 'route' in u ? [u.route] : []));
  return [...new Set(picks.flatMap((r) => (typeof r === 'string' ? [r] : [r.first, r.second])))];
};
/** The 벌채 원 a 전장's 지형 must carry: one per 관측소 (계획·예비) of every 배치 laid on it, `kind` left out. */
const clearingsOf = (terrainId: string) => {
  const key = (c: Point) => `${c.x},${c.y}`;
  const posts = PLACEMENTS.filter((p) => p.terrain.id === terrainId).flatMap((p) => [p.scenario.plannedOp, ...(p.scenario.reserveOps ?? [])]);
  return [...new Map(posts.map((c) => [key(c), { x: c.x, y: c.y, r: 100 }])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
};
const circlesOf = (list: readonly { x: number; y: number; r: number }[]) => list.map(({ x, y, r }) => ({ x, y, r })).sort((a, b) => a.x - b.x || a.y - b.y);

for (const pl of PLACEMENTS) {
  const sc = pl.scenario;
  const op = sc.plannedOp;
  const posts = [op, ...(sc.reserveOps ?? [])];
  const routes = Object.entries(sc.routes) as [RouteKey, readonly Point[]][];
  const seen = (t: TerrainData, x: number, y: number) => lineOfSight(t, eyeOf(t, op), { x, y, z: heightAt(t, x, y) + 1.7 * 0.85 });
  const init = (t: TerrainData, seed: number) => ({ seed, seedKind: 'practice', scenario: sc, guns: BASE_GUNS, weather: CLEAR_WEATHER, mode: 'standard', terrain: t }) as const;
  const real = isReal(pl);
  const files = real ? { header: json(`terrain/${pl.terrain.id}/header.json`), config: json(`terrain/${pl.terrain.id}/config.json`), expected: json(`src/adapters/realTerrain/${pl.terrain.id}/expected.json`) } : null;

  describe(`${sc.id}@${sc.version} 배치`, () => {
    test('배치: 지형의 짝', async () => {
      const t = await terrainOf(pl);
      expect(pl.terrain).toEqual({ id: t.id, version: t.version });
      if (!files) return;
      expect(pl.terrain).toEqual({ id: files.header.id, version: files.header.version });
      expect(pl.terrain).toEqual({ id: files.expected.id, version: files.expected.version });
      expect(pl.terrain.version).toBe(files.config.version);
    }, 30_000);

    test('배치: 정사각 안', async () => {
      const t = await terrainOf(pl);
      const size = (t.n - 1) * t.cell;
      const inside = (p: Point) => p.x >= 0 && p.y >= 0 && p.x <= size && p.y <= size;
      posts.forEach((p, i) => expect(Math.min(p.x, p.y, size - p.x, size - p.y), `관측소 ${i}`).toBeGreaterThanOrEqual(200));
      const rest = [sc.fixedPoint, ...sc.friends, ...sc.nais, ...routes.flatMap(([, r]) => r)];
      expect(rest.filter((p) => !inside(p))).toEqual([]);
    }, 30_000);

    test('배치: 포대', async () => {
      const t = await terrainOf(pl);
      const size = (t.n - 1) * t.cell;
      expect(sc.battery.y).toBeLessThan(0);
      expect(sc.battery.x).toBeGreaterThanOrEqual(0);
      expect(sc.battery.x).toBeLessThanOrEqual(size);
      const { e0, n0 } = t.grid;
      for (const v of [e0 + sc.battery.x, n0 + sc.battery.y]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(99999);
      }
    }, 30_000);

    // 증인이 있는 배치는 다시 돌리지 않는다: its run is the witness test's.
    test.skipIf(sc.id in NO_INPUT_RUN_WITNESS)('배치: 입력 없는 한 판', async () => {
      const sim = createSim(init(await terrainOf(pl), 1));
      sim.step([{ a: 'start', v: [op.x, op.y] }]);
      while (sim.state.phase === 'live') sim.step([]);
      expect(sim.state.phase).toBe('ended');
    }, 120_000);

    if (!files) return;
    const { header, config } = files;

    test('배치: 관측소', async () => {
      const t = await terrainOf(pl);
      posts.forEach((p, i) => {
        for (const q of posts.slice(i + 1)) expect(dist(p, q), `${i}`).toBeGreaterThanOrEqual(1000);
        expect(underCanopy(t, p.x, p.y), `${i}`).toBe(false);
      });
      expect(circlesOf(header.clearings)).toEqual(clearingsOf(pl.terrain.id));
      expect(circlesOf(config.clearings)).toEqual(clearingsOf(pl.terrain.id));
      for (const f of sc.friends) expect(op.y).toBeLessThan(f.y);
    }, 30_000);

    test('배치: 아군 진지', async () => {
      const t = await terrainOf(pl);
      for (const f of sc.friends) {
        for (let u = -85; u <= 85; u += 5) expect(coverAt(t, f.x + u, f.y), `(${f.x}, ${f.y}) ${u}`).toMatch(/^(open|field|road)$/);
        expect(seen(t, f.x, f.y), `(${f.x}, ${f.y})`).toBe(true);
        expect(f.y).toBeLessThan(sc.frontY);
      }
    }, 30_000);

    test('배치: 접근로의 모양과 감수성', async () => {
      const t = await terrainOf(pl);
      // the i-th 접근로 ends on the i-th 아군 진지
      routes.forEach(([k, r], i) => {
        const goal = r.at(-1)!;
        expect(goal, k).toEqual(sc.friends[i]);
        r.slice(1).forEach((p, q) => expect(dist(p, goal), `${k}[${q + 1}]`).toBeLessThan(dist(r[q]!, goal)));
        expect(lengthOf(r), k).toBeGreaterThanOrEqual(2500);
        expect(lengthOf(r), k).toBeLessThanOrEqual(4000);
        const on = samples(r, 5);
        expect(on.filter((p) => ['village', 'building', 'water'].includes(coverAt(t, p.x, p.y))), k).toEqual([]);
        for (const c of header.clearings) expect(on.filter((p) => dist(p, c) <= c.r), `${k} 벌채 원`).toEqual([]);
      });
    }, 30_000);

    test('배치: 접근로의 가시 기준', async () => {
      const t = await terrainOf(pl);
      const score = routes.map(([k, r]) => {
        const on = samples(r, 10);
        const last = samples(tail(r, 1500), 10);
        return {
          k,
          seen: share(on, (p) => seen(t, p.x, p.y)),
          forest: share(on, (p) => coverAt(t, p.x, p.y) === 'forest'),
          last: share(last, (p) => seen(t, p.x, p.y)),
        };
      });
      const good = score.filter((s) => s.seen >= 50 && s.forest <= 30);
      expect(good.length, JSON.stringify(score)).toBeGreaterThanOrEqual(Math.min(2, routes.length));
      for (const s of score) {
        expect(s.seen, JSON.stringify(s)).toBeGreaterThanOrEqual(40);
        expect(s.forest, JSON.stringify(s)).toBeLessThanOrEqual(35);
        expect(s.last, JSON.stringify(s)).toBeGreaterThanOrEqual(50);
      }
    }, 60_000);

    test('배치: 정찰조 자리', async () => {
      const t = await terrainOf(pl);
      // the route's points are jittered 30 m: its leader is seen from every spot within 30 m (1 m grid over the disc
      // and every degree of its edge)
      const spots = [...grid30];
      for (let a = 0; a < 360; a++) spots.push({ x: 30 * Math.cos((a * Math.PI) / 180), y: 30 * Math.sin((a * Math.PI) / 180) });
      for (const k of routesOf(pl, 'recon')) {
        const stop = sc.routes[k]![1]!;
        expect(coverAt(t, stop.x, stop.y), k).not.toBe('forest');
        expect(seen(t, stop.x, stop.y), k).toBe(true);
        expect(dist(stop, op), k).toBeLessThanOrEqual(BINO_M);
        const hidden = spots.filter((d) => !seen(t, stop.x + d.x, stop.y + d.y));
        expect(hidden, `${k} (${stop.x}, ${stop.y})`).toEqual([]);
      }
    }, 30_000);

    test('배치: 장갑차 정지 자리', async () => {
      const t = await terrainOf(pl);
      const apcSeen = (x: number, y: number) => lineOfSight(t, eyeOf(t, op), { x, y, z: heightAt(t, x, y) + 2.3 * 0.85 });
      /** Where the APC halts on route `k` with no jitter: the simulation's own walk (enemy.ts moveAlong, the halt under
       * APC_HALT_M and the move on the switching tick) with its platoon's path set to the scenario's points. */
      const haltOf = (k: RouteKey) => {
        const sim = createSim(init(t, 1));
        const apc = sim.state.platoons.find((p) => p.type === 'apc')!;
        const path = sc.routes[k]!.map((p) => ({ ...p }));
        Object.assign(apc, { route: k, path, x: path[0]!.x, y: path[0]!.y, wp: 1, t0: 0 });
        sim.step([{ a: 'start', v: [op.x, op.y] }]);
        while (apc.state === 'wait' || apc.state === 'approach') {
          expect(sim.state.phase, k).toBe('live');
          sim.step([]);
        }
        expect(apc.state, k).toBe('support');
        return { x: apc.x, y: apc.y };
      };
      // A nominal robustness measure, not a promise for every seed: deploy jitters each route point by a Gaussian of σ 30 m
      // per coordinate. The halt is seen, and so are 90 % of the 1 m grid points within 30 m of it (user decision on #100).
      for (const k of routesOf(pl, 'apc')) {
        const stop = haltOf(k);
        const at = `${k} (${stop.x.toFixed(1)}, ${stop.y.toFixed(1)})`;
        expect(apcSeen(stop.x, stop.y), at).toBe(true);
        expect(share(grid30, (d) => apcSeen(stop.x + d.x, stop.y + d.y)), at).toBeGreaterThanOrEqual(90);
      }
    }, 60_000);

    test('배치: NAI와 박격포 자리', async () => {
      const t = await terrainOf(pl);
      sc.nais.forEach((n, i) => {
        expect(disc(n, n.r).filter((p) => house(t, p.x, p.y)), `NAI ${i + 1}`).toEqual([]);
        for (const c of header.clearings) expect(dist(n, c), `NAI ${i + 1}`).toBeGreaterThan(n.r + c.r);
      });
      // the simulation's own test for a spot in the open (deploy): surface less than 3 m above the ground here and 30 m
      // east, at continuous spots drawn evenly over the box; measured at the middle of every 1 m square
      const open = (x: number, y: number) => surfaceAt(t, x, y) - heightAt(t, x, y) < 3;
      const exception = exceptionOf(sc.id, 'mortarUsable');
      for (const mortar of sc.units) {
        if (mortar.type !== 'mortar') continue;
        const n = sc.nais[mortar.nai]!;
        const [hx, hy] = [mortar.spread.x / 2, mortar.spread.y / 2];
        expect(cells(n.x - hx - 100, n.x + hx + 100, n.y - hy - 100, n.y + hy + 100).filter((p) => house(t, p.x, p.y))).toEqual([]);
        let usable = 0;
        for (let v = 0.5; v < mortar.spread.y; v++) for (let u = 0.5; u < mortar.spread.x; u++) if (open(n.x - hx + u, n.y - hy + v) && open(n.x - hx + u + 30, n.y - hy + v)) usable++;
        const pct = (100 * usable) / (mortar.spread.x * mortar.spread.y);
        expect(pct).toBeGreaterThanOrEqual(exception?.value ?? DEFAULTS.mortarUsable);
        // an 예외 표 row is there only while the 배치 misses the 기본값
        if (exception) expect(pct).toBeLessThan(DEFAULTS.mortarUsable);
        expect(dist(n, op)).toBeLessThanOrEqual(5000);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) expect(dist({ x: n.x + sx * hx, y: n.y + sy * hy }, op)).toBeLessThanOrEqual(5000);
      }
    }, 30_000);

    test('배치: 보급 도로', async () => {
      const t = await terrainOf(pl);
      const road = t.roads[sc.supplyRoad];
      expect(road).toBeDefined();
      const line = road!.line;
      for (const p of line) expect(p.y, `(${p.x}, ${p.y})`).toBeLessThan(sc.frontY - 200);
      expect(lengthOf(line)).toBeGreaterThanOrEqual(1500);
      expect(lengthOf(line)).toBeLessThanOrEqual(4000);
    }, 30_000);

    test('배치: 시드 서른의 박격포 자리', async () => {
      const t = await terrainOf(pl);
      for (let seed = 1; seed <= 30; seed++)
        for (const m of createSim(init(t, seed)).state.platoons.filter((p) => p.type === 'mortar'))
          expect(underCanopy(t, m.x, m.y), `seed ${seed} (${m.x}, ${m.y})`).toBe(false);
    }, 60_000);
  });
}

describe('base 배치에만', () => {
  test('배치: 기본 배치의 계획 관측소는 mock 지형의 관측소 고지다', () => {
    expect(BASE.terrain.id).toBe('mock');
    expect(BASE.scenario.plannedOp).toEqual(OP_HILL);
  });

  test('배치: 기본 배치의 아군 진지는 mock 지형의 아군 고지다', () => {
    expect(BASE.scenario.friends).toEqual(FRIEND_HILLS);
  });
});

describe('base-mungyeong 배치에만', () => {
  const sc = BASE_MUNGYEONG.scenario;
  const mortar = sc.units.find((u) => u.type === 'mortar')!;

  test('배치: 문경 배치의 식별자와 버전', () => {
    expect({ id: sc.id, version: sc.version }).toEqual({ id: 'base-mungyeong', version: 2 });
    expect(sc.id).not.toBe(BASE.scenario.id);
  });

  test('배치: 문경 보급 도로의 첫 점', async () => {
    const t = await terrainOf(BASE_MUNGYEONG);
    expect(t.roads[sc.supplyRoad]!.line[0]!.x).toBeLessThan(4000);
  }, 30_000);

  test('배치: 데모 값은 그대로', () => {
    const demo = ({ units, intelRoutes, nais }: typeof sc) => ({ units, intelRoutes, conf: nais.map((n) => n.conf) });
    expect(demo(sc)).toEqual(demo(BASE_SCENARIO));
    expect(mortar).toMatchObject({ spread: { x: 700, y: 500 } });
    expect(BASE_MUNGYEONG.briefing.routes).toEqual(BASE.briefing.routes);
    expect(Object.keys(sc.routes)).toEqual(Object.keys(BASE_SCENARIO.routes));
    expect(sc.nais).toHaveLength(3);
  });
});

describe('배치 예외 표', () => {
  test('배치: NAI와 박격포 자리 — 예외 표의 줄마다 배치와 결정 링크가 있다', () => {
    expect(EXCEPTIONS[0]).toEqual({ placement: 'base-mungyeong', check: 'mortarUsable', value: 13.5, decision: 'https://github.com/DomineYH/observer/issues/82' });
    for (const e of EXCEPTIONS) {
      expect(PLACEMENTS.map((p) => p.scenario.id)).toContain(e.placement);
      expect(e.decision).toMatch(/^https:\/\/github\.com\/DomineYH\/observer\/issues\/\d+/);
      expect(e.value).toBeLessThan(DEFAULTS[e.check]);
    }
  });
});
