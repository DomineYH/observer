// 지도 바탕: the map's grid lines come from the conversion pair; contours every 20 m, darker every 100 m.
import { describe, expect, test } from 'vitest';
import { generateTerrain } from '@adapters/mock/terrain';
import { gridLines, mapBase } from '@render/map';
import { flatTerrain } from './terrain';

describe('F-06', () => {
  test('F-06: 지도 바탕', () => {
    const lines = gridLines(generateTerrain(20261106));
    const km = (axis: 'e' | 'n') => lines.filter((l) => l.axis === axis);
    expect(km('e').map((l) => l.label)).toEqual(['40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50']);
    expect(km('e').map((l) => l.at)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]);
    expect(km('n').map((l) => l.label)).toEqual(['30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40']);
    expect(km('n')[3]!.at).toBe(3000);

    // A 방안 기준 off the kilometre: lines and labels follow it
    const shifted = gridLines(flatTerrain({ n: 256, grid: { letters: 'CH', e0: 40500, n0: 29250 } }));
    expect(shifted.filter((l) => l.axis === 'e').map((l) => [l.label, l.at])).toEqual([['41', 500], ['42', 1500], ['43', 2500]]);
    expect(shifted.filter((l) => l.axis === 'n').map((l) => [l.label, l.at])).toEqual([['30', 750], ['31', 1750]]);

    // Contours on a slope rising 1 m per cell eastwards from 90 m
    const t = flatTerrain();
    for (let j = 0; j < t.n; j++) for (let i = 0; i < t.n; i++) t.ground[j * t.n + i] = 90 + i;
    const px = mapBase(t);
    expect(px).toHaveLength(t.n * t.n * 4);
    const lum = (i: number, j = 20) => {
      const o = ((t.n - 1 - j) * t.n + i) * 4; // north up
      return px[o]! + px[o + 1]! + px[o + 2]!;
    };
    const index = lum(9); // 99 → 100 m: 100 m contour
    const plain = lum(29); // 119 → 120 m: 20 m contour
    const none = lum(15);
    expect(index).toBeLessThan(plain);
    expect(plain).toBeLessThan(none);
  });
});
