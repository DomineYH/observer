// 지도 바탕 (demo lines 1263–1280): shaded cover colours, 20 m contours (every 100 m darker) and the 1 km 방안선.
import { COVER, fromGrid, toGrid, type Mode, type Point, type ReadonlySimState, type Scenario, type TerrainData, type UnitType, type Weather } from '@sim';
import { FULL_VIEW, projector, type MapView } from './mapView';

const PALETTE: Record<(typeof COVER)[number], readonly [number, number, number]> = {
  open: [152, 138, 84],
  field: [182, 162, 104],
  forest: [56, 76, 44],
  water: [78, 104, 122],
  road: [160, 150, 128],
  village: [176, 164, 128],
  building: [150, 72, 56],
};
const COLOURS = COVER.map((c) => PALETTE[c]);
const CONTOUR = 20;
const INK = [90, 60, 30] as const;

/** RGBA pixels, one per cell, north up. */
export function mapBase(t: TerrainData): Uint8ClampedArray {
  const { n, ground: g } = t;
  const px = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      // Lit from the north-west: brighter where the cell stands above its north-west neighbour.
      const hs = Math.min(1.25, Math.max(0.7, 1 + (g[k]! - g[Math.min(n - 1, j + 1) * n + Math.max(0, i - 1)]!) * 0.05));
      const c0 = Math.floor(g[k]! / CONTOUR);
      const ce = i < n - 1 ? Math.floor(g[k + 1]! / CONTOUR) : c0;
      const cn = j < n - 1 ? Math.floor(g[k + n]! / CONTOUR) : c0;
      // The contour crossed here is the upper band's floor; every fifth one (100 m) is the index contour.
      const a = c0 === ce && c0 === cn ? 0 : Math.max(c0, ce, cn) % 5 === 0 ? 0.6 : 0.35;
      const rgb = COLOURS[t.cover[k]!]!;
      const o = ((n - 1 - j) * n + i) * 4;
      for (let ch = 0; ch < 3; ch++) px[o + ch] = rgb[ch]! * hs * (1 - a) + INK[ch]! * a;
      px[o + 3] = 255;
    }
  return px;
}

export interface GridLine {
  axis: 'e' | 'n';
  at: number; // 국지 좌표 of the line, m
  label: string; // the two kilometre digits; empty on 100 m lines
}

/** 방안선 every `step` m (1000 or 100) inside the map, placed and labelled with the conversion pair. */
export function gridLines(t: TerrainData, step: 1000 | 100 = 1000): GridLine[] {
  const size = t.n * t.cell;
  const first = toGrid(0, 0, t.grid);
  const last = toGrid(size, size, t.grid);
  const lines: GridLine[] = [];
  const d = step / 10; // in 8자리 digits
  const label = (digits: number) => (digits % 100 === 0 ? String((digits / 100) % 100).padStart(2, '0') : '');
  // fromGrid gives a 10 m square's centre; the line is its south-west edge.
  for (let g = Math.ceil(first.e / d) * d; g <= last.e; g += d) lines.push({ axis: 'e', at: fromGrid(g, 0, t.grid).x - 5, label: label(g) });
  for (let g = Math.ceil(first.n / d) * d; g <= last.n; g += d) lines.push({ axis: 'n', at: fromGrid(0, g, t.grid).y - 5, label: label(g) });
  return lines;
}

const FINE_ZOOM = 3; // 100 m 방안선 from ×3

/** The map panel's size in CSS pixels; the whole terrain fits it. */
export const MAP_PX = 512;

/** The parts of a 2D context the map uses, so the drawing can be observed without a browser. */
export type MapContext = Pick<
  CanvasRenderingContext2D,
  | 'imageSmoothingEnabled' | 'lineCap' | 'lineJoin' | 'lineWidth' | 'strokeStyle' | 'fillStyle' | 'font' | 'textAlign'
  | 'drawImage' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'fillText' | 'strokeText'
  | 'setLineDash' | 'arc' | 'fill' | 'closePath' | 'fillRect' | 'strokeRect'
>;

/** What the map marks on top of the terrain: the briefing, the post, where it looks and the targets found. */
export interface MapMarks {
  scenario: Scenario;
  op: Point;
  knownOp: Point; // 기러기가 아는 관측소 위치: 훈련 marks it when it is off the post
  dest: Point | null; // where the post is walking to
  az: number; // line of sight, 0.1 mil
  fovMil: number;
  pin: Point | null; // 좌표자
  platoons: ReadonlySimState['platoons'];
  mode: Mode;
  missions: ReadonlySimState['missions'];
  tick: number;
  weather: Weather; // its wind is drawn as an arrow
  /** 훈련 가시권 표시: `viewshed()` pixels as an image `g` cells across, or null. */
  viewshed: { image: CanvasImageSource; g: number } | null;
}

const SIGHT_M = 7000; // the 관측 시야 wedge's reach
const BEARING_M = 7500; // a target's bearing line, and where along it its label sits
const BEARING_LABEL_M = 1800;
const TYPE_MARK: Record<UnitType, string> = { inf: '보', recon: '보', apc: '장', mortar: '박' };
const TAU = Math.PI * 2;
const IMPACT_TICKS = 3000; // a 탄착 stays on the map 150 s
const KNOWN_SHOWN_M = 30; // 훈련 marks the post 기러기 knows when it is farther than this off (demo)

/** Draws the map (demo drawMap, lines 1281–1310) at a zoom and scroll: `base` holds mapBase's pixels, then roads,
 * 방안선 and 지명. */
export function drawMap(c: MapContext, t: TerrainData, base: CanvasImageSource, view: MapView = FULL_VIEW, marks?: MapMarks): void {
  const W = MAP_PX;
  const { k, x: mx, y: my } = projector(t, view, W);
  const span = t.n / view.z;
  c.imageSmoothingEnabled = view.z < 2;
  c.drawImage(base, view.x0, view.y0, span, span, 0, 0, W, W);

  c.lineCap = c.lineJoin = 'round';
  for (const [width, colour] of [[3.2, 'rgba(60,40,20,.75)'], [1.6, 'rgba(250,240,215,.95)']] as const) {
    c.lineWidth = width;
    c.strokeStyle = colour;
    for (const road of t.roads) {
      c.beginPath();
      road.line.forEach((p, i) => (i ? c.lineTo(mx(p.x), my(p.y)) : c.moveTo(mx(p.x), my(p.y))));
      c.stroke();
    }
  }

  c.font = '9px monospace';
  c.lineWidth = 1;
  c.fillStyle = 'rgba(20,25,40,.85)';
  for (const l of gridLines(t, view.z >= FINE_ZOOM ? 100 : 1000)) {
    const p = Math.round(l.axis === 'e' ? mx(l.at) : my(l.at)) + 0.5;
    if (p < -1 || p > W + 1) continue; // off the panel; the map's own edges (0.5, 512.5) stay
    c.strokeStyle = l.label ? 'rgba(20,30,60,.5)' : 'rgba(20,30,60,.18)';
    c.beginPath();
    if (l.axis === 'e') {
      c.moveTo(p, 0);
      c.lineTo(p, W);
      if (l.label && p < W - 12) c.fillText(l.label, p + 2, 9);
    } else {
      c.moveTo(0, p);
      c.lineTo(W, p);
      if (l.label && p > 12) c.fillText(l.label, 2, p - 3);
    }
    c.stroke();
  }

  c.font = 'bold 10px monospace';
  c.textAlign = 'center';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(255,255,255,.8)';
  c.fillStyle = '#2a2418';
  for (const v of t.villages) {
    const x = mx(v.x);
    const y = my(v.y + v.r) - 4;
    c.strokeText(v.name, x, y);
    c.fillText(v.name, x, y);
  }
  if (marks?.viewshed) {
    const q = marks.viewshed.g / t.n;
    c.imageSmoothingEnabled = true;
    c.drawImage(marks.viewshed.image, view.x0 * q, view.y0 * q, span * q, span * q, 0, 0, W, W);
  }
  if (marks) {
    drawMarks(c, marks, k, mx, my);
    drawFire(c, marks, t, mx, my);
    drawWind(c, marks.weather);
  }
}

/** 사격 임무 (demo 1302, 1305): each requested grid as a square with its 표적번호, and the recent 탄착 as ×. */
/** 바람 화살표 (demo 1311–1316): bottom right, pointing downwind, 8 px + 1.4 px per m/s, the speed under it. */
function drawWind(c: MapContext, w: Weather): void {
  const x0 = MAP_PX - 34;
  const y0 = MAP_PX - 34;
  const a = ((w.windFromDeg + 180) * Math.PI) / 180;
  const half = (8 + (w.windSpeedTenthMs / 10) * 1.4) / 2;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath();
  c.arc(x0, y0, 24, 0, TAU);
  c.fill();
  c.strokeStyle = c.fillStyle = '#123';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x0 - dx * half, y0 - dy * half);
  c.lineTo(x0 + dx * half, y0 + dy * half);
  c.stroke();
  const hx = x0 + dx * half;
  const hy = y0 + dy * half;
  c.beginPath();
  c.moveTo(hx, hy);
  c.lineTo(hx - Math.sin(a - 0.5) * 6, hy + Math.cos(a - 0.5) * 6);
  c.lineTo(hx - Math.sin(a + 0.5) * 6, hy + Math.cos(a + 0.5) * 6);
  c.fill();
  c.font = '9px monospace';
  c.textAlign = 'center';
  c.fillText(`${Math.round(w.windSpeedTenthMs / 10)}m/s`, x0, y0 + 20);
}

function drawFire(c: MapContext, m: MapMarks, t: TerrainData, mx: (x: number) => number, my: (y: number) => number): void {
  c.lineWidth = 1;
  c.font = '10px monospace';
  c.textAlign = 'start';
  m.missions.forEach((ms, i) => {
    if (ms.location?.method === 'grid') {
      const p = fromGrid(ms.location.easting, ms.location.northing, t.grid);
      const x = mx(p.x);
      const y = my(p.y);
      c.strokeStyle = 'rgba(255,255,255,.85)';
      c.strokeRect(x - 4, y - 4, 8, 8);
      c.fillStyle = 'rgba(255,255,255,.9)';
      c.fillText(ms.mto ? `AB${String(ms.mto.targetNumber).padStart(4, '0')}` : `#${i + 1}`, x + 6, y - 5);
    }
    c.strokeStyle = 'rgba(255,140,40,.9)';
    for (const im of ms.impacts) {
      if (m.tick - im.tick > IMPACT_TICKS) continue;
      const x = mx(im.x);
      const y = my(im.y);
      c.beginPath();
      c.moveTo(x - 2, y - 2);
      c.lineTo(x + 2, y + 2);
      c.moveTo(x + 2, y - 2);
      c.lineTo(x - 2, y + 2);
      c.stroke();
    }
  });
}

/** The briefing (demo drawIntelOverlay, 1235–1243) and the post (demo 1281–1293). */
function drawMarks(c: MapContext, m: MapMarks, k: number, mx: (x: number) => number, my: (y: number) => number): void {
  const W = MAP_PX;
  const sc = m.scenario;
  c.font = '10px monospace';
  c.textAlign = 'start';
  c.lineWidth = 1;
  // 주요 감시 지역
  sc.nais.forEach((a, i) => {
    c.strokeStyle = 'rgba(200,90,20,.95)';
    c.fillStyle = 'rgba(200,90,20,.08)';
    c.setLineDash([4, 3]);
    c.beginPath();
    c.arc(mx(a.x), my(a.y), a.r * k, 0, TAU);
    c.fill();
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(110,40,0,.95)';
    c.fillText(`NAI ${i + 1}`, mx(a.x) - 14, my(a.y) - a.r * k - 3);
  });
  // 예상 접근로, the likelier one bolder, with an arrowhead at the objective
  for (const ir of sc.intelRoutes) {
    const pts = sc.routes[ir.route];
    c.strokeStyle = c.fillStyle = ir.conf === 'high' ? 'rgba(200,40,30,.8)' : 'rgba(200,40,30,.45)';
    c.lineWidth = ir.conf === 'high' ? 2 : 1.4;
    c.setLineDash([7, 4]);
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(mx(p.x), my(p.y)) : c.moveTo(mx(p.x), my(p.y))));
    c.stroke();
    c.setLineDash([]);
    const a = pts[pts.length - 2]!;
    const b = pts[pts.length - 1]!;
    const ang = Math.atan2(my(b.y) - my(a.y), mx(b.x) - mx(a.x));
    c.beginPath();
    c.moveTo(mx(b.x), my(b.y));
    c.lineTo(mx(b.x) - 9 * Math.cos(ang - 0.4), my(b.y) - 9 * Math.sin(ang - 0.4));
    c.lineTo(mx(b.x) - 9 * Math.cos(ang + 0.4), my(b.y) - 9 * Math.sin(ang + 0.4));
    c.closePath();
    c.fill();
  }
  c.lineWidth = 1;
  // 아군 전선 (이동 한계선): crossing is allowed, but north of it the post risks being seen
  const fy = my(sc.frontY);
  c.fillStyle = 'rgba(226,96,74,.07)';
  c.fillRect(0, 0, W, fy);
  c.strokeStyle = 'rgba(60,110,200,.8)';
  c.setLineDash([8, 4]);
  c.beginPath();
  c.moveTo(0, fy);
  c.lineTo(W, fy);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = 'rgba(20,40,110,.9)';
  c.fillText('아군 전선 — 이북은 발각·피격 위험', W - 176, fy - 4);
  // 관측 시야 부채꼴 and the line of sight
  const ox = mx(m.op.x);
  const oy = my(m.op.y);
  const L = SIGHT_M * k;
  const h = (m.az / 10 / 3200) * Math.PI;
  const half = (m.fovMil / 2 / 3200) * Math.PI;
  c.fillStyle = 'rgba(232,176,74,.16)';
  c.strokeStyle = 'rgba(232,176,74,.8)';
  c.beginPath();
  c.moveTo(ox, oy);
  c.lineTo(ox + Math.sin(h - half) * L, oy - Math.cos(h - half) * L);
  c.lineTo(ox + Math.sin(h + half) * L, oy - Math.cos(h + half) * L);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(ox, oy);
  c.lineTo(ox + Math.sin(h) * L, oy - Math.cos(h) * L);
  c.stroke();
  // 아군 진지 and the post
  c.fillStyle = '#62aee6';
  c.strokeStyle = '#0c1a2a';
  for (const f of sc.friends) {
    c.fillRect(mx(f.x) - 7, my(f.y) - 4, 14, 8);
    c.strokeRect(mx(f.x) - 7, my(f.y) - 4, 14, 8);
  }
  c.beginPath();
  c.moveTo(ox, oy - 7);
  c.lineTo(ox - 6, oy + 5);
  c.lineTo(ox + 6, oy + 5);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#0c1a2a';
  c.fillText('OP', ox + 8, oy + 4);
  if (m.dest) {
    c.strokeStyle = 'rgba(98,174,230,.95)';
    c.setLineDash([4, 3]);
    c.beginPath();
    c.moveTo(ox, oy);
    c.lineTo(mx(m.dest.x), my(m.dest.y));
    c.stroke();
    c.setLineDash([]);
  }
  if (m.mode === 'training' && Math.hypot(m.knownOp.x - m.op.x, m.knownOp.y - m.op.y) > KNOWN_SHOWN_M) {
    const fx = mx(m.knownOp.x);
    const fy = my(m.knownOp.y);
    c.strokeStyle = '#62aee6';
    c.setLineDash([2, 2]);
    c.beginPath();
    c.moveTo(fx, fy - 7);
    c.lineTo(fx - 6, fy + 5);
    c.lineTo(fx + 6, fy + 5);
    c.closePath();
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#0c1a2a';
    c.fillText('기러기가 아는 위치', fx + 8, fy + 4);
  }
  if (m.pin) {
    const x = mx(m.pin.x);
    const y = my(m.pin.y);
    c.strokeStyle = '#111';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x - 8, y);
    c.lineTo(x + 8, y);
    c.moveTo(x, y - 8);
    c.lineTo(x, y + 8);
    c.stroke();
    c.lineWidth = 1;
  }
  drawTargets(c, m, k, mx, my);
}

/** 표적 (demo 1294–1301). 표준: the position is unknown, so only the bearing it was last seen on from the post.
 * 훈련: where it really is, a `?` until its type is identified. */
function drawTargets(c: MapContext, m: MapMarks, k: number, mx: (x: number) => number, my: (y: number) => number): void {
  const ox = mx(m.op.x);
  const oy = my(m.op.y);
  for (const p of m.platoons) {
    const I = p.intel;
    if (!I.stage) continue;
    if (m.mode === 'standard') {
      const a = (I.seenAz / 3200) * Math.PI;
      c.strokeStyle = 'rgba(226,96,74,.75)';
      c.setLineDash([5, 4]);
      c.beginPath();
      c.moveTo(ox, oy);
      c.lineTo(ox + Math.sin(a) * BEARING_M * k, oy - Math.cos(a) * BEARING_M * k);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#300';
      const az4 = String(Math.round(I.seenAz) % 6400).padStart(4, '0');
      c.fillText(`T${I.tnum} ${az4}`, ox + Math.sin(a) * BEARING_LABEL_M * k + 4, oy - Math.cos(a) * BEARING_LABEL_M * k);
      continue;
    }
    const x = mx(p.x);
    const y = my(p.y);
    c.fillStyle = '#e2604a';
    c.strokeStyle = '#300';
    if (I.stage < 2) {
      c.beginPath();
      c.arc(x, y, 5, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      c.fillText('?', x - 3, y + 3);
    } else {
      c.fillRect(x - 7, y - 5, 14, 10);
      c.strokeRect(x - 7, y - 5, 14, 10);
      c.fillStyle = '#fff';
      c.fillText(TYPE_MARK[p.type], x - 5, y + 4);
    }
    c.fillStyle = '#300';
    c.fillText(`T${I.tnum}`, x + 9, y + 3);
  }
}
