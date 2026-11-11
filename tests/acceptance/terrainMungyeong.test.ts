// 문경 지형 1판 as the app will see it: the committed 지형 파일 unpacked with the app's own unpackTerrain and checked
// on the contract's fields only. No import from the processing code, no network, no skip: a missing file fails.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { COVER, type Cover } from '@sim';
import { unpackTerrain } from '@adapters/terrainFile/unpack';

const terrain = unpackTerrain(new Uint8Array(readFileSync('src/adapters/realTerrain/mungyeong/terrain.bin')));
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const header = json('terrain/mungyeong/header.json');
const config = json('terrain/mungyeong/config.json');
const TOL = 0.001;

describe('문경 지형', () => {
  test('F-15: 문경 지형 — 숲 칸과 그 밖의 칸의 높이', async () => {
    const t = await terrain;
    const is = (k: number, c: Cover) => COVER[t.cover[k]!] === c;
    let forest = 0;
    for (let k = 0; k < t.n * t.n; k++) {
      const h = t.surface[k]! - t.ground[k]!;
      if (is(k, 'forest')) {
        forest++;
        if (!(h >= 12 - TOL && h < 17 + TOL)) expect.fail(`숲 칸 ${k}: 표면 − 지면 ${h}`);
        if (t.buildings[k] !== 0) expect.fail(`숲 칸 ${k}: 건물 높이 ${t.buildings[k]}`);
      } else if (!is(k, 'building')) {
        if (t.surface[k] !== t.ground[k] || t.buildings[k] !== 0) expect.fail(`칸 ${k} (${COVER[t.cover[k]!]}): 표면 ${t.surface[k]}, 지면 ${t.ground[k]}, 건물 ${t.buildings[k]}`);
      }
    }
    expect(forest).toBeGreaterThan(0);
    for (const { x, y } of config.clearings) expect(COVER[t.cover[Math.round(y / t.cell) * t.n + Math.round(x / t.cell)]!], `벌채 원 (${x}, ${y})`).not.toBe('forest');
  });

  test('F-25: 문경 지형 — 건물 칸의 높이', async () => {
    const t = await terrain;
    let built = 0;
    for (let k = 0; k < t.n * t.n; k++) {
      const building = COVER[t.cover[k]!] === 'building';
      if (building) {
        built++;
        if (!(t.buildings[k]! > 0)) expect.fail(`건물 칸 ${k}: 건물 높이 ${t.buildings[k]}`);
        if (!(Math.abs(t.surface[k]! - t.ground[k]! - t.buildings[k]!) <= TOL)) expect.fail(`건물 칸 ${k}: 표면 − 지면 ≠ 건물 높이`);
      } else if (t.buildings[k] !== 0) expect.fail(`칸 ${k}: 건물 칸이 아닌데 건물 높이 ${t.buildings[k]}`);
    }
    expect(built).toBeGreaterThan(0);
  });

  test('F-15: 문경 지형 — 불변 조건과 머리', async () => {
    const t = await terrain;
    const cells = t.n * t.n;
    for (const a of [t.ground, t.surface, t.buildings, t.cover]) expect(a.length).toBe(cells);
    const counts = COVER.map(() => 0);
    for (let k = 0; k < cells; k++) {
      if (![t.ground[k]!, t.surface[k]!, t.buildings[k]!].every(Number.isFinite)) expect.fail(`칸 ${k}: 유한하지 않은 값`);
      if (!(t.surface[k]! >= t.ground[k]!)) expect.fail(`칸 ${k}: 표면 < 지면`);
      if (!(t.buildings[k]! >= 0)) expect.fail(`칸 ${k}: 건물 높이 < 0`);
      if (!(t.cover[k]! < 7)) expect.fail(`칸 ${k}: 피복 번호 ${t.cover[k]}`);
      counts[t.cover[k]!]!++;
    }
    expect(header.coverCounts).toEqual(Object.fromEntries(COVER.map((c, i) => [c, counts[i]])));
    expect(header.ground.kind).toBe('DTM');
    expect(header.rules).toBe(2);
    expect(t.edge).toBe('veil');
    expect(t.credits).toHaveLength(3);
    for (const line of t.credits) expect(line.trim()).not.toBe('');
  });

  test('F-15: 문경 지형 — 피복 비율이 범위 안', async () => {
    const t = await terrain;
    const cells = t.n * t.n;
    const counts = COVER.map(() => 0);
    for (const c of t.cover) counts[c]!++;
    COVER.forEach((name, c) => {
      const share = Math.round((counts[c]! * 10000) / cells) / 100;
      const [lo, hi] = config.coverShare[name];
      expect(share, name).toBeGreaterThanOrEqual(lo);
      expect(share, name).toBeLessThanOrEqual(hi);
      expect(Math.round((hi - lo) * 100), name).toBeLessThanOrEqual(400); // 4 %p, in hundredths (no float residue)
    });
  });

  test('F-15: 문경 지형 — 방안 기준', async () => {
    const t = await terrain;
    const { letters, e0, n0 } = t.grid;
    expect(letters).toBe('CH');
    expect(e0 % 1000).toBe(header.frame.x0 % 1000);
    expect(n0 % 1000).toBe(header.frame.y0 % 1000);
    const size = t.n * t.cell;
    for (const p of [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: 0, y: size }, { x: size, y: size }]) {
      expect(e0 + p.x, `${p.x},${p.y}`).toBeGreaterThanOrEqual(0);
      expect(e0 + p.x, `${p.x},${p.y}`).toBeLessThanOrEqual(99999);
      expect(n0 + p.y, `${p.x},${p.y}`).toBeGreaterThanOrEqual(0);
      expect(n0 + p.y, `${p.x},${p.y}`).toBeLessThanOrEqual(99999);
    }
  });
});
