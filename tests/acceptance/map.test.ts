// 지도 바탕: the map panel's drawing, observed through a recording 2D context.
import { describe, expect, test } from 'vitest';
import type { TerrainData } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { drawMap, mapBase, MAP_PX, type MapContext, type MapMarks } from '@render/map';
import { BASE_SCENARIO } from '@content/scenario';
import { centreOn, FULL_VIEW, panBy, pointAt, zoomAt, type MapView } from '@render/mapView';
import { flatTerrain } from './terrain';
import { angleTo, idAt, oneUnit, started } from './enemy';
import { CALL_ADJUST, DESC_UNKNOWN, LOC_NEAR, openRadio, radioEvents, started as emptyField, toReady, untilImpact } from './mission';

type Path = [number, number][];

/** A 2D context that records the strokes and texts drawn on it. */
function recorder() {
  let path: Path = [];
  let dashed = false;
  const strokes: Path[] = [];
  const dashes: Path[] = []; // the strokes drawn dashed
  const arcs: [number, number][] = [];
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
    stroke: () => {
      strokes.push(path);
      if (dashed) dashes.push(path);
    },
    fillText: (text, x, y) => void texts.push({ text, x, y }),
    strokeText: () => {},
    setLineDash: (d) => void (dashed = [...d].length > 0),
    arc: (x, y) => void arcs.push([x, y]),
    fill: () => {},
    closePath: () => {},
    fillRect: () => {},
    strokeRect: (x, y, w, h) => void rects.push([x, y, w, h]),
  };
  return { ctx, strokes, dashes, arcs, texts, rects };
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
  }, 30000);

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
    const marks: MapMarks = { scenario: BASE_SCENARIO, op: { x: 5120, y: 1800 }, knownOp: { x: 5120, y: 1800 }, dest: null, az: 0, fovMil: 1066, pin: null, platoons: [], mode: 'standard', missions: [], tick: 0, weather: CLEAR_WEATHER, viewshed: null };
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

  test('F-17: 바람 화살표', () => {
    // Bottom right of the panel, pointing downwind, 8 px + 1.4 px per m/s long, with the speed under it (demo 1311–1316).
    const t = flatTerrain({ n: 1024 });
    const marks: MapMarks = { scenario: BASE_SCENARIO, op: { x: 5120, y: 1800 }, knownOp: { x: 5120, y: 1800 }, dest: null, az: 0, fovMil: 1066, pin: null, platoons: [], mode: 'standard', missions: [], tick: 0, weather: { ...CLEAR_WEATHER, windFromDeg: 270, windSpeedTenthMs: 100 }, viewshed: null };
    const shaft = (m: MapMarks) => draw(t, FULL_VIEW, m).strokes.at(-1)!.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
    expect(shaft(marks)).toEqual([[467, 478], [489, 478]]); // from the west: blowing east
    expect(draw(t, FULL_VIEW, marks).texts).toContainEqual({ text: '10m/s', x: 478, y: 498 });
    expect(shaft({ ...marks, weather: { ...marks.weather, windFromDeg: 0 } })).toEqual([[478, 467], [478, 489]]); // from the north: down the map
  });

  test('B3: 훈련 지도의 기러기가 아는 위치', () => {
    const t = flatTerrain({ n: 1024 }); // 0.05 px/m: the post (5120, 1800) at (256, 422)
    const base: MapMarks = { scenario: BASE_SCENARIO, op: { x: 5120, y: 1800 }, knownOp: { x: 5000, y: 1800 }, dest: null, az: 0, fovMil: 1066, pin: null, platoons: [], mode: 'training', missions: [], tick: 0, weather: CLEAR_WEATHER, viewshed: null };
    const label = (m: MapMarks) => draw(t, FULL_VIEW, m).texts.find((x) => x.text === '기러기가 아는 위치');
    // 훈련: 120 m off, the post 기러기 knows is marked where it is; within 30 m, or in 표준, it is not.
    expect(label(base)).toMatchObject({ x: 258, y: 426 });
    expect(label({ ...base, knownOp: { x: 5100, y: 1800 } })).toBeUndefined();
    expect(label({ ...base, mode: 'standard' })).toBeUndefined();
    // While walking, a dashed line from the post to where it is going.
    expect(draw(t, FULL_VIEW, { ...base, dest: { x: 5200, y: 1800 } }).dashes).toContainEqual([[256, 422], [260, 422]]);
  });

  test('F-06: 표준은 방위각 선만', () => {
    // A recon team 1 km north of the post, found by a press. 0.05 px/m: the post (320, 320) is drawn at (16, 496).
    const t = flatTerrain({ n: 1024 });
    const route = [
      { x: 320, y: 1320 },
      { x: 320, y: 2320 },
      { x: 320, y: 3320 },
    ];
    const found = (mode: 'standard' | 'training') => {
      const sim = started(oneUnit({ type: 'recon', route: 'A', t0: 0 }, route), { terrain: t, mode });
      expect(sim.step([idAt(angleTo(sim, sim.state.platoons[0]!.members[0]!))]).accepted).toEqual([true]);
      return sim;
    };
    const marks = (sim: ReturnType<typeof found>): MapMarks => ({
      scenario: BASE_SCENARIO,
      op: sim.state.op,
      knownOp: sim.state.op,
      dest: null,
      az: 0,
      fovMil: 1066,
      pin: null,
      platoons: sim.state.platoons,
      mode: sim.state.mode,
      missions: [],
      tick: sim.state.tick,
      weather: CLEAR_WEATHER,
      viewshed: null,
    });

    // 표준: where it is stays unknown; only the bearing it was last seen on, 7.5 km out from the post, dashed.
    const std = found('standard');
    const p = std.state.platoons[0]!;
    const bearing = Math.atan2(p.x - 320, p.y - 320); // radians east of north
    const s = draw(t, FULL_VIEW, marks(std));
    const fromPost = (d: Path) => d.length === 2 && d[0]![0] === 16 && d[0]![1] === 496;
    const line = s.dashes.find(fromPost)!;
    expect(line[1]![0]).toBeCloseTo(16 + Math.sin(bearing) * 375, 2); // it walked on a tick after it was seen
    expect(line[1]![1]).toBeCloseTo(496 - Math.cos(bearing) * 375, 2); // it walked on a tick after it was seen
    const mils = String(Math.round(((bearing * 3200) / Math.PI + 6400) % 6400) % 6400).padStart(4, '0');
    const label = s.texts.find((x) => x.text === `T1 ${mils}`)!;
    expect(label.x).toBeCloseTo(16 + Math.sin(bearing) * 90 + 4, 2); // 1.8 km along the line
    expect(label.y).toBeCloseTo(496 - Math.cos(bearing) * 90, 2);
    const near = (x: number, y: number) => Math.hypot(x - p.x * 0.05, y - (512 - p.y * 0.05)) < 12;
    expect(s.arcs.filter(([x, y]) => near(x, y))).toEqual([]);
    expect(s.texts.filter((x) => near(x.x, x.y))).toEqual([]);

    // 훈련: the unit where it really is, marked unknown until its type is identified, and no bearing line.
    const tr = found('training');
    const q = tr.state.platoons[0]!;
    const at = [q.x * 0.05, 512 - q.y * 0.05] as const;
    const r = draw(t, FULL_VIEW, marks(tr));
    expect(r.arcs).toContainEqual([at[0], at[1]]);
    expect(r.texts).toEqual(expect.arrayContaining([{ text: '?', x: at[0] - 3, y: at[1] + 3 }, { text: 'T1', x: at[0] + 9, y: at[1] + 3 }]));
    expect(r.dashes.filter(fromPost)).toEqual([]);
  });

  test('F-10: 지도에 탄착과 요구 좌표', () => {
    // The flat test terrain at 0.8 px/m: the grid sent, (505, 505), is drawn at (404, 108).
    const sim = emptyField();
    openRadio(sim);
    toReady(sim, DESC_UNKNOWN, CALL_ADJUST, LOC_NEAR);
    const { impact } = untilImpact(sim);
    const marks = (): MapMarks => ({
      scenario: BASE_SCENARIO,
      op: sim.state.op,
      knownOp: sim.state.op,
      dest: null,
      az: 0,
      fovMil: 1066,
      pin: null,
      platoons: [],
      mode: 'standard',
      missions: sim.state.missions,
      tick: sim.state.tick,
      weather: CLEAR_WEATHER,
      viewshed: null,
    });
    const t = flatTerrain();
    const crossAt = (r: ReturnType<typeof draw>, x: number, y: number) =>
      r.strokes.some((p) => p.length === 4 && Math.abs(p[0]![0] - (x - 2)) < 1e-9 && Math.abs(p[0]![1] - (y - 2)) < 1e-9);
    const ix = impact.x * 0.8;
    const iy = 512 - impact.y * 0.8;
    const now = draw(t, FULL_VIEW, marks());
    // The requested grid as a square labelled with its 표적번호, the impact as an orange ×.
    expect(now.rects).toContainEqual([400, 104, 8, 8]);
    expect(now.texts).toContainEqual({ text: 'AB1001', x: 410, y: 103 });
    expect(crossAt(now, ix, iy)).toBe(true);
    // The × stays 150 s.
    radioEvents(sim, 2999);
    expect(crossAt(draw(t, FULL_VIEW, marks()), ix, iy)).toBe(true);
    radioEvents(sim, 2);
    expect(crossAt(draw(t, FULL_VIEW, marks()), ix, iy)).toBe(false);
  });
});
