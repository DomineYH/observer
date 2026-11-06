// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createSim } from '@sim';
import type { RadioUtterance } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { RadioLog } from '@ui/RadioLog';
import { TickCounter } from '@ui/TickCounter';
import { selectBackend } from './backend';
import { CLEAR_WEATHER } from './clearWeather';
import { startLoop } from './loop';

selectBackend(import.meta.env.VITE_OBSERVER_BACKEND);

// Fixed daily seed until the seed slice brings the KST daily-seed function.
const sim = createSim({
  seed: 20261106,
  seedKind: 'daily',
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: CLEAR_WEATHER,
  mode: 'standard',
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

// Placeholders until the account slice (callsign) and the terrain slice (방안 기준) arrive.
const CALLSIGN = '갈매기';
const GRID_LETTERS = 'CH';
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
      <RadioLog utterances={EXAMPLE} callsign={CALLSIGN} gridLetters={GRID_LETTERS} mode={sim.state.mode} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
