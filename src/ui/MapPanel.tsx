// 지도 패널 (F-06, demo lines 1258–1320, 1390–1420): the map with the briefing and the post, zoomed by wheel or buttons
// and dragged. Pressing it picks the 관측소 후보 in prep; once started it reads the 좌표자.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Input, Point, ReadonlySimState, Scenario, TerrainData, Weather } from '@sim';
import { drawMap, MAP_PX, mapBase } from '@render/map';
import { centreOn, FULL_VIEW, moveCheck, panBy, planMove, pointAt, underCanopy, zoomAt, type MapView } from '@render/mapView';
import { fovOf } from '@render/projection';
import { viewshed } from '@render/viewshed';
import { BLOCKED, moveLabel } from './post';
import { gridLabel } from './radio/readings';

const REDRAW_MS = 120; // the demo's map rate
const DRAG_PX = 5; // a press that moves farther is a drag, not a click
const VS_CELLS = 192; // 가시권 cells across the map (demo); one sweep is ~37k 가시선, a few hundred ms

/** The 가시권 pixels as an image for the map to draw. */
function viewshedImage(t: TerrainData, op: Point) {
  const image = document.createElement('canvas');
  image.width = image.height = VS_CELLS;
  image.getContext('2d')!.putImageData(new ImageData(viewshed(t, op, VS_CELLS) as Uint8ClampedArray<ArrayBuffer>, VS_CELLS), 0, 0);
  return { image, g: VS_CELLS };
}

export interface MapPanelProps {
  terrain: TerrainData;
  scenario: Scenario;
  state: ReadonlySimState;
  send: (input: Input) => void;
  onFrame: (draw: (now: number) => void) => () => void;
  weather: Weather;
}

export function MapPanel({ terrain, scenario, state, send, onFrame, weather }: MapPanelProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<MapView>(FULL_VIEW);
  const [pin, setPin] = useState<(Point & { e: number; n: number }) | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  // 가시권 표시, training only (demo 1405: off again in standard). It is worked out from where the post stands, not
  // while it walks.
  const training = state.mode === 'training';
  const [vsOn, setVsOn] = useState(false);
  if (!training && vsOn) setVsOn(false);
  const [from, setFrom] = useState(state.op);
  if (state.post.state !== 'moving' && from !== state.op) setFrom(state.op);
  const shownVs = training && vsOn;
  const vs = useMemo(() => (shownVs ? viewshedImage(terrain, from) : null), [shownVs, terrain, from]);

  useEffect(() => {
    const { n } = terrain;
    const b = document.createElement('canvas');
    b.width = b.height = n;
    b.getContext('2d')!.putImageData(new ImageData(mapBase(terrain) as Uint8ClampedArray<ArrayBuffer>, n, n), 0, 0);
    setBase(b);
  }, [terrain]);

  const draw = useCallback(() => {
    const c = ref.current?.getContext('2d');
    if (!c || !base) return;
    drawMap(c, terrain, base, view, { scenario, op: state.op, knownOp: state.knownOp, dest: state.post.move?.to ?? null, az: state.aim.az, fovMil: fovOf(state.bino), pin, platoons: state.platoons, mode: state.mode, missions: state.missions, tick: state.tick, weather, viewshed: vs });
  }, [terrain, base, view, scenario, state, pin, weather, vs]);

  useEffect(() => {
    draw();
    let last = 0;
    return onFrame((now) => {
      if (now - last < REDRAW_MS) return;
      last = now;
      draw();
    });
  }, [draw, onFrame]);

  // Wheel zoom at the cursor; a native listener, since React's wheel listener cannot prevent the page scroll.
  useEffect(() => {
    const el = ref.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => zoomAt(terrain, v, e.deltaY < 0 ? 1.25 : 0.8, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [terrain]);

  const press = useRef<{ x: number; y: number; sx: number; sy: number; dragged: boolean } | null>(null);
  const zoom = (f: number) => setView((v) => zoomAt(terrain, v, f, 0.5, 0.5));

  return (
    <section aria-label="지도 패널">
      <canvas
        ref={ref}
        width={MAP_PX}
        height={MAP_PX}
        role="img"
        aria-label="지도"
        style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          press.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, dragged: false };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p) return;
          if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > DRAG_PX) p.dragged = true;
          if (p.dragged) {
            const r = e.currentTarget.getBoundingClientRect();
            const dx = (e.clientX - p.x) / r.width;
            const dy = (e.clientY - p.y) / r.height;
            setView((v) => panBy(terrain, v, dx, dy));
          }
          p.x = e.clientX;
          p.y = e.clientY;
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          if (!p || p.dragged) return;
          const r = e.currentTarget.getBoundingClientRect();
          const at = pointAt(terrain, view, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
          if (state.phase === 'prep') send({ a: 'pick', v: [at.x, at.y] });
          else setPin(at);
        }}
        onPointerCancel={() => (press.current = null)}
      />
      <div>
        <button type="button" onClick={() => zoom(1.5)}>
          확대
        </button>
        <button type="button" onClick={() => zoom(1 / 1.5)}>
          축소
        </button>
        <button type="button" onClick={() => setView(FULL_VIEW)}>
          전체 지도
        </button>
        <button type="button" onClick={() => setView((v) => centreOn(terrain, v, state.op, Math.max(v.z, 3)))}>
          관측소로
        </button>
        <output aria-label="지도 배율">×{Math.round(view.z * 10) / 10}</output>
      </div>
      {training && (
        <label>
          <input type="checkbox" checked={vsOn} onChange={(e) => setVsOn(e.target.checked)} /> 가시권 표시{' '}
          <small>(훈련 전용 · 관측소에서 보이지 않는 땅을 어둡게)</small>
        </label>
      )}
      {pin && (
        <p>
          좌표자: {gridLabel(terrain.grid.letters, pin)}
        </p>
      )}
      {pin && state.phase === 'live' && <MoveTo terrain={terrain} state={state} to={{ x: Math.round(pin.x), y: Math.round(pin.y) }} send={send} />}
    </section>
  );
}

/** 관측소 이동 to the 좌표자 point (demo 1417–1419): distance, walking time and forest on the way, or why not. */
function MoveTo({ terrain, state, to, send }: { terrain: TerrainData; state: ReadonlySimState; to: Point; send: (input: Input) => void }) {
  const block = moveCheck(state, terrain, to);
  if (block) return <p>이동 불가: {BLOCKED[block]}</p>;
  return (
    <p>
      <button type="button" onClick={() => send({ a: 'move', v: [to.x, to.y] })}>
        {moveLabel(planMove(terrain, state.op, to))}
      </button>
      {underCanopy(terrain, to.x, to.y) && ' 도착지가 숲 속 — 시야가 가립니다'}
    </p>
  );
}
