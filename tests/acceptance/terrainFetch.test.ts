// The 받기 seam (npm run terrain:fetch): reading arithmetic on synthetic rasters, the four stops on fake sources, and
// the committed 원자료 스냅샷 read in Node. No test here touches the network.
import { describe, expect, test } from 'vitest';
import { readConfig } from '../../terrain/pipeline/config';
import { bilinear, nearest, nodeLonLat, rasterOf, windowOf, type Geo } from '../../terrain/pipeline/fetch/sample';

// 4×3, values not linear in either direction, so a wrong weight shows.
const DATA = [1, 2, 4, 8, 3, 7, 13, 21, 10, 20, 31, 45];
const geo = (point: boolean): Geo => ({ originX: 128, originY: 37, resX: 0.001, resY: -0.001, width: 4, height: 3, point });

describe('받기', () => {
  test('받기: 합성 래스터의 이중선형과 최근접', () => {
    const full = windowOf(geo(true), [127, 36, 129, 38]);
    expect(full).toEqual([0, 0, 4, 3]); // clipped at the image edge
    const pt = rasterOf(geo(true), full, DATA, null);
    expect(pt.col(128.0015)).toBeCloseTo(1.5, 9);
    expect(pt.row(36.9995)).toBeCloseTo(0.5, 9);
    expect(bilinear(pt, 128.0015, 36.9995)).toBeCloseTo((2 + 4 + 7 + 13) / 4, 9);
    expect(bilinear(pt, 128.0012, 36.9997)).toBeCloseTo(2 * 0.8 * 0.7 + 4 * 0.2 * 0.7 + 7 * 0.8 * 0.3 + 13 * 0.2 * 0.3, 9);
    expect(nearest(pt, 128.0012, 36.9998)).toBe(2);

    const area = rasterOf(geo(false), full, DATA, null);
    expect(pt.col(128.0015) - area.col(128.0015)).toBeCloseTo(0.5, 9);
    expect(pt.row(36.9995) - area.row(36.9995)).toBeCloseTo(0.5, 9);
    expect(bilinear(area, 128.0015, 36.9985)).toBeCloseTo(7, 9);

    expect(bilinear(rasterOf(geo(true), full, DATA, 13), 128.0015, 36.9995)).toBeNaN();
    expect(bilinear(rasterOf(geo(true), full, [...DATA.slice(0, 6), NaN, ...DATA.slice(7)], null), 128.0015, 36.9995)).toBeNaN();
    expect(bilinear(pt, 128.0035, 36.9995)).toBeNaN(); // column 4 is outside
    expect(nearest(pt, 128.0042, 36.9998)).toBeUndefined(); // would wrap to the next row in a flat index
    expect(nearest(pt, 128.0012, 37.0006)).toBeUndefined();

    // A window inside the image: indexes are relative to it.
    const big: Geo = { ...geo(true), width: 100, height: 100 };
    const win = windowOf(big, [128.0103, 36.9603, 128.0197, 36.9697]);
    expect(win).toEqual([8, 28, 23, 43]);
    const inner = rasterOf(big, win, new Array(15 * 15).fill(0).map((_, k) => k), null);
    expect(nearest(inner, 128.01, 36.97)).toBe((30 - 28) * 15 + (10 - 8));
  });

  test('받기: 마디의 경위도 범위', () => {
    const { lon, lat, box } = nodeLonLat(readConfig('terrain/mungyeong').frame);
    expect(lon.length).toBe(1024 * 1024);
    expect(lat.length).toBe(1024 * 1024);
    const [w, s, e, n] = box;
    expect(w).toBeCloseTo(128.0721, 4);
    expect(s).toBeCloseTo(36.7135, 4);
    expect(e).toBeCloseTo(128.1878, 4);
    expect(n).toBeCloseTo(36.8065, 4);
  });
});
