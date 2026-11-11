// 문경 배치 on the committed 문경 지형: the 지형 파일 unpacked in Node with the app's own unpackTerrain, sight measured
// with the simulation's lineOfSight from the 계획 관측소's eye (3.5 m) to a standing man (ground + 1.7 × 0.85 m).
// No network, no skip: a missing file fails.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { COVER, createSim, EYE_HEIGHT, heightAt, lineOfSight, surfaceAt, underCanopy, type Point, type TerrainData } from '@sim';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { BASE_GUNS } from '@content/guns';
import { MOCK_PLACEMENT } from '@content/placement';
import { BASE_SCENARIO } from '@content/scenario';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';

const loaded = unpackTerrain(new Uint8Array(readFileSync('src/adapters/realTerrain/mungyeong/terrain.bin')));
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const header = json('terrain/mungyeong/header.json');
const config = json('terrain/mungyeong/config.json');
const expected = json('src/adapters/realTerrain/mungyeong/expected.json');
const { scenario: sc, terrain: ref } = MUNGYEONG_PLACEMENT;
const op = sc.plannedOp;
const posts = [op, ...(sc.reserveOps ?? [])];
const ROUTE_FRIEND = { A: 0, B: 1, C: 2 } as const; // 서 → 1소대, 중 → 2소대, 동 → 3소대
const BINO_M = 5670; // a standing man (1.7 m) at the 쌍안경 limit 0.3밀
const mortar = sc.units.find((u) => u.type === 'mortar')!;

const coverAt = (t: TerrainData, x: number, y: number) => {
  const c = (v: number) => Math.min(t.n - 1, Math.max(0, Math.round(v / t.cell)));
  return COVER[t.cover[c(y) * t.n + c(x)]!]!;
};
const house = (t: TerrainData, x: number, y: number) => ['village', 'building'].includes(coverAt(t, x, y));
const eyeOf = (t: TerrainData, p: Point) => ({ ...p, z: heightAt(t, p.x, p.y) + EYE_HEIGHT });
const seen = (t: TerrainData, x: number, y: number) => lineOfSight(t, eyeOf(t, op), { x, y, z: heightAt(t, x, y) + 1.7 * 0.85 });
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

describe('문경 배치', () => {
  test('배치: 문경 배치와 지형의 짝', async () => {
    const t = await loaded;
    expect(ref).toEqual({ id: t.id, version: t.version });
    expect(ref).toEqual({ id: header.id, version: header.version });
    expect(ref).toEqual({ id: expected.id, version: expected.version });
    expect(ref.version).toBe(config.version);
    expect({ id: sc.id, version: sc.version }).toEqual({ id: 'base-mungyeong', version: 1 });
    expect(sc.id).not.toBe(MOCK_PLACEMENT.scenario.id);
  });

  test('배치: 관측소', async () => {
    const t = await loaded;
    const size = (t.n - 1) * t.cell;
    expect(posts).toHaveLength(3);
    posts.forEach((p, i) => {
      for (const q of posts.slice(i + 1)) expect(dist(p, q), `${i}`).toBeGreaterThanOrEqual(1000);
      expect(Math.min(p.x, p.y, size - p.x, size - p.y), `${i}`).toBeGreaterThanOrEqual(200);
      expect(underCanopy(t, p.x, p.y), `${i}`).toBe(false);
    });
    const circles = posts.map((p, i) => ({ x: p.x, y: p.y, r: 100, kind: i ? 'reserve' : 'planned' }));
    expect(header.clearings).toEqual(circles);
    expect(config.clearings).toEqual(circles);
    for (const f of sc.friends) expect(op.y).toBeLessThan(f.y);
  }, 30_000);

  test('배치: 아군 진지', async () => {
    const t = await loaded;
    expect(sc.friends).toHaveLength(3);
    for (const f of sc.friends) {
      for (let u = -85; u <= 85; u += 5) expect(coverAt(t, f.x + u, f.y), `(${f.x}, ${f.y}) ${u}`).toMatch(/^(open|field|road)$/);
      expect(seen(t, f.x, f.y), `(${f.x}, ${f.y})`).toBe(true);
      expect(f.y).toBeLessThan(sc.frontY);
    }
  }, 30_000);

  test('배치: 접근로의 모양과 감수성', async () => {
    const t = await loaded;
    for (const [k, i] of Object.entries(ROUTE_FRIEND) as [keyof typeof ROUTE_FRIEND, number][]) {
      const r = sc.routes[k];
      const goal = r.at(-1)!;
      expect(goal, k).toEqual(sc.friends[i]);
      r.slice(1).forEach((p, q) => expect(dist(p, goal), `${k}[${q + 1}]`).toBeLessThan(dist(r[q]!, goal)));
      expect(lengthOf(r), k).toBeGreaterThanOrEqual(2500);
      expect(lengthOf(r), k).toBeLessThanOrEqual(4000);
      const on = samples(r, 5);
      expect(on.filter((p) => ['village', 'building', 'water'].includes(coverAt(t, p.x, p.y))), k).toEqual([]);
      for (const c of header.clearings) expect(on.filter((p) => dist(p, c) <= c.r), `${k} 벌채 원`).toEqual([]);
    }
  }, 30_000);

  test('배치: 접근로의 가시 기준', async () => {
    const t = await loaded;
    const score = (['A', 'B', 'C'] as const).map((k) => {
      const on = samples(sc.routes[k], 10);
      const last = samples(tail(sc.routes[k], 1500), 10);
      return {
        k,
        seen: share(on, (p) => seen(t, p.x, p.y)),
        forest: share(on, (p) => coverAt(t, p.x, p.y) === 'forest'),
        last: share(last, (p) => seen(t, p.x, p.y)),
      };
    });
    const good = score.filter((s) => s.seen >= 50 && s.forest <= 30);
    expect(good.length, JSON.stringify(score)).toBeGreaterThanOrEqual(2);
    for (const s of score) {
      expect(s.seen, JSON.stringify(s)).toBeGreaterThanOrEqual(40);
      expect(s.forest, JSON.stringify(s)).toBeLessThanOrEqual(35);
      expect(s.last, JSON.stringify(s)).toBeGreaterThanOrEqual(50);
    }
  }, 60_000);

  test('배치: 정찰조 자리', async () => {
    const t = await loaded;
    // the 정찰조 walks 서측 or 중앙 only
    expect(sc.units.find((u) => u.type === 'recon')).toMatchObject({ route: { first: 'A', second: 'B' } });
    for (const k of ['A', 'B'] as const) {
      const stop = sc.routes[k][1]!;
      expect(coverAt(t, stop.x, stop.y), k).not.toBe('forest');
      expect(seen(t, stop.x, stop.y), k).toBe(true);
      expect(dist(stop, op), k).toBeLessThanOrEqual(BINO_M);
      // the route's points are jittered 30 m: its leader is seen from every spot within 30 m (1 m grid over the disc
      // and every degree of its edge)
      const spots: Point[] = [];
      for (let v = -30; v <= 30; v++) for (let u = -30; u <= 30; u++) if (u * u + v * v <= 900) spots.push({ x: u, y: v });
      for (let a = 0; a < 360; a++) spots.push({ x: 30 * Math.cos((a * Math.PI) / 180), y: 30 * Math.sin((a * Math.PI) / 180) });
      const hidden = spots.filter((d) => !seen(t, stop.x + d.x, stop.y + d.y));
      expect(hidden, `${k} (${stop.x}, ${stop.y})`).toEqual([]);
    }
  }, 30_000);

  test('배치: NAI와 박격포 자리', async () => {
    const t = await loaded;
    sc.nais.forEach((n, i) => {
      expect(disc(n, n.r).filter((p) => house(t, p.x, p.y)), `NAI ${i + 1}`).toEqual([]);
      for (const c of header.clearings) expect(dist(n, c), `NAI ${i + 1}`).toBeGreaterThan(n.r + c.r);
    });
    if (mortar.type !== 'mortar') throw new Error('no mortar');
    const n = sc.nais[mortar.nai]!;
    const [hx, hy] = [mortar.spread.x / 2, mortar.spread.y / 2];
    expect(cells(n.x - hx - 100, n.x + hx + 100, n.y - hy - 100, n.y + hy + 100).filter((p) => house(t, p.x, p.y))).toEqual([]);
    // the simulation's own test for a spot in the open (deploy): surface less than 3 m above the ground here and 30 m
    // east, at continuous spots drawn evenly over the box; measured at the middle of every 1 m square
    const open = (x: number, y: number) => surfaceAt(t, x, y) - heightAt(t, x, y) < 3;
    let usable = 0;
    for (let v = 0.5; v < mortar.spread.y; v++) for (let u = 0.5; u < mortar.spread.x; u++) if (open(n.x - hx + u, n.y - hy + v) && open(n.x - hx + u + 30, n.y - hy + v)) usable++;
    // 13.5 %, not the ticket's 15 %: user decision on #82 (2026-11-11) — no box within 5.0 km reaches 15 % (best 13.94 %)
    expect((100 * usable) / (mortar.spread.x * mortar.spread.y)).toBeGreaterThanOrEqual(13.5);
    expect(dist(n, op)).toBeLessThanOrEqual(5000);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) expect(dist({ x: n.x + sx * hx, y: n.y + sy * hy }, op)).toBeLessThanOrEqual(5000);
  }, 30_000);

  test('배치: 보급 도로', async () => {
    const t = await loaded;
    const road = t.roads[sc.supplyRoad];
    expect(road).toBeDefined();
    const line = road!.line;
    for (const p of line) expect(p.y, `(${p.x}, ${p.y})`).toBeLessThan(sc.frontY - 200);
    expect(lengthOf(line)).toBeGreaterThanOrEqual(1500);
    expect(lengthOf(line)).toBeLessThanOrEqual(4000);
    expect(line[0]!.x).toBeLessThan(4000);
  }, 30_000);

  test('배치: 포대', async () => {
    const t = await loaded;
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

  test('배치: 입력 없는 한 판', async () => {
    const t = await loaded;
    const init = (seed: number) => ({ seed, seedKind: 'practice', scenario: sc, guns: BASE_GUNS, weather: CLEAR_WEATHER, mode: 'standard', terrain: t }) as const;
    for (let seed = 1; seed <= 30; seed++) {
      const m = createSim(init(seed)).state.platoons.find((p) => p.type === 'mortar')!;
      expect(underCanopy(t, m.x, m.y), `seed ${seed} (${m.x}, ${m.y})`).toBe(false);
    }
    const sim = createSim(init(1));
    sim.step([{ a: 'start', v: [op.x, op.y] }]);
    while (sim.state.phase === 'live') sim.step([]);
    expect(sim.state.phase).toBe('ended');
  }, 120_000);

  test('배치: 데모 값은 그대로', () => {
    const demo = ({ units, intelRoutes, nais }: typeof sc) => ({ units, intelRoutes, conf: nais.map((n) => n.conf) });
    expect(demo(sc)).toEqual(demo(BASE_SCENARIO));
    expect(mortar).toMatchObject({ spread: { x: 700, y: 500 } });
    expect(MUNGYEONG_PLACEMENT.briefing.routes).toEqual(MOCK_PLACEMENT.briefing.routes);
    expect(Object.keys(sc.routes)).toEqual(Object.keys(BASE_SCENARIO.routes));
    expect(sc.nais).toHaveLength(3);
  });
});
