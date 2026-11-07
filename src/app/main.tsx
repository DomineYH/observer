// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createSim, underCanopy } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { terrainColours } from '@render/shade';
import { Composer } from '@ui/Composer';
import { MapPanel } from '@ui/MapPanel';
import { ObservationView } from '@ui/ObservationView';
import { PrepPanel } from '@ui/PrepPanel';
import { RadioLog, type LogLine } from '@ui/RadioLog';
import { TargetList } from '@ui/TargetList';
import { TickCounter } from '@ui/TickCounter';
import { moveStarted, postNote, reportError, SKIPPED } from '@ui/post';
import { selectBackend } from './backend';
import { CLEAR_WEATHER } from './clearWeather';
import { startLoop } from './loop';
import { chooseSeed } from './seed';
import { createSession } from './session';

selectBackend(import.meta.env.VITE_OBSERVER_BACKEND);

// The only clock read: today's KST date picks the daily seed unless the address names a practice seed.
const { seed, seedKind } = chooseSeed(location.search, Date.now());
const terrain = await mockTerrain.load(seed);
const sim = createSim({
  seed,
  seedKind,
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
// 무전 기록: a new array on every append, so its identity is a valid snapshot.
let log: readonly LogLine[] = [];
let started = false;
const step = () => {
  const due = sim.state.reportDue;
  const events = session.step();
  const s = sim.state;
  const lines: LogLine[] = [];
  const say = (texts: readonly (string | null)[]) => {
    for (const text of texts) if (text) lines.push({ type: 'system', tick: s.tick, text });
  };
  if (!started && s.phase === 'live') {
    started = true;
    say(['작전 개시.']);
  }
  let readBack = false;
  for (const e of events) {
    if (e.type === 'post') say(postNote(e, s.platoons, underCanopy(terrain, s.op.x, s.op.y)));
    if (e.type !== 'radio') continue;
    lines.push(e);
    const u = e.utterance;
    if (u.kind === 'move_notice' && u.speaker === 'observer' && s.post.move) say(moveStarted(s.post.move, BASE_SCENARIO.frontY));
    if (u.kind === 'position_report' && u.speaker === 'fdc') {
      readBack = true;
      say([reportError(s.knownOp, s.op, s.mode)]);
    }
  }
  if (due && !s.reportDue && !readBack) say([SKIPPED]);
  if (lines.length) log = [...log, ...lines];
};
let lastPublish = 0;
startLoop(step, (now) => {
  frameListeners.forEach((draw) => draw(now));
  if (now - lastPublish < PUBLISH_MS) return;
  lastPublish = now;
  listeners.forEach((l) => l());
});

const colours = terrainColours(terrain, CLEAR_WEATHER);
const showFps = new URLSearchParams(location.search).get('fps') === '1'; // 사람 검수용 fps 표시

// Placeholders until the account slice (callsign) and the terrain slice (방안 기준) arrive.
const CALLSIGN = '갈매기';
function App() {
  const tick = useSyncExternalStore(subscribe, () => sim.state.tick);
  // The simulation replaces these objects when they change, so their identity is a valid snapshot.
  const phase = useSyncExternalStore(subscribe, () => sim.state.phase);
  const op = useSyncExternalStore(subscribe, () => sim.state.op);
  const picked = useSyncExternalStore(subscribe, () => sim.state.picked);
  const reportDue = useSyncExternalStore(subscribe, () => sim.state.reportDue);
  const stage = useSyncExternalStore(subscribe, () => sim.state.radio.stage);
  const lines = useSyncExternalStore(subscribe, () => log);
  const names = { callsign: CALLSIGN, gridLetters: terrain.grid.letters };
  return (
    <>
      <TickCounter tick={tick} />
      <ObservationView
        terrain={terrain}
        colours={colours}
        weather={CLEAR_WEATHER}
        state={sim.state}
        send={session.send}
        onFrame={onFrame}
        showFps={showFps}
      />
      <PrepPanel
        state={{ phase, op, picked, reportDue }}
        scenario={BASE_SCENARIO}
        grid={terrain.grid}
        seed={seed}
        seedKind={seedKind}
        weather={CLEAR_WEATHER}
        send={session.send}
        queued={session.queued}
        live={sim.state}
      />
      <TargetList platoons={sim.state.platoons} /* re-rendered with the tick above */ />
      <MapPanel terrain={terrain} scenario={BASE_SCENARIO} state={sim.state} send={session.send} onFrame={onFrame} />
      <Composer stage={stage} live={phase === 'live'} platoons={sim.state.platoons} names={names} grid={terrain.grid} mode={sim.state.mode} send={session.send} state={sim.state} />
      <RadioLog lines={lines} callsign={CALLSIGN} gridLetters={terrain.grid.letters} mode={sim.state.mode} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
