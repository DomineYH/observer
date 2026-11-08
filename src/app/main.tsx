// 조립 지점: reads the environment, builds the simulation, owns the frame loop and hands panels read-only state.
import { StrictMode, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { underCanopy, validateReplay, type Mode, type ReplayData } from '@sim';
import type { StoredRun } from '@adapters/index';
import { mockAccount } from '@adapters/mock/account';
import { mockArchive } from '@adapters/mock/records';
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
import { PrepPanel, weatherChip } from '@ui/PrepPanel';
import { RadioLog, type LogLine } from '@ui/RadioLog';
import { webAudio } from '@ui/audio';
import { createSound } from '@ui/sound';
import { SoundToggles } from '@ui/SoundToggles';
import { TargetList } from '@ui/TargetList';
import { TickCounter } from '@ui/TickCounter';
import { HeadBand, ModeSwitch, QualityPicker, type Speed } from '@ui/HeadBand';
import { LowerTabs, type Tab } from '@ui/LowerTabs';
import { Debrief } from '@ui/Debrief';
import { CallsignForm } from '@ui/CallsignForm';
import { RankingDialog } from '@ui/Ranking';
import { moveStarted, postNote, reportError, SKIPPED } from '@ui/post';
import { selectBackend } from './backend';
import type { WeatherPreset } from '@adapters/index';
import { mockWeather } from '@adapters/mock/weather';
import { newGame } from './game';
import { startLoop } from './loop';
import { submissionOf } from './records';
import { chooseSeed } from './seed';
import './app.css';

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
// 계정 and 기록 보관소 (M1: this browser's storage). Until a callsign is set the radio uses the placeholder 갈매기.
// NAMES is one object the sound holds too, so a new callsign reaches it in place.
const account = mockAccount(localStorage);
const archive = mockArchive(localStorage, (x) => validateReplay(x).ok); // the sim's 재생 자료 format check
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
  if (result || game.sim.state.phase !== 'ended') return;
  // the current game: after a weather change its sim, init and 입력 기록 are the new ones
  const submission = submissionOf(NAMES.callsign, game.sim, game.init, game.session.log);
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
  const due = game.sim.state.reportDue;
  const events = game.session.step();
  submitOnEnd();
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
// 배속 and 일시정지: how fast the loop steps, never an input (spec: not recorded). A new object on each change.
let pace: { speed: Speed; paused: boolean } = { speed: 1, paused: false };
const setPace = (p: Partial<typeof pace>) => {
  pace = { ...pace, ...p };
  listeners.forEach((l) => l());
};
let lastPublish = 0;
startLoop(
  step,
  (now) => {
    frameListeners.forEach((draw) => draw(now));
    if (now - lastPublish < PUBLISH_MS) return;
    lastPublish = now;
    listeners.forEach((l) => l());
  },
  () => (pace.paused ? 0 : pace.speed),
);

const TRAINING_WARNING = '표준 모드 작전 중에 훈련 모드를 켜면 이 판은 저장만 되고 랭킹에서 제외됩니다. 계속할까요?';
/** 모드 전환 (F-14): an input. Turning training on in a standard operation asks first, the first time (demo 1407). */
function switchMode(m: Mode): void {
  const s = game.sim.state;
  if (m === s.mode || pace.paused) return;
  if (m === 'training' && s.phase === 'live' && !s.trainingUsed && !confirm(TRAINING_WARNING)) return;
  game.session.send({ a: 'mode', v: [m] });
}

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
  const [tab, setTab] = useState<Tab>('input'); // 아래 탭 on a narrow screen
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
  const callsign = useSyncExternalStore(subscribe, () => NAMES.callsign);
  const ended = useSyncExternalStore(subscribe, () => result);
  const mode = useSyncExternalStore(subscribe, () => game.sim.state.mode);
  const { speed, paused } = useSyncExternalStore(subscribe, () => pace);
  // 표준 모드 일시정지: no free thinking time, so the view, the map and the 입력기 are hidden (demo 918).
  const covered = paused && mode === 'standard' && phase === 'live';
  const names = { callsign, gridLetters: terrain.grid.letters };
  // One set of panels; app.css lays them out (wide grid, or the upright view-on-top with 아래 탭 under 768 px).
  return (
    <>
      {ended && <Debrief state={sim.state} record={sim.record()} grid={terrain.grid} callsign={callsign} saved={ended.saved} replay={ended.replay} />}
      <div className="app" data-tab={tab}>
        <HeadBand
          tick={tick}
          score={score}
          rounds={rounds}
          mode={mode}
          speed={speed}
          paused={paused}
          phase={phase}
          onSpeed={(s) => setPace({ speed: s })}
          onPause={() => setPace({ paused: !paused })}
        >
          <ModeSwitch mode={mode} paused={paused} phase={phase} onMode={switchMode} />
          <QualityPicker quality={quality} onQuality={setQuality} />
          <SoundToggles sound={sound} />
          <div>
            {/* M1 has only the mock backend: callsigns and records stay in this browser. */}
            <CallsignForm callsign={callsign} editable={phase === 'prep'} claim={claim} /> <output aria-live="off" aria-label="연결">오프라인</output>
          </div>
          <span>
            시드 <output aria-live="off" aria-label="시드">{seedKind === 'daily' ? '일일' : '연습'} {seed}</output>
          </span>
          <span>
            기상 <output aria-live="off" aria-label="기상">{weatherChip(init.weather)}</output>
          </span>
          <RankingDialog archive={archive} callsign={callsign} />
        </HeadBand>
        <div className="sr-only">
          <TickCounter tick={tick} />
        </div>
        <div className="view">
          <ObservationView
            key={games}
            quality={quality}
            terrain={terrain}
            colours={colours}
            weather={init.weather}
            state={sim.state}
            send={send}
            onFrame={onFrame}
            showFps={showFps}
            covered={covered}
            friends={BASE_SCENARIO.friends}
          />
        </div>
        <LowerTabs tab={tab} onTab={setTab} />
        <div data-panel="input">
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
          {covered ? (
            <section aria-label="입력기">
              <p role="status">일시정지 — 표준 모드에서는 정지 중에 관측 화면·지도·교신을 쓸 수 없습니다. 생각할 시간은 작전 시간 안에서 쓰십시오.</p>
            </section>
          ) : (
            <Composer stage={stage} live={phase === 'live'} platoons={sim.state.platoons} names={names} grid={terrain.grid} mode={mode} send={send} state={sim.state} />
          )}
        </div>
        <div data-panel="map" hidden={covered}>
          <MapPanel terrain={terrain} scenario={BASE_SCENARIO} state={sim.state} send={send} onFrame={onFrame} weather={init.weather} />
        </div>
        <div data-panel="targets">
          <TargetList platoons={sim.state.platoons} mode={mode} /* re-rendered with the tick above */ />
        </div>
        <div data-panel="log">
          <RadioLog lines={lines} callsign={callsign} gridLetters={terrain.grid.letters} mode={mode} />
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
