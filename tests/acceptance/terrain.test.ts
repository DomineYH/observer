// The mock 지형 원천 seam: 지형 해시, 마을과 도로, 방안 하나 불변 조건.
import { describe, expect, test } from 'vitest';
import { COVER, terrainHash, type TerrainData } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { readGolden } from '../golden/golden';

const SEED = 20261106;
const terrain = await mockTerrain.load(SEED); // through the 지형 원천 interface

describe('F-15', () => {
  test('F-15: 지형 해시는 시드로 정해진다', async () => {
    expect(terrain.n).toBe(1024);
    expect(terrain.cell).toBe(10);
    for (const a of [terrain.ground, terrain.surface, terrain.cover, terrain.buildings]) expect(a.length).toBe(1024 * 1024);
    const hash = terrainHash(terrain);
    // The engines job checks the same golden header in Chromium, Firefox and WebKit.
    expect(hash).toBe(readGolden('0-empty.json').terrainHash);
    expect(terrainHash(await mockTerrain.load(SEED))).toBe(hash);
    expect(terrainHash(await mockTerrain.load(SEED + 1))).not.toBe(hash);
  }, 30_000); // about 1.7 s alone: two more 1024×1024 generations, slower when other jobs share the machine
});

describe('F-25', () => {
  test('F-25: 마을과 도로', () => {
    const { n, cell, ground, surface, cover, buildings } = terrain;
    const at = (x: number, y: number) => ((y / cell) | 0) * n + ((x / cell) | 0);
    const is = (k: number, c: (typeof COVER)[number]) => cover[k] === COVER.indexOf(c);
    expect(terrain.villages.map((v) => v.name)).toEqual(['청계읍', '새터마을', '솔미리', '아랫말', '갈골', '북원리', '윗말']);
    expect(terrain.roads).toHaveLength(6);
    for (const road of terrain.roads) {
      expect(road.line.length).toBeGreaterThan(10);
      for (const p of road.line) if (p.x >= 0 && p.y >= 0 && p.x < n * cell && p.y < n * cell) expect(is(at(p.x, p.y), 'road')).toBe(true);
    }
    for (const v of terrain.villages) {
      let houses = 0;
      for (let y = v.y - v.r; y <= v.y + v.r; y += cell)
        for (let x = v.x - v.r; x <= v.x + v.r; x += cell) if (buildings[at(x, y)]! > 0) houses++;
      expect(houses, v.name).toBeGreaterThan(0);
    }
    let built = 0;
    for (let k = 0; k < n * n; k++) {
      if (buildings[k]! > 0) {
        built++;
        expect(is(k, 'building')).toBe(true);
        expect(surface[k]).toBe(Math.fround(ground[k]! + buildings[k]!)); // 건물이 표면 높이에 들어간다
      } else if (is(k, 'road') || is(k, 'village')) expect(surface[k]).toBe(ground[k]); // no canopy on roads and villages
    }
    expect(built).toBeGreaterThan(200);
  });
});

describe('좌표', () => {
  test('좌표: 방안 하나 불변 조건', () => {
    const { e0, n0 } = terrain.grid;
    const size = terrain.n * terrain.cell;
    // 전장 전체: the map's corners and the 포대 off the map to the south
    const battlefield = [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: 0, y: size }, { x: size, y: size }, BASE_SCENARIO.battery];
    for (const p of battlefield) {
      expect(e0 + p.x, `${p.x},${p.y}`).toBeGreaterThanOrEqual(0);
      expect(e0 + p.x, `${p.x},${p.y}`).toBeLessThanOrEqual(99999);
      expect(n0 + p.y, `${p.x},${p.y}`).toBeGreaterThanOrEqual(0);
      expect(n0 + p.y, `${p.x},${p.y}`).toBeLessThanOrEqual(99999);
    }
  });
});

describe('지형 계약', () => {
  test('지형 계약: mock의 값', () => {
    expect(terrain.id).toBe('mock');
    expect(terrain.version).toBe(1);
    expect(terrain.credits).toEqual([]);
    expect(terrain.names).toEqual([]);
    expect(terrain.edge).toBe('mirror');
    expect(terrain.roads).toHaveLength(6);
    for (const road of terrain.roads) {
      expect(road.class).toBe('main');
      expect(road.line.length).toBeGreaterThan(10);
    }
  });

  test('지형 계약: 해시의 꼬리 덩이', () => {
    const H = readGolden('0-empty.json').terrainHash;
    const [first, ...rest] = terrain.roads;
    const trunk: TerrainData = { ...terrain, roads: [{ ...first!, class: 'trunk' }, ...rest] };
    const named: TerrainData = { ...terrain, names: [{ name: '주흘산', x: 5000, y: 6000, kind: 'peak' }] };
    const veiled: TerrainData = { ...terrain, edge: 'veil' };
    const relabelled: TerrainData = { ...terrain, id: 'x', version: 9, credits: ['c'] };
    expect(terrainHash(terrain)).toBe(H);
    expect(terrainHash(relabelled)).toBe(H); // 전장 식별자, 지형 판, 출처 문구 are not hashed
    const tails = [trunk, named, veiled].map(terrainHash);
    for (const h of tails) expect(h).not.toBe(H);
    expect(new Set(tails).size).toBe(3);
  }, 30_000);
});
