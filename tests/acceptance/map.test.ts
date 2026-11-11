// 지도 바탕: the map panel's drawing, observed through a recording 2D context.
import { describe, expect, test } from 'vitest';
import type { TerrainData } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { CLEAR_WEATHER } from '@adapters/mock/weather';
import { drawMap, gridLines, mapBase, MAP_PX, type MapContext, type MapMarks } from '@render/map';
import { BASE_SCENARIO } from '@content/scenario';
import { centreOn, FULL_VIEW, panBy, pointAt, zoomAt, type MapView } from '@render/mapView';
import { flatTerrain, mainRoad } from './terrain';
import { angleTo, idAt, oneUnit, started } from './enemy';
import { CALL_ADJUST, DESC_UNKNOWN, LOC_NEAR, openRadio, radioEvents, started as emptyField, toReady, unstarted, untilImpact } from './mission';
import { cleared } from './end';
import { TEST_PLACEMENT } from './placement';

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
  const closed = new Set<Path>(); // paths closed with closePath()
  const filled = new Set<Path>(); // paths filled with fill()
  // Every stroke and text in drawing order, with the style it was drawn in.
  type Word = { op: 'fillText' | 'strokeText'; text: string; x: number; y: number; font: string; style: string; width: number };
  const ops: ({ op: 'stroke'; path: Path; width: number; style: string } | Word)[] = [];
  const words: Word[] = []; // the text ops alone
  const word = (w: Word) => void (ops.push(w), words.push(w));
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
      ops.push({ op: 'stroke', path, width: ctx.lineWidth, style: String(ctx.strokeStyle) });
      strokes.push(path);
      if (dashed) dashes.push(path);
    },
    fillText: (text, x, y) => {
      word({ op: 'fillText', text, x, y, font: ctx.font, style: String(ctx.fillStyle), width: ctx.lineWidth });
      texts.push({ text, x, y });
    },
    strokeText: (text, x, y) => word({ op: 'strokeText', text, x, y, font: ctx.font, style: String(ctx.strokeStyle), width: ctx.lineWidth }),
    setLineDash: (d) => void (dashed = [...d].length > 0),
    arc: (x, y) => void arcs.push([x, y]),
    fill: () => void filled.add(path),
    closePath: () => void closed.add(path),
    fillRect: () => {},
    strokeRect: (x, y, w, h) => void rects.push([x, y, w, h]),
  };
  return { ctx, strokes, dashes, arcs, texts, rects, ops, words, closed, filled };
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

  test('F-06: 예비 관측소 표시', () => {
    // 0.05 px/m: (4000, 1000) is drawn at (200, 462), (6000, 900) at (300, 467).
    const t = flatTerrain({ n: 1024 });
    const scenario = TEST_PLACEMENT.scenario;
    const fixed: MapMarks = { scenario, op: { x: 5120, y: 1800 }, knownOp: { x: 5120, y: 1800 }, dest: null, az: 0, fovMil: 1066, pin: null, platoons: [], mode: 'standard', missions: [], tick: 0, weather: CLEAR_WEATHER, viewshed: null };
    const fromSim = (sim: ReturnType<typeof unstarted>): MapMarks => ({ ...fixed, op: sim.state.op, knownOp: sim.state.op, platoons: sim.state.platoons, mode: sim.state.mode, missions: sim.state.missions, tick: sim.state.tick });
    const prep = unstarted();
    const live = emptyField();
    const ended = cleared().sim;
    expect([prep, live, ended].map((x) => x.state.phase)).toEqual(['prep', 'live', 'ended']);
    // Both modes and every 국면: a hollow dashed triangle the OP's size and "예비 N" beside it, for each 예비 관측소.
    for (const marks of [fixed, { ...fixed, mode: 'training' as const }, fromSim(prep), fromSim(live), fromSim(ended)]) {
      const { dashes, texts, closed, filled } = draw(t, FULL_VIEW, marks);
      expect(dashes).toContainEqual([[200, 455], [194, 467], [206, 467]]);
      expect(dashes).toContainEqual([[300, 460], [294, 472], [306, 472]]);
      const symbols = dashes.filter((p) => p.length === 3 && ['200,455', '300,460'].includes(String(p[0])));
      expect(symbols).toHaveLength(2);
      for (const p of symbols) {
        expect(closed.has(p)).toBe(true);
        expect(filled.has(p)).toBe(false);
      }
      expect(texts).toContainEqual({ text: '예비 1', x: 208, y: 466 });
      expect(texts).toContainEqual({ text: '예비 2', x: 308, y: 471 });
    }
    // The mock scenario has none, and nothing else on the map moves or changes style.
    const reserve = draw(t, FULL_VIEW, fixed).ops;
    const base = draw(t, FULL_VIEW, { ...fixed, scenario: BASE_SCENARIO }).ops;
    expect(base.some((o) => o.op !== 'stroke' && o.text.startsWith('예비'))).toBe(false);
    const marks = new Set(['200,455', '300,460']);
    expect(reserve.filter((o) => (o.op === 'stroke' ? !marks.has(String(o.path[0])) : !o.text.startsWith('예비')))).toEqual(base);
    expect(reserve.length - base.length).toBe(4);
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

describe('지도', () => {
  test('지도: 문경 방안 기준의 방안선 자리', () => {
    const t = flatTerrain({ n: 1024, grid: { letters: 'CH', e0: 40230, n0: 30490 } });
    const km = gridLines(t, 1000);
    const at = (axis: 'e' | 'n') => km.filter((l) => l.axis === axis).map((l) => [Math.round(l.at * 1e6) / 1e6, l.label]);
    expect(at('e')).toEqual([...Array(10).keys()].map((k) => [770 + 1000 * k, String(41 + k)]));
    expect(at('n')).toEqual([...Array(10).keys()].map((k) => [510 + 1000 * k, String(31 + k)]));
    // 100 m lines: every one 70 m (east) and 10 m (north) past the hundred; no line on the map's edges.
    const fine = gridLines(t, 100);
    const rem = (axis: 'e' | 'n') => new Set(fine.filter((l) => l.axis === axis).map((l) => Math.round(l.at) % 100));
    expect(rem('e')).toEqual(new Set([70]));
    expect(rem('n')).toEqual(new Set([10]));
    expect(fine.filter((l) => l.axis === 'e')).toHaveLength(102);
  });

  test('지도: 도로 등급별 굵기와 긋는 순서', async () => {
    const CASING = 'rgba(60,40,20,.75)';
    const INNER = 'rgba(250,240,215,.95)';
    const roadOps = (r: ReturnType<typeof draw>) =>
      r.ops.flatMap((o) => (o.op === 'stroke' && (o.style === CASING || o.style === INNER) ? [[o.style === CASING ? 'casing' : 'inner', o.width, o.path] as const] : []));
    // 0.8 px/m on the 640 m flat terrain.
    const line = (y: number) => [{ x: 0, y }, { x: 640, y }];
    const at = (y: number): Path => [[0, 512 - y * 0.8], [512, 512 - y * 0.8]];
    const t: TerrainData = { ...flatTerrain(), roads: [{ class: 'trunk', line: line(100) }, { class: 'local', line: line(200) }, mainRoad(line(300))] };
    expect(roadOps(draw(t))).toEqual([
      ['casing', 4.4, at(100)],
      ['casing', 2.0, at(200)],
      ['casing', 3.2, at(300)],
      ['inner', 0.9, at(200)],
      ['inner', 1.6, at(300)],
      ['inner', 2.8, at(100)],
    ]);
    // The mock's roads are all main: the demo line, casings first, both in data order.
    const mock = await mockTerrain.load(20261106);
    const k = 512 / 10240;
    const path = (r: (typeof mock.roads)[number]): Path => r.line.map((p) => [p.x * k, 512 - p.y * k]);
    expect(mock.roads.every((r) => r.class === 'main')).toBe(true);
    expect(roadOps(draw(mock))).toEqual([...mock.roads.map((r) => ['casing', 3.2, path(r)]), ...mock.roads.map((r) => ['inner', 1.6, path(r)])]);
  }, 30000);

  test('지도: 방안 숫자의 흰 테두리', async () => {
    // Every 방안 숫자, on the mock and zoomed in, has its white 3 px edge stroked just before it is filled.
    const mock = await mockTerrain.load(20261106);
    for (const view of [FULL_VIEW, { z: 3, x0: 100, y0: 200 }]) {
      const { ops } = draw(mock, view);
      const digits = ops.flatMap((o, i) => (o.op === 'fillText' && /^\d\d$/.test(o.text) ? [{ i, o }] : []));
      expect(digits.length).toBeGreaterThan(5);
      for (const { i, o } of digits) {
        expect(ops[i - 1]).toMatchObject({ op: 'strokeText', text: o.text, x: o.x, y: o.y, width: 3, style: 'rgba(255,255,255,.8)', font: '9px monospace' });
        expect(o).toMatchObject({ font: '9px monospace', style: 'rgba(20,25,40,.85)' });
      }
      // The 방안선 themselves stay 1 px.
      expect(ops.filter((o) => o.op === 'stroke' && o.style.startsWith('rgba(20,30,60,')).every((o) => o.op === 'stroke' && o.width === 1)).toBe(true);
    }
  }, 30000);

  test('지도: 이름표 건너뛰기', async () => {
    // 0.05 px/m at ×1. Two villages 200 m apart (10 px): their labels overlap at ×1 but not at ×8 (80 px).
    const t: TerrainData = {
      ...flatTerrain({ n: 1024 }),
      villages: [
        { name: '작은마을', x: 5200, y: 5000, r: 110 },
        { name: '큰마을', x: 5000, y: 5000, r: 330 },
        // Same 반경: the one listed first wins.
        { name: '앞마을', x: 2000, y: 2000, r: 170 },
        { name: '뒷마을', x: 2100, y: 2000, r: 170 },
      ],
    };
    const names = (view: MapView, only = /마을/) => draw(t, view).words.filter((o) => only.test(o.text)).map((o) => [o.op, o.text]);
    // The bigger village is drawn first; the smaller one, overlapping it, is skipped (edge and letters both).
    expect(names(FULL_VIEW)).toEqual([['strokeText', '큰마을'], ['fillText', '큰마을'], ['strokeText', '앞마을'], ['fillText', '앞마을']]);
    // Zoomed in on them, both come back (painted in data order).
    expect(names(centreOn(t, FULL_VIEW, { x: 5100, y: 5000 }, 8), /큰|작은/).map(([, n]) => n)).toEqual(['작은마을', '작은마을', '큰마을', '큰마을']);
    expect(names(centreOn(t, FULL_VIEW, { x: 2050, y: 2000 }, 8), /앞|뒷/).map(([, n]) => n)).toEqual(['앞마을', '앞마을', '뒷마을', '뒷마을']);
    // The mock skips none at ×1.
    const mock = await mockTerrain.load(20261106);
    const drawn = draw(mock).texts.map((x) => x.text);
    for (const v of mock.villages) expect(drawn).toContain(v.name);
  }, 30000);

  test('지도: 지명', () => {
    // 0.05 px/m at ×1: (5000, 5000) is drawn at (250, 262).
    const bare: TerrainData = { ...flatTerrain({ n: 1024 }), villages: [{ name: '큰마을', x: 5000, y: 5000, r: 330 }] };
    const t: TerrainData = {
      ...bare,
      names: [
        { name: '남강', x: 2000, y: 3000, kind: 'water' },
        { name: '큰산', x: 8000, y: 8000, kind: 'peak' },
        { name: '겹친봉', x: 5000, y: 5300, kind: 'peak' }, // on top of the village's label: skipped like one
        { name: '새고개', x: 3000, y: 8000, kind: 'pass' },
      ],
    };
    const lettering = draw(t).words.filter((o) => !/^\d\d$/.test(o.text));
    // After the village names, in data order, each on its white edge; only water in dark blue; no 표고 numbers.
    expect(lettering.map((o) => [o.op, o.text])).toEqual(
      ['큰마을', '남강', '큰산', '새고개'].flatMap((n) => [['strokeText', n], ['fillText', n]]),
    );
    const fills = lettering.filter((o) => o.op === 'fillText');
    for (const o of lettering.slice(2)) expect(o).toMatchObject({ font: '9px monospace' });
    for (const o of lettering.filter((o) => o.op === 'strokeText')) expect(o).toMatchObject({ width: 3, style: 'rgba(255,255,255,.8)' });
    expect(fills.map((o) => o.style)).toEqual(['#2a2418', '#1a3c78', '#2a2418', '#2a2418']);
    expect(fills[1]).toMatchObject({ x: 100, y: 365 }); // centred on its point
    // No 지명: nothing more than the village name.
    expect(draw(bare).words.filter((o) => !/^\d\d$/.test(o.text)).map((o) => o.text)).toEqual(['큰마을', '큰마을']);
  });
});

