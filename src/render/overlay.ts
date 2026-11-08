// 겹쳐 그리는 표시 of the observation view (demo lines 1197–1229): the binocular mil reticle, the azimuth tape and the
// time to impact. Positions come from milToPx, the renderer's own projection.
import { heightAt, type Point, type ReadonlySimState, type TerrainData, type Weather } from '@sim';
import { MIL, milToPx, project, type ViewGeometry } from './projection';
import { hash } from './shade';

const FRIEND_LABEL_M = 12; // above the ground (demo 1217)

/** 훈련: where each 아군 진지 (numbered from 1) shows in the view, for its "▼ 아군 n소대" label; off-view ones are left out. */
export function friendLabels(friends: readonly Point[], v: ViewGeometry, t: TerrainData): { n: number; sx: number; sy: number }[] {
  return friends.flatMap((f, i) => {
    const p = project(v, { x: f.x, y: f.y, z: heightAt(t, f.x, f.y) + FRIEND_LABEL_M });
    return p && p.sx > 0 && p.sx < 2 * v.cx ? [{ n: i + 1, sx: p.sx, sy: p.sy }] : [];
  });
}

/** 탄착까지 남은 초 (F-11, demo line 1229), rounded up; `urgent` from 5 s down (SPLASH 대용). */
export interface Splash {
  sec: number;
  urgent: boolean;
}

/** The countdown to the current mission's next round to land, or null when none flies. */
export function splashOf(s: ReadonlySimState): Splash | null {
  const f = s.missions.at(-1)?.flights[0];
  if (!f) return null;
  const sec = Math.ceil((f.at - s.tick) / 20);
  return { sec, urgent: sec <= 5 };
}

export interface Reticle {
  h: { mil: number; x: number; major: boolean }[]; // ticks on the horizontal scale
  v: { mil: number; y: number; major: boolean }[]; // ticks on the vertical scale
  labels: { x: number; text: string }[];
}

/** 쌍안경 밀 눈금 레티클: ±50 mils every 5 across, ±20 every 5 up and down, numbers every 10 from 10 to 40. */
export function reticle(focal: number, cx: number, cy: number): Reticle {
  const r: Reticle = { h: [], v: [], labels: [] };
  for (let m = -50; m <= 50; m += 5) if (m) r.h.push({ mil: m, x: cx + milToPx(m, focal), major: m % 10 === 0 });
  for (let m = -20; m <= 20; m += 5) if (m) r.v.push({ mil: m, y: cy - milToPx(m, focal), major: m % 10 === 0 });
  for (let m = -40; m <= 40; m += 10) if (m) r.labels.push({ x: cx + milToPx(m, focal), text: String(Math.abs(m)) });
  return r;
}

export interface TapeTick {
  mil: number; // not wrapped: the tick's offset from the line of sight is `mil - hMil`
  x: number;
  big: boolean;
  label?: string;
}

/** 방위 테이프 for a line of sight at `hMil`: a tick every 50 mils, the hundreds of mils as two digits every 100. */
export function tapeTicks(hMil: number, focal: number, cx: number, width: number): TapeTick[] {
  const ticks: TapeTick[] = [];
  for (let m = Math.ceil((hMil - 600) / 50) * 50; m <= hMil + 600; m += 50) {
    const x = cx + milToPx(m - hMil, focal);
    if (x < 0 || x > width) continue;
    const wrapped = ((m % 6400) + 6400) % 6400;
    const big = wrapped % 100 === 0;
    ticks.push({ mil: m, x, big, ...(big && { label: String(wrapped / 100).padStart(2, '0') }) });
  }
  return ticks;
}

const FONT = "'Nanum Gothic Coding', monospace";
let mask: { key: string; canvas: HTMLCanvasElement } | null = null;

// The binocular field: black outside two overlapping circles (built once per size).
function binoMask(W: number, H: number): HTMLCanvasElement {
  const key = `${W}x${H}`;
  if (mask?.key !== key) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const m = canvas.getContext('2d')!;
    m.fillStyle = '#000';
    m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'destination-out';
    const r = H * 0.56;
    m.beginPath();
    m.arc(W / 2 - r * 0.55, H / 2, r, 0, 2 * Math.PI);
    m.arc(W / 2 + r * 0.55, H / 2, r, 0, 2 * Math.PI);
    m.fill();
    mask = { key, canvas };
  }
  return mask.canvas;
}

/** 빗줄기 (demo 1191–1193): 90 streaks per mm/h at display resolution, each 16 px long, falling and drifting with
 * the crosswind seen at heading `h` mils; `tSec` moves them. Segments as [x0, y0, x1, y1]. */
export function rainStreaks(w: Weather, h: number, W: number, H: number, dpr: number, tSec: number): [number, number, number, number][] {
  const n = Math.round(9 * w.precipTenthMmH);
  const to = ((w.windFromDeg + 180) * Math.PI) / 180;
  const v = w.windSpeedTenthMs / 10;
  const a = h / MIL;
  const lean = (Math.sin(to) * v * Math.cos(a) - Math.cos(to) * v * Math.sin(a)) * 2.2 * dpr;
  const out: [number, number, number, number][] = [];
  for (let k = 0; k < n; k++) {
    const x = (((hash(k, 1, 77) * W + tSec * lean * 20) % W) + W) % W;
    const y = (hash(k, 2, 77) * H + tSec * 900 * dpr * (0.8 + hash(k, 3, 77) * 0.4)) % H;
    out.push([x, y, x + lean, y + 16 * dpr]);
  }
  return out;
}

export function drawRain(c: CanvasRenderingContext2D, streaks: readonly (readonly number[])[], dpr: number): void {
  if (!streaks.length) return;
  c.strokeStyle = 'rgba(210,215,222,.35)';
  c.lineWidth = dpr;
  c.beginPath();
  for (const [x0, y0, x1, y1] of streaks) {
    c.moveTo(x0!, y0!);
    c.lineTo(x1!, y1!);
  }
  c.stroke();
}

/** Draws the overlay at display resolution: `scale` display pixels per internal pixel, `aim` in mils. */
export function drawOverlay(
  c: CanvasRenderingContext2D,
  focal: number,
  scale: number,
  aim: { h: number; p: number },
  bino: boolean,
  dpr: number,
  fps: number | null,
  splash: Splash | null = null,
): void {
  const { width: W, height: H } = c.canvas;
  const fpx = focal * scale;
  const cx = W / 2;
  const cy = H / 2;
  c.save();
  c.font = `${Math.round(11 * dpr)}px ${FONT}`;
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.beginPath();
  if (bino) {
    c.drawImage(binoMask(W, H), 0, 0);
    c.strokeStyle = c.fillStyle = 'rgba(18,18,14,.9)';
    c.lineWidth = Math.max(1, 1.2 * dpr);
    const r = reticle(fpx, cx, cy);
    c.moveTo(r.h[0]!.x, cy);
    c.lineTo(cx + milToPx(-3, fpx), cy);
    c.moveTo(cx + milToPx(3, fpx), cy);
    c.lineTo(r.h[r.h.length - 1]!.x, cy);
    for (const t of r.h) {
      const L = (t.major ? 9 : 5) * dpr;
      c.moveTo(t.x, cy - L);
      c.lineTo(t.x, cy + (t.major ? L * 0.4 : 0));
    }
    for (const t of r.v) {
      const L = (t.major ? 8 : 4) * dpr;
      c.moveTo(cx - L, t.y);
      c.lineTo(cx + L, t.y);
    }
    c.moveTo(cx, cy - milToPx(3, fpx));
    c.lineTo(cx, cy - milToPx(25, fpx));
    c.stroke();
    for (const l of r.labels) c.fillText(l.text, l.x, cy - 17 * dpr);
  } else {
    const band = 26 * dpr;
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fillRect(0, 0, W, band);
    c.strokeStyle = 'rgba(232,176,74,.9)';
    c.fillStyle = 'rgba(232,176,74,.95)';
    c.lineWidth = dpr;
    for (const t of tapeTicks(aim.h, fpx, cx, W)) {
      c.moveTo(t.x, band);
      c.lineTo(t.x, (t.big ? 16 : 21) * dpr);
      if (t.label) c.fillText(t.label, t.x, 8 * dpr);
    }
    c.stroke();
    c.beginPath();
    c.moveTo(cx, band);
    c.lineTo(cx - 5 * dpr, band + 6 * dpr);
    c.lineTo(cx + 5 * dpr, band + 6 * dpr);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      c.moveTo(cx + dx * 8 * dpr, cy + dy * 8 * dpr);
      c.lineTo(cx + dx * 3 * dpr, cy + dy * 3 * dpr);
    }
    c.stroke();
  }

  c.font = `${Math.round(12 * dpr)}px ${FONT}`;
  c.textAlign = 'left';
  const pad = 10 * dpr;
  const top = (bino ? 16 : 44) * dpr;
  const az = String(Math.round(aim.h) % 6400).padStart(4, '0');
  const text = `${bino ? '쌍안경 7×' : '육안'}  방위각 ${az} 밀  고저 ${Math.round(aim.p)} 밀`;
  c.fillStyle = 'rgba(0,0,0,.55)';
  c.fillRect(pad - 4 * dpr, top - 10 * dpr, c.measureText(text).width + 8 * dpr, 20 * dpr);
  c.fillStyle = 'rgba(232,176,74,.95)';
  c.fillText(text, pad, top);
  c.textAlign = 'right';
  if (fps !== null) c.fillText(`${fps} fps`, W - pad, top);
  if (splash) {
    c.fillStyle = splash.urgent ? 'rgba(226,96,74,1)' : 'rgba(232,176,74,.95)';
    c.fillText(`탄착까지 ${splash.sec}초${splash.urgent ? ' — 관측!' : ''}`, W - pad, top + 20 * dpr);
  }
  c.restore();
}
