// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createSim, underCanopy, type ReplayData } from '@sim';
import type { StoredRun } from '@adapters/index';
import { mockAccount } from '@adapters/mock/account';
import { mockArchive } from '@adapters/mock/records';
import { mockTerrain } from '@adapters/mock/terrain';
import { silentVoice } from '@adapters/mock/voice';
import { webSpeech } from '@adapters/webSpeech';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
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
import { CallsignForm } from '@ui/CallsignForm';
import { RankingDialog } from '@ui/Ranking';
import { moveStarted, postNote, reportError, SKIPPED } from '@ui/post';
import { selectBackend } from './backend';
import { CLEAR_WEATHER } from './clearWeather';
import { startLoop } from './loop';
import { submissionOf } from './records';
import { chooseSeed } from './seed';
import { createSession } from './session';

selectBackend(import.meta.env.VITE_OBSERVER_BACKEND);

// The only clock read: today's KST date picks the daily seed unless the address names a practice seed.
const { seed, seedKind } = chooseSeed(location.search, Date.now());
const terrain = await mockTerrain.load(seed);
const init = { seed, seedKind, scenario: BASE_SCENARIO, guns: BASE_GUNS, weather: CLEAR_WEATHER, mode: 'standard' } as const;
const sim = createSim({ ...init, terrain });

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
// 계정 and 기록 보관소 (M1: this browser's storage). Until a callsign is set the radio uses the placeholder 갈매기.
// NAMES is one object the sound holds too, so a new callsign reaches it in place.
const account = mockAccount(localStorage);
const archive = mockArchive(localStorage);
const NAMES = { callsign: (await account.callsign()) ?? '갈매기', gridLetters: terrain.grid.letters };
const claim: typeof account.claim = async (c) => {
  const r = await account.claim(c);
  if (r.ok) NAMES.callsign = r.callsign;
  listeners.forEach((l) => l());
  return r;
};
// Once the game has ended: its 재생 자료, submitted once with the 판 기록 and 임무 요약; a new object on each change.
let result: { replay: ReplayData; saved: StoredRun | 'pending' | 'failed' } | null = null;
const submitOnEnd = () => {
  if (result || sim.state.phase !== 'ended') return;
  const submission = submissionOf(NAMES.callsign, sim, init, session.log);
  const done = (saved: StoredRun | 'failed') => void (result = { replay: submission.replay, saved });
  result = { replay: submission.replay, saved: 'pending' };
  archive.submit(submission).then(done, () => done('failed'));
};
// 음성 출력 is the user's 음성 setting, not the backend variable; browsers without speech synthesis get the 무음 어댑터.
const audio = webAudio();
const sound = createSound('speechSynthesis' in window ? webSpeech : silentVoice(), audio, NAMES);
for (const gesture of ['pointerdown', 'keydown']) addEventListener(gesture, audio.unlock, { once: true });
// 무전 기록: a new array on every append, so its identity is a valid snapshot.
let log: readonly LogLine[] = [];
let started = false;
const step = () => {
  const due = sim.state.reportDue;
  const events = session.step();
  submitOnEnd();
  const s = sim.state;
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

const colours = terrainColours(terrain, CLEAR_WEATHER);
const showFps = new URLSearchParams(location.search).get('fps') === '1'; // 사람 검수용 fps 표시

function App() {
  const tick = useSyncExternalStore(subscribe, () => sim.state.tick);
  // The simulation replaces these objects when they change, so their identity is a valid snapshot.
  const phase = useSyncExternalStore(subscribe, () => sim.state.phase);
  const score = useSyncExternalStore(subscribe, () => sim.state.score);
  const rounds = useSyncExternalStore(subscribe, () => sim.record().roundsTotal);
  const op = useSyncExternalStore(subscribe, () => sim.state.op);
  const picked = useSyncExternalStore(subscribe, () => sim.state.picked);
  const reportDue = useSyncExternalStore(subscribe, () => sim.state.reportDue);
  const stage = useSyncExternalStore(subscribe, () => sim.state.radio.stage);
  const lines = useSyncExternalStore(subscribe, () => log);
  const callsign = useSyncExternalStore(subscribe, () => NAMES.callsign);
  const ended = useSyncExternalStore(subscribe, () => result);
  const names = { callsign, gridLetters: terrain.grid.letters };
  return (
    <>
      {ended && <Debrief state={sim.state} record={sim.record()} grid={terrain.grid} callsign={callsign} saved={ended.saved} replay={ended.replay} />}
      <TickCounter tick={tick} />
      <HeadBand tick={tick} score={score} rounds={rounds} />
      <SoundToggles sound={sound} />
      <CallsignForm callsign={callsign} editable={phase === 'prep'} claim={claim} />
      <RankingDialog archive={archive} callsign={callsign} />
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
        terrain={terrain}
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
      <RadioLog lines={lines} callsign={callsign} gridLetters={terrain.grid.letters} mode={sim.state.mode} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
