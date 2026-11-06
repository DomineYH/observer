// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createSim } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { MapPanel } from '@ui/MapPanel';
import { TickCounter } from '@ui/TickCounter';
import { selectBackend } from './backend';
import { CLEAR_WEATHER } from './clearWeather';
import { startLoop } from './loop';

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
let lastPublish = 0;
startLoop(sim, (now) => {
  if (now - lastPublish < PUBLISH_MS) return;
  lastPublish = now;
  listeners.forEach((l) => l());
});

function App() {
  const tick = useSyncExternalStore(subscribe, () => sim.state.tick);
  return (
    <>
      <TickCounter tick={tick} />
      <MapPanel terrain={terrain} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
