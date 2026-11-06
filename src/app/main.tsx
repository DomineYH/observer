// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createSim, EYE_HEIGHT, heightAt } from '@sim';
import type { RadioUtterance } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO, PLANNED_OP } from '@content/scenario';
import { terrainColours } from '@render/shade';
import { MapPanel } from '@ui/MapPanel';
import { ObservationView } from '@ui/ObservationView';
import { RadioLog } from '@ui/RadioLog';
import { TickCounter } from '@ui/TickCounter';
import { selectBackend } from './backend';
import { CLEAR_WEATHER } from './clearWeather';
import { startLoop } from './loop';
import { createSession } from './session';

selectBackend(import.meta.env.VITE_OBSERVER_BACKEND);

// Fixed daily seed until the seed slice brings the KST daily-seed function.
const seed = 20261106;
const terrain = await mockTerrain.load(seed);
const sim = createSim({
  seed,
  seedKind: 'daily',
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: CLEAR_WEATHER,
  mode: 'standard',
  terrain,
});

const PUBLISH_MS = 100; // panels read state at a low rate
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const session = createSession(sim);
// The observation view draws every frame; the other panels read state at the publish rate.
const frameListeners = new Set<(now: number) => void>();
const onFrame = (draw: (now: number) => void) => {
  frameListeners.add(draw);
  return () => void frameListeners.delete(draw);
};
let lastPublish = 0;
startLoop(session.step, (now) => {
  frameListeners.forEach((draw) => draw(now));
  if (now - lastPublish < PUBLISH_MS) return;
  lastPublish = now;
  listeners.forEach((l) => l());
});

// Until the 작전 준비 slice, the view looks from the planned observation post.
const eye = { ...PLANNED_OP, z: heightAt(terrain, PLANNED_OP.x, PLANNED_OP.y) + EYE_HEIGHT };
const colours = terrainColours(terrain, CLEAR_WEATHER);
const showFps = new URLSearchParams(location.search).get('fps') === '1'; // 사람 검수용 fps 표시

// Placeholders until the account slice (callsign) and the terrain slice (방안 기준) arrive.
const CALLSIGN = '갈매기';
// A fixed example until the radio state machine emits real utterances (M1-8a).
const EXAMPLE: RadioUtterance[] = [
  {
    speaker: 'observer',
    ending: 'over',
    kind: 'correction',
    slots: { direction: 4720, lateralDir: 'right', lateral: 60, rangeDir: 'drop', range: 200, next: 'ffe' },
  },
];

function App() {
  const tick = useSyncExternalStore(subscribe, () => sim.state.tick);
  return (
    <>
      <TickCounter tick={tick} />
      <ObservationView
        terrain={terrain}
        colours={colours}
        weather={CLEAR_WEATHER}
        eye={eye}
        state={sim.state}
        send={session.send}
        onFrame={onFrame}
        showFps={showFps}
      />
      <MapPanel terrain={terrain} />
      <RadioLog utterances={EXAMPLE} callsign={CALLSIGN} gridLetters={terrain.grid.letters} mode={sim.state.mode} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
