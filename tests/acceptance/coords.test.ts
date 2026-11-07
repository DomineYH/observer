import { describe, expect, test } from 'vitest';
import { COVER, fromGrid, heightAt, lineOfSight, surfaceAt, toGrid, type Cover, type TerrainData } from '@sim';
import { flatTerrain } from './terrain';

const CH = { letters: 'CH', e0: 40000, n0: 30000 };

describe('좌표', () => {
  test('좌표: 변환 한 쌍', () => {
    // 미터→좌표는 버림
    expect(toGrid(0, 0, CH)).toEqual({ e: 4000, n: 3000 });
    expect(toGrid(9.99, 9.99, CH)).toEqual({ e: 4000, n: 3000 });
    expect(toGrid(10, 19.99, CH)).toEqual({ e: 4001, n: 3001 });
    expect(toGrid(-1, -1, CH)).toEqual({ e: 3999, n: 2999 });
    expect(toGrid(5123, 1807, CH)).toEqual({ e: 4512, n: 3180 });
    // 좌표→미터는 칸 중심 (+5 m), 어떤 숫자든 그대로
    expect(fromGrid(4000, 3000, CH)).toEqual({ x: 5, y: 5 });
    expect(fromGrid(4512, 3180, CH)).toEqual({ x: 5125, y: 1805 });
    expect(fromGrid(0, 0, CH)).toEqual({ x: -39995, y: -29995 });
    for (const e of [0, 4000, 5023, 9999])
      for (const n of [0, 3000, 7071, 9999]) {
        const p = fromGrid(e, n, CH);
        expect(toGrid(p.x, p.y, CH)).toEqual({ e, n });
      }
  });
});

describe('F-15', () => {
  test('F-15: 높이 질의', () => {
    const t = flatTerrain();
    // ground rises 1 m per cell eastwards; surface adds a 12 m canopy everywhere
    for (let j = 0; j < t.n; j++)
      for (let i = 0; i < t.n; i++) {
        t.ground[j * t.n + i] = 100 + i;
        t.surface[j * t.n + i] = 112 + i;
      }
    expect(heightAt(t, 200, 300)).toBe(120);
    expect(heightAt(t, 205, 300)).toBe(120.5);
    expect(heightAt(t, 207.5, 304)).toBe(120.75);
    expect(surfaceAt(t, 205, 300)).toBe(132.5);
  });

  test('F-15: 가시선', () => {
    const a = { x: 50, y: 320, z: 103.5 };
    const b = { x: 590, y: 320, z: 101 };
    const wall = (t: TerrainData, dz: { ground: number; surface: number }, cover: Cover, building = 0) => {
      for (let j = 0; j < t.n; j++) {
        const k = j * t.n + 32; // the column at x = 320
        t.ground[k] = t.ground[k]! + dz.ground;
        t.surface[k] = t.surface[k]! + dz.surface;
        t.cover[k] = COVER.indexOf(cover);
        t.buildings[k] = building;
      }
      return t;
    };
    expect(lineOfSight(flatTerrain(), a, b)).toBe(true);
    // 지형
    expect(lineOfSight(wall(flatTerrain(), { ground: 10, surface: 10 }, 'open'), a, b)).toBe(false);
    // 숲: the ground is unchanged, only the canopy blocks
    const forest = wall(flatTerrain(), { ground: 0, surface: 12 }, 'forest');
    expect(heightAt(forest, 320, 320)).toBe(100);
    expect(lineOfSight(forest, a, b)).toBe(false);
    // 건물
    expect(lineOfSight(wall(flatTerrain(), { ground: 0, surface: 8 }, 'building', 8), a, b)).toBe(false);
    // a low hedge under the sight line does not block
    expect(lineOfSight(wall(flatTerrain(), { ground: 0, surface: 1 }, 'forest'), a, b)).toBe(true);
  });
});
