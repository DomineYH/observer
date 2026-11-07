// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { underCanopy } from '@sim';
import { mockTerrain } from '@adapters/mock/terrain';
import { silentVoice } from '@adapters/mock/voice';
import { webSpeech } from '@adapters/webSpeech';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { DEFAULT_QUALITY, type Quality } from '@render/projection';
import { terrainColours } from '@render/shade';
import { Composer } from '@ui/Composer';
import { MapPanel } from '@ui/MapPanel';
import { ObservationView } from '@ui/ObservationView';
import { PrepPanel } from '@ui/PrepPanel';
import { RadioLog, type LogLine } from '@ui/RadioLog';
import { webAudio } from '@ui/audio';
import { createSound } from '@ui/sound';
import { SoundToggles } from '@ui/SoundToggles';
import { TargetList } from '@ui/TargetList';
import { TickCounter } from '@ui/TickCounter';
import { HeadBand } from '@ui/HeadBand';
import { Debrief } from '@ui/Debrief';
import { moveStarted, postNote, reportError, SKIPPED } from '@ui/post';
import { selectBackend } from './backend';
import type { WeatherPreset } from '@adapters/index';
import { mockWeather } from '@adapters/mock/weather';
import { newGame } from './game';
import { startLoop } from './loop';
import { chooseSeed } from './seed';

selectBackend(import.meta.env.VITE_OBSERVER_BACKEND);

// The only clock read: today's KST date picks the daily seed unless the address names a practice seed.
const { seed, seedKind } = chooseSeed(location.search, Date.now());
const terrain = await mockTerrain.load(seed);
// A practice seed starts in clear weather and may change it during 작전 준비; a daily seed's weather comes with the seed.
let preset: WeatherPreset | null = seedKind === 'practice' ? 'clear' : null;
// Replaced as a whole on a weather change: read `game` at use, never keep its sim or session.
let games = 0; // a new game remounts the panels that keep their own state from the game they started with
let game = newGame({
  seed,
  seedKind,
  scenario: BASE_SCENARIO,
  guns: BASE_GUNS,
  weather: await mockWeather.load(seed, seedKind, preset ?? undefined),
  mode: 'standard',
  terrain,
});

const PUBLISH_MS = 100; // panels read state at a low rate
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const send = (input: Parameters<typeof game.session.send>[0]) => game.session.send(input);
// The observation view draws every frame; the other panels read state at the publish rate.
const frameListeners = new Set<(now: number) => void>();
const onFrame = (draw: (now: number) => void) => {
  frameListeners.add(draw);
  return () => void frameListeners.delete(draw);
};
// Placeholders until the account slice (callsign) and the terrain slice (방안 기준) arrive.
const CALLSIGN = '갈매기';
const NAMES = { callsign: CALLSIGN, gridLetters: terrain.grid.letters };
// 음성 출력 is the user's 음성 setting, not the backend variable; browsers without speech synthesis get the 무음 어댑터.
const audio = webAudio();
const sound = createSound('speechSynthesis' in window ? webSpeech : silentVoice(), audio, NAMES);
for (const gesture of ['pointerdown', 'keydown']) addEventListener(gesture, audio.unlock, { once: true });
// 무전 기록: a new array on every append, so its identity is a valid snapshot.
let log: readonly LogLine[] = [];
let started = false;
const step = () => {
  const due = game.sim.state.reportDue;
  const events = game.session.step();
  const s = game.sim.state;
  sound.hear(events, s);
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

let colours = terrainColours(terrain, game.init.weather);

/** 연습 시드의 기상 변경 (F-30): only in 작전 준비; a new simulation and 입력 기록, with the 관측소 후보 put in again. */
async function changeWeather(p: WeatherPreset): Promise<void> {
  if (seedKind !== 'practice' || game.sim.state.phase !== 'prep') return;
  const weather = await mockWeather.load(seed, seedKind, p);
  if (game.sim.state.phase !== 'prep') return; // started while the weather was on its way
  game = newGame({ ...game.init, weather }, game);
  games++;
  colours = terrainColours(terrain, weather);
  preset = p;
  log = [];
  started = false;
  listeners.forEach((l) => l());
}
const showFps = new URLSearchParams(location.search).get('fps') === '1'; // 사람 검수용 fps 표시

function App() {
  const { sim, init } = useSyncExternalStore(subscribe, () => game);
  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY); // outlives the per-game view
  const tick = useSyncExternalStore(subscribe, () => game.sim.state.tick);
  // The simulation replaces these objects when they change, so their identity is a valid snapshot.
  const phase = useSyncExternalStore(subscribe, () => game.sim.state.phase);
  const score = useSyncExternalStore(subscribe, () => game.sim.state.score);
  const rounds = useSyncExternalStore(subscribe, () => game.sim.record().roundsTotal);
  const op = useSyncExternalStore(subscribe, () => game.sim.state.op);
  const picked = useSyncExternalStore(subscribe, () => game.sim.state.picked);
  const reportDue = useSyncExternalStore(subscribe, () => game.sim.state.reportDue);
  const stage = useSyncExternalStore(subscribe, () => game.sim.state.radio.stage);
  const lines = useSyncExternalStore(subscribe, () => log);
  const names = { callsign: CALLSIGN, gridLetters: terrain.grid.letters };
  return (
    <>
      {phase === 'ended' && <Debrief state={sim.state} record={sim.record()} grid={terrain.grid} />}
      <TickCounter tick={tick} />
      <HeadBand tick={tick} score={score} rounds={rounds} />
      <SoundToggles sound={sound} />
      <ObservationView
        key={games}
        quality={quality}
        onQuality={setQuality}
        terrain={terrain}
        colours={colours}
        weather={init.weather}
        state={sim.state}
        send={send}
        onFrame={onFrame}
        showFps={showFps}
      />
      <PrepPanel
        state={{ phase, op, picked, reportDue }}
        scenario={BASE_SCENARIO}
        terrain={terrain}
        seed={seed}
        seedKind={seedKind}
        weather={init.weather}
        send={send}
        queued={game.session.queued}
        live={sim.state}
        preset={preset}
        onPreset={(p) => void changeWeather(p)}
      />
      <TargetList platoons={sim.state.platoons} /* re-rendered with the tick above */ />
      <MapPanel terrain={terrain} scenario={BASE_SCENARIO} state={sim.state} send={send} onFrame={onFrame} weather={init.weather} />
      <Composer stage={stage} live={phase === 'live'} platoons={sim.state.platoons} names={names} grid={terrain.grid} mode={sim.state.mode} send={send} state={sim.state} />
      <RadioLog lines={lines} callsign={CALLSIGN} gridLetters={terrain.grid.letters} mode={sim.state.mode} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
