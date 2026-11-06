// 지도 바탕: the map panel's drawing, observed through a recording 2D context.
import { describe, expect, test } from 'vitest';
import type { TerrainData } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { drawMap, mapBase, MAP_PX, type MapContext, type MapMarks } from '@render/map';
import { BASE_SCENARIO } from '@content/scenario';
import { centreOn, FULL_VIEW, panBy, pointAt, zoomAt, type MapView } from '@render/mapView';
import { flatTerrain } from './terrain';

type Path = [number, number][];

/** A 2D context that records the strokes and texts drawn on it. */
function recorder() {
  let path: Path = [];
  const strokes: Path[] = [];
  const texts: { text: string; x: number; y: number }[] = [];
  const rects: [number, number, number, number][] = [];
  const ctx: MapContext = {
    imageSmoothingEnabled: true,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: 'start',
    drawImage: () => {},
    beginPath: () => {
      path = [];
    },
    moveTo: (x, y) => void path.push([x, y]),
    lineTo: (x, y) => void path.push([x, y]),
    stroke: () => void strokes.push(path),
    fillText: (text, x, y) => void texts.push({ text, x, y }),
    strokeText: () => {},
    setLineDash: () => {},
    arc: () => {},
    fill: () => {},
    closePath: () => {},
    fillRect: () => {},
    strokeRect: (x, y, w, h) => void rects.push([x, y, w, h]),
  };
  return { ctx, strokes, texts, rects };
}

const draw = (t: TerrainData, view?: MapView, marks?: MapMarks) => {
  const r = recorder();
  drawMap(r.ctx, t, {} as CanvasImageSource, view, marks);
  return r;
};
const east = (p: number): Path => [[p, 0], [p, MAP_PX]];
const north = (p: number): Path => [[0, p], [MAP_PX, p]];

describe('F-06', () => {
  test('F-06: 지도 바탕', async () => {
    expect(MAP_PX).toBe(512);
    const mock = await mockTerrain.load(20261106);
    const { strokes, texts } = draw(mock);

    // 1 km 방안선 every 50 px (10 240 m on 512 px), placed and labelled by the conversion pair from 동 40000·북 30000
    for (let km = 0; km <= 10; km++) {
      expect(strokes).toContainEqual(east(km * 50 + 0.5));
      expect(strokes).toContainEqual(north(512 - km * 50 + 0.5));
    }
    // Every label with its position: east along the top beside its line (the 10 km line at 500.5 px leaves no room),
    // north along the left edge above its line. Then the seven names, nothing else.
    const expected = [
      ...['40', '41', '42', '43', '44', '45', '46', '47', '48', '49'].map((text, km) => ({ text, x: km * 50 + 2.5, y: 9 })),
      ...['30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40'].map((text, km) => ({ text, x: 2, y: 509.5 - km * 50 })),
    ];
    expect(texts.slice(0, expected.length)).toEqual(expected);
    expect(texts).toHaveLength(expected.length + 7);

    // 지명: all seven, above each village
    const k = 512 / 10240;
    for (const v of mock.villages) expect(texts).toContainEqual({ text: v.name, x: v.x * k, y: 512 - (v.y + v.r) * k - 4 });
    expect(mock.villages.map((v) => v.name)).toEqual(['청계읍', '새터마을', '솔미리', '아랫말', '갈골', '북원리', '윗말']);

    // A 방안 기준 off the kilometre (2 560 m on 512 px): lines and labels follow it
    const shifted = draw(flatTerrain({ n: 256, grid: { letters: 'CH', e0: 40500, n0: 29250 } }));
    for (const p of [100.5, 300.5, 500.5]) expect(shifted.strokes).toContainEqual(east(p));
    for (const p of [362.5, 162.5]) expect(shifted.strokes).toContainEqual(north(p));
    expect(shifted.texts).toEqual([
      { text: '41', x: 102.5, y: 9 },
      { text: '42', x: 302.5, y: 9 },
      { text: '30', x: 2, y: 359.5 },
      { text: '31', x: 2, y: 159.5 },
    ]);

    // Contours on a slope rising 1 m per cell eastwards from 90 m: every 100 m darker than every 20 m
    const t = flatTerrain();
    for (let j = 0; j < t.n; j++) for (let i = 0; i < t.n; i++) t.ground[j * t.n + i] = 90 + i;
    const px = mapBase(t);
    expect(px).toHaveLength(t.n * t.n * 4);
    const lum = (i: number, j = 20) => {
      const o = ((t.n - 1 - j) * t.n + i) * 4; // north up
      return px[o]! + px[o + 1]! + px[o + 2]!;
    };
    const index = lum(9); // 99 → 100 m
    const plain = lum(29); // 119 → 120 m
    expect(index).toBeLessThan(plain);
    expect(plain).toBeLessThan(lum(15));
  });

  test('F-06: 좌표자', () => {
    const t = flatTerrain({ n: 1024 }); // 10 240 m square, 방안 기준 동 40000·북 30000
    // The whole map: the panel's centre is the map's centre.
    expect(pointAt(t, FULL_VIEW, 0.5, 0.5)).toEqual({ x: 5120, y: 5120, e: 4512, n: 3512 });
    expect(pointAt(t, FULL_VIEW, 0, 1)).toEqual({ x: 0, y: 0, e: 4000, n: 3000 });
    // ×4, scrolled to cells 300 east and 500 down from the top: a quarter across, three quarters down.
    expect(pointAt(t, { z: 4, x0: 300, y0: 500 }, 0.25, 0.75)).toEqual({ x: 3640, y: 3320, e: 4364, n: 3332 });
    // Meters → digits truncate (the conversion pair's rule): 3 m into a square still reads that square.
    expect(pointAt(t, { z: 8, x0: 0, y0: 896 }, 0.0025, 0.995)).toEqual({ x: 3, y: 6, e: 4000, n: 3000 });
  });

  test('F-06: 지도 확대', () => {
    const t = flatTerrain({ n: 1024 });
    // 1–8배: wheel and buttons zoom by factors, clamped.
    expect(zoomAt(t, FULL_VIEW, 100, 0.5, 0.5).z).toBe(8);
    expect(zoomAt(t, { z: 2, x0: 100, y0: 100 }, 0.01, 0.5, 0.5)).toEqual(FULL_VIEW);
    // The point under the cursor stays put.
    const v = zoomAt(t, FULL_VIEW, 2, 0.25, 0.75);
    expect(v).toEqual({ z: 2, x0: 128, y0: 384 });
    expect(pointAt(t, v, 0.25, 0.75)).toEqual(pointAt(t, FULL_VIEW, 0.25, 0.75));
    // 끌어서 이동, never past the map's edges.
    expect(panBy(t, v, 0.125, -0.25)).toEqual({ z: 2, x0: 64, y0: 512 });
    expect(panBy(t, v, 1, 0)).toEqual({ z: 2, x0: 0, y0: 384 });
    expect(panBy(t, v, -2, -2)).toEqual({ z: 2, x0: 512, y0: 512 });
    expect(panBy(t, FULL_VIEW, -0.5, 0.5)).toEqual(FULL_VIEW);
    // 관측소로: centred on a point, at least ×3.
    const c = centreOn(t, FULL_VIEW, { x: 5120, y: 1800 }, 3);
    expect(c.z).toBe(3);
    expect(pointAt(t, c, 0.5, 0.5)).toEqual({ x: 5120, y: 1800, e: 4512, n: 3180 });

    // Below ×3 only the 1 km 방안선: at ×2.9 from the north-west corner, 4 east and 4 north lines.
    const coarse = draw(t, { z: 2.9, x0: 0, y0: 0 });
    expect(coarse.strokes).toHaveLength(8);
    // From ×3 the 100 m lines too (3 413 m across: 35 east, 34 north), labelled only on the kilometre.
    const fine = draw(t, { z: 3, x0: 0, y0: 0 });
    expect(fine.strokes).toHaveLength(69);
    expect(fine.strokes).toContainEqual(east(15.5)); // 100 m east of the west edge at 0.15 px/m
    expect(fine.strokes).toContainEqual(north(6.5)); // 10 200 m north
    expect(fine.texts.map((x) => x.text)).toEqual(['40', '41', '42', '43', '37', '38', '39', '40']);
  });

  test('F-06: 관측 시야 부채꼴과 아군 진지', () => {
    const t = flatTerrain({ n: 1024 }); // 0.05 px/m on the whole map
    const marks: MapMarks = { scenario: BASE_SCENARIO, op: { x: 5120, y: 1800 }, az: 0, fovMil: 1066, pin: null };
    const { strokes, texts, rects } = draw(t, FULL_VIEW, marks);
    // The line of sight, due north 7 km from the post at (256, 422), inside the wedge.
    expect(strokes).toContainEqual([[256, 422], [256, 72]]);
    // 아군 진지 as boxes, the 아군 전선 (이동 한계선) across the map, the NAIs and the post labelled.
    expect(rects).toEqual(expect.arrayContaining([[210.5, 339, 14, 8], [250.5, 335, 14, 8], [290.5, 339, 14, 8]]));
    expect(strokes).toContainEqual([[0, 329.5], [512, 329.5]]);
    for (const label of ['NAI 1', 'NAI 2', 'NAI 3', 'OP']) expect(texts.map((x) => x.text)).toContain(label);
    // Aiming east turns the line of sight east.
    const e = draw(t, FULL_VIEW, { ...marks, az: 16000 });
    expect(e.strokes.some((p) => p.length === 2 && p[0]![0] === 256 && p[0]![1] === 422 && Math.abs(p[1]![0] - 606) < 1e-9 && Math.abs(p[1]![1] - 422) < 1e-9)).toBe(true);
  });
});
