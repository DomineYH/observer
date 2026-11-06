// 지도 바탕: the map panel's drawing, observed through a recording 2D context.
import { describe, expect, test } from 'vitest';
import type { TerrainData } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { drawMap, mapBase, MAP_PX, type MapContext } from '@render/map';
import { flatTerrain } from './terrain';

type Path = [number, number][];

/** A 2D context that records the strokes and texts drawn on it. */
function recorder() {
  let path: Path = [];
  const strokes: Path[] = [];
  const texts: { text: string; x: number; y: number }[] = [];
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
  };
  return { ctx, strokes, texts };
}

const draw = (t: TerrainData) => {
  const r = recorder();
  drawMap(r.ctx, t, {} as CanvasImageSource);
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
    const labels = (x: number | null, y: number | null) =>
      texts.filter((t) => (x === null || t.x === x) && (y === null || t.y === y)).map((t) => t.text);
    // east labels along the top (the 10 km line at 500.5 px leaves no room), north labels along the left edge
    expect(labels(null, 9)).toEqual(['40', '41', '42', '43', '44', '45', '46', '47', '48', '49']);
    expect(labels(2, null)).toEqual(['30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40']);
    expect(texts.find((t) => t.text === '43' && t.y === 9)!.x).toBe(152.5);
    expect(texts.find((t) => t.text === '33' && t.x === 2)!.y).toBe(362.5 - 3);

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
});
