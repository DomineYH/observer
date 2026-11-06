// 관측 화면: the voxel view drawn every frame, aimed by dragging and the arrow keys, 쌍안경 with B or its button,
// and the 화질 buttons (demo lines 1185–1234, 1336–1342, 1370–1389). Panels never step the simulation.
import { useEffect, useRef, useState } from 'react';
import type { Input, ReadonlySimState, TerrainData, Weather } from '@sim';
import { drawOverlay } from '@render/overlay';
import { DEFAULT_QUALITY, QUALITIES, type Eye, type Quality } from '@render/projection';
import type { TerrainColours } from '@render/shade';
import { createViewBuffers, renderView } from '@render/voxel';
import { createAimControl } from './aim';

const QUALITY_NAMES: Record<Quality, string> = { medium: '보통', high: '높음', max: '최고' };

export interface ObservationViewProps {
  terrain: TerrainData;
  colours: TerrainColours;
  weather: Weather;
  eye: Eye;
  /** The simulation's read-only state, read every frame. */
  state: ReadonlySimState;
  send: (input: Input) => void;
  /** Calls `draw` once per frame until the returned function is called. */
  onFrame: (draw: (now: number) => void) => () => void;
  showFps: boolean;
}

export function ObservationView({ terrain, colours, weather, eye, state, send, onFrame, showFps }: ObservationViewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY);
  const [bino, setBino] = useState(state.bino);
  // Made once: it starts from the simulation's aim and remembers the value it sent last.
  const [aim] = useState(() => createAimControl(state, send));

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
      const a = aim.aim();
      const geom = renderView(buf, terrain, colours, eye, a, on, weather);
      lctx.putImageData(image, 0, 0);
      c.imageSmoothingEnabled = false;
      c.drawImage(low, 0, 0, W, H);
      if (fps !== null) {
        frames++;
        if (now - since >= 1000) {
          fps = Math.round((frames * 1000) / (now - since));
          frames = 0;
          since = now;
        }
      }
      drawOverlay(c, geom.focal, W / buf.w, a, on, dpr, fps);
    });
  }, [quality, terrain, colours, weather, eye, state, aim, onFrame, showFps]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (aim.key(e.key, e.shiftKey)) e.preventDefault();
      else if (e.key === 'b' || e.key === 'B') aim.toggleBino();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [aim]);

  const drag = useRef<{ x: number; y: number } | null>(null);
  return (
    <section aria-label="관측">
      <canvas
        ref={ref}
        role="img"
        aria-label="관측 화면"
        style={{ display: 'block', width: '100%', maxWidth: 960, aspectRatio: '16 / 9', touchAction: 'none', cursor: 'crosshair', background: '#000' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          aim.drag(e.clientX - d.x, e.clientY - d.y, e.currentTarget.getBoundingClientRect().width);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <button type="button" aria-pressed={bino} onClick={() => aim.toggleBino()}>
        쌍안경
      </button>
      <span role="group" aria-label="화질">
        {(Object.keys(QUALITIES) as Quality[]).map((q) => (
          <button key={q} type="button" aria-pressed={q === quality} onClick={() => setQuality(q)}>
            {QUALITY_NAMES[q]}
          </button>
        ))}
      </span>
    </section>
  );
}
