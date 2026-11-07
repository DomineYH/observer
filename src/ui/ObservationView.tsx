// 관측 화면: the voxel view drawn every frame, aimed by dragging and the arrow keys, 쌍안경 with B or its button,
// the 화질 buttons, and a tap that names a target by its angles (demo lines 1185–1234, 1336–1342, 1370–1389).
// Panels never step the simulation.
import { useEffect, useRef, useState } from 'react';
import type { Input, ReadonlySimState, TerrainData, Weather } from '@sim';
import { drawEffects } from '@render/effects';
import { drawOverlay, drawRain, rainStreaks, splashOf } from '@render/overlay';
import { angleAt, eyeAt, QUALITIES, type Quality, type ViewGeometry } from '@render/projection';
import { atmosphere, type TerrainColours } from '@render/shade';
import { drawSprites, spritesOf } from '@render/sprites';
import { createViewBuffers, renderView, type ViewBuffers } from '@render/voxel';
import { createAimControl } from './aim';
import { postStatus } from './post';
import { LaseReadout } from './Laser';

const TAP_PX = 5;
const QUALITY_NAMES: Record<Quality, string> = { medium: '보통', high: '높음', max: '최고' };

export interface ObservationViewProps {
  terrain: TerrainData;
  colours: TerrainColours;
  weather: Weather;
  /** The simulation's read-only state, read every frame. */
  state: ReadonlySimState;
  send: (input: Input) => void;
  /** Calls `draw` once per frame until the returned function is called. */
  onFrame: (draw: (now: number) => void) => () => void;
  showFps: boolean;
  /** 화질, the player's choice: held above the view so a new game (which remounts it) keeps it. */
  quality: Quality;
  onQuality: (q: Quality) => void;
}

export function ObservationView({ terrain, colours, weather, state, send, onFrame, showFps, quality, onQuality }: ObservationViewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bino, setBino] = useState(state.bino);
  // Made once: it starts from the simulation's aim and remembers the value it sent last.
  const [aim] = useState(() => createAimControl(state, send));
  // The last frame drawn and its internal width: a tap is turned into angles against what was on screen.
  const shown = useRef<{ geom: ViewGeometry; w: number } | null>(null);

  useEffect(() => {
    const view = ref.current!;
    const c = view.getContext('2d')!;
    const buf = createViewBuffers(QUALITIES[quality]);
    const low = document.createElement('canvas');
    low.width = buf.w;
    low.height = buf.h;
    const lctx = low.getContext('2d')!;
    const image = new ImageData(buf.pix as Uint8ClampedArray<ArrayBuffer>, buf.w, buf.h);
    let frames = 0;
    let since = 0;
    let fps: number | null = showFps ? 0 : null;
    const fog = atmosphere(weather).fog;
    const under = (b: ViewBuffers, g: ViewGeometry) => drawEffects(b, g, state, weather);
    return onFrame((now) => {
      const dpr = window.devicePixelRatio || 1;
      const r = view.getBoundingClientRect();
      const W = Math.round(r.width * dpr);
      const H = Math.round(r.height * dpr);
      if (view.width !== W || view.height !== H) {
        view.width = W;
        view.height = H;
      }
      const on = aim.bino();
      setBino(on);
      if (state.phase === 'prep') {
        // Before the post is occupied the view stays dark (demo 1194); the candidate preview is a later slice.
        c.fillStyle = '#0b0e0a';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#8b947c';
        c.textAlign = 'center';
        c.font = `${Math.round(14 * dpr)}px monospace`;
        c.fillText('관측소 점령 전 — 지도와 첩보로 판단하십시오', W / 2, H / 2);
        return;
      }
      const a = aim.aim();
      const geom = renderView(buf, terrain, colours, eyeAt(terrain, state.op), a, on, weather, under);
      shown.current = { geom, w: buf.w };
      lctx.putImageData(image, 0, 0);
      c.imageSmoothingEnabled = false;
      c.drawImage(low, 0, 0, W, H);
      drawSprites(c, spritesOf(state, geom, terrain, weather), W / buf.w, on, dpr, fog); // only what the simulation sees
      drawRain(c, rainStreaks(weather, a.h, W, H, dpr, now / 1000), dpr);
      if (fps !== null) {
        frames++;
        if (now - since >= 1000) {
          fps = Math.round((frames * 1000) / (now - since));
          frames = 0;
          since = now;
        }
      }
      drawOverlay(c, geom.focal, W / buf.w, a, on, dpr, fps, splashOf(state));
      const status = postStatus(state); // 관측소 이동 중 / 장비 설치 중 (demo 1228)
      if (status) {
        c.font = `${Math.round(14 * dpr)}px monospace`;
        c.textAlign = 'center';
        const w = c.measureText(status).width;
        c.fillStyle = 'rgba(0,0,0,.6)';
        c.fillRect(W / 2 - w / 2 - 10 * dpr, H / 2 - 14 * dpr, w + 20 * dpr, 28 * dpr);
        c.fillStyle = '#62aee6';
        c.fillText(status, W / 2, H / 2 + 5 * dpr);
        c.textAlign = 'left';
      }
    });
  }, [quality, terrain, colours, weather, state, aim, onFrame, showFps]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (aim.key(e.key, e.shiftKey)) e.preventDefault();
      else if (e.key === 'b' || e.key === 'B') aim.toggleBino();
      else if ((e.key === 'r' || e.key === 'R') && !e.repeat && state.phase === 'live') aim.lase();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [aim]);

  // `travel`: how far the pointer has gone from where it went down, CSS pixels. Under 5 it is a tap, not a drag.
  const drag = useRef<{ x0: number; y0: number; x: number; y: number; travel: number } | null>(null);
  return (
    <section aria-label="관측">
      <canvas
        ref={ref}
        role="img"
        aria-label="관측 화면"
        style={{ display: 'block', width: '100%', maxWidth: 960, aspectRatio: '16 / 9', touchAction: 'none', cursor: 'crosshair', background: '#000' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, travel: 0 };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          aim.drag(e.clientX - d.x, e.clientY - d.y, e.currentTarget.getBoundingClientRect().width);
          d.x = e.clientX;
          d.y = e.clientY;
          d.travel = Math.max(d.travel, Math.hypot(d.x - d.x0, d.y - d.y0));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          const v = shown.current;
          if (!d || d.travel >= TAP_PX || !v || state.phase !== 'live') return;
          const r = e.currentTarget.getBoundingClientRect();
          const { az, el } = angleAt(v.geom, v.w / r.width, e.clientX - r.left, e.clientY - r.top);
          send({ a: 'id', v: [az, el] }); // the simulation decides what, if anything, was pressed
        }}
        onPointerCancel={() => (drag.current = null)}
      />
      <button type="button" aria-pressed={bino} disabled={state.post.state === 'moving'} onClick={() => aim.toggleBino()}>
        쌍안경
      </button>
      <button type="button" disabled={state.phase !== 'live' || state.post.state !== 'ready'} onClick={() => aim.lase()}>
        레이저 <kbd>R</kbd>
      </button>
      <LaseReadout lases={state.lases} mode={state.mode} grid={terrain.grid} />
      <span role="group" aria-label="화질">
        {(Object.keys(QUALITIES) as Quality[]).map((q) => (
          <button key={q} type="button" aria-pressed={q === quality} onClick={() => onQuality(q)}>
            {QUALITY_NAMES[q]}
          </button>
        ))}
      </span>
    </section>
  );
}
