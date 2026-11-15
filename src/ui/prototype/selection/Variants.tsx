// PROTOTYPE, not product code, ticket #130. The three layouts, as slots main hands to PrepPanel and HeadBand:
// A 줄로 쌓기 — rows in the briefing where the 시드 line is; countdown in the 머리띠.
// B 판 정보 카드 — one card on top of 작전 준비; choices open in place; countdown in the card.
// C 시나리오 먼저 · 개시 바 — scenario list on top, gun/weather chips; modes, countdown and 작전 개시 in a sticky bar.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Mode, Phase, SeedKind } from '@sim';
import { WEATHER_PRESETS, type WeatherPreset } from '@adapters/index';
import * as P from './store';

export interface ProtoProps {
  seed: number;
  seedKind: SeedKind;
  preset: WeatherPreset | null;
  onPreset: (p: WeatherPreset) => void;
  phase: Phase;
  switchMode: (m: Mode) => void;
  weather: string; // the 머리띠's short 기상
}
export interface Slots {
  top?: ReactNode;
  seed?: ReactNode; // replaces PrepPanel's 시드 line and 기상 바꾸기
  start?: (button: ReactNode) => ReactNode;
  menuModes: ReactNode; // in the 머리띠 메뉴, instead of 훈련·표준
  headExtra?: ReactNode;
  modeName: string;
}

const PRESET_NAMES: Record<WeatherPreset, string> = { clear: '맑음', haze: '박무', rain: '비', wind: '강한 북서풍', fog: '안개' };
const ALL_MODES = ['training', 'standard', 'combat'] as const;

function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return now;
}
const useP = () => useSyncExternalStore(P.subscribe, P.get);

function ModeButtons({ phase, switchMode, blurb }: { phase: Phase; switchMode: (m: Mode) => void; blurb?: boolean }) {
  const s = useP();
  return (
    <span className="p130-modes">
      <span role="group" aria-label="모드 고르기">
        {ALL_MODES.map((m) => (
          <button key={m} type="button" aria-pressed={s.mode === m} disabled={P.modeOff(m, phase)} onClick={() => P.chooseMode(m, phase, switchMode)}>
            {P.MODE_NAMES[m]}
          </button>
        ))}
      </span>
      {blurb && phase === 'prep' && <small className="p130-blurb">{P.COMBAT_BLURB}</small>}
    </span>
  );
}

function Countdown({ phase }: { phase: Phase }) {
  useP();
  const t = P.remaining(useNow());
  if (t === null || phase !== 'prep') return null;
  return (
    <output aria-label="작전 준비 남은 시간" className="p130-count" data-zero={t === 0 || undefined}>
      준비 {P.mmss(t)}
      {t === 0 && ' — 시간 끝: 관측소 후보로 작전 개시(시제품은 누르지 않음)'}
    </output>
  );
}

const seedLine = ({ seed, seedKind }: ProtoProps) =>
  seedKind === 'daily' ? `일일 ${seed} — 오늘은 모두 같은 배치·기상·편차로 경쟁` : `연습 ${seed} — 랭킹 제외`;

/** A list of scenario buttons, the current one pressed; on a daily game any of them (the current one too) opens practice. */
function ScenarioList({ seed, seedKind }: Pick<ProtoProps, 'seed' | 'seedKind'>) {
  const cur = P.scenarioOf(seedKind);
  return (
    <div role="group" aria-label="시나리오 고르기" className="p130-list">
      {P.SCENARIOS.map((x) => (
        <button key={x.id} type="button" aria-pressed={x.id === cur.id} onClick={() => P.chooseScenario(x.id, seed)}>
          <b>{x.name}</b>
          {x.fake && <i> (가짜)</i>}
          {seedKind === 'daily' && <span className="p130-hint"> → 연습</span>}
          <br />
          <small>{x.blurb}</small>
        </button>
      ))}
    </div>
  );
}
function GunList({ chips }: { chips?: boolean }) {
  const s = useP();
  return (
    <div role="group" aria-label="포 고르기" className={chips ? 'p130-chips' : 'p130-list'}>
      {P.GUNS.map((g) => (
        <button key={g.id} type="button" aria-pressed={s.gun === g.id} disabled={!!P.gunOff(g.id)} onClick={() => P.chooseGun(g.id)}>
          {g.name}
          {P.gunOff(g.id) && <small> — {P.gunOff(g.id)}</small>}
        </button>
      ))}
    </div>
  );
}
function WeatherChips({ preset, onPreset }: Pick<ProtoProps, 'preset' | 'onPreset'>) {
  return (
    <div role="group" aria-label="기상 고르기" className="p130-chips">
      {WEATHER_PRESETS.map((p) => (
        <button key={p} type="button" aria-pressed={p === preset} onClick={() => (P.noteWeather(PRESET_NAMES[p]), P.toggle(null), onPreset(p))}>
          {PRESET_NAMES[p]}
        </button>
      ))}
    </div>
  );
}
const gunName = (id: string) => P.GUNS.find((g) => g.id === id)!.name;

// ---- A: rows where the 시드 line is
function RowsA(props: ProtoProps) {
  const { seed, seedKind, preset, onPreset, phase, switchMode } = props;
  const s = useP();
  const cur = P.scenarioOf(seedKind);
  const daily = seedKind === 'daily';
  return (
    <>
      <p>
        <b>시나리오</b> {cur.name}
        {cur.fake && <i> (가짜)</i>} <small>{cur.blurb}</small>
        <br />
        <label>
          {daily ? '다른 시나리오로 연습' : '시나리오 바꾸기'}{' '}
          <select value="" onChange={(e) => P.chooseScenario(e.target.value, seed)}>
            <option value="">고르기…</option>
            {P.SCENARIOS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.fake ? ' (가짜)' : ''}
              </option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <b>포</b>{' '}
        {daily ? (
          <>
            {gunName(s.gun)} <small>(일일 판은 기본 포)</small>
          </>
        ) : (
          <select aria-label="포 바꾸기" value={s.gun} onChange={(e) => P.chooseGun(e.target.value)}>
            {P.GUNS.map((g) => (
              <option key={g.id} value={g.id} disabled={!!P.gunOff(g.id)}>
                {g.name}
                {P.gunOff(g.id) ? ` — ${P.gunOff(g.id)}` : ''}
              </option>
            ))}
          </select>
        )}
      </p>
      <p>
        <b>모드</b> <ModeButtons phase={phase} switchMode={switchMode} blurb />
      </p>
      <p>
        <b>시드</b> {seedLine(props)}
      </p>
      {!daily && preset && (
        <p>
          <label>
            기상 바꾸기{' '}
            <select value={preset} onChange={(e) => (P.noteWeather(PRESET_NAMES[e.target.value as WeatherPreset]), onPreset(e.target.value as WeatherPreset))}>
              {WEATHER_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PRESET_NAMES[p]}
                </option>
              ))}
            </select>
          </label>
        </p>
      )}
    </>
  );
}

// ---- B: one card on top
function CardB(props: ProtoProps) {
  const { seed, seedKind, preset, onPreset, phase, switchMode, weather } = props;
  const s = useP();
  const cur = P.scenarioOf(seedKind);
  const daily = seedKind === 'daily';
  const prep = phase === 'prep';
  const lock = <span className="p130-lock">일일 · 읽기만</span>;
  const change = (k: 'scenario' | 'gun' | 'weather', label = '바꾸기') =>
    prep && (
      <button type="button" aria-expanded={s.open === k} onClick={() => P.toggle(k)}>
        {label} {s.open === k ? '▴' : '▾'}
      </button>
    );
  return (
    <section aria-label="판 정보" className="p130-card">
      <div className="p130-row">
        <b>판 정보</b> <span>{daily ? `일일 ${seed} · 랭킹` : `연습 ${seed} · 랭킹 제외`}</span> <Countdown phase={phase} />
      </div>
      <div className="p130-row">
        <b>시나리오</b>
        <span>
          {cur.name}
          {cur.fake && <i> (가짜)</i>}
        </span>
        {change('scenario', daily ? '다른 시나리오 · 연습' : '바꾸기')}
      </div>
      {s.open === 'scenario' && <ScenarioList seed={seed} seedKind={seedKind} />}
      <div className="p130-row">
        <b>포</b> <span>{gunName(s.gun)}</span> {daily ? lock : change('gun')}
      </div>
      {s.open === 'gun' && <GunList />}
      <div className="p130-row">
        <b>모드</b> <ModeButtons phase={phase} switchMode={switchMode} />
      </div>
      {prep && <small className="p130-blurb">{P.COMBAT_BLURB}</small>}
      <div className="p130-row">
        <b>기상</b> <span>{preset ? PRESET_NAMES[preset] : weather}</span> {daily ? lock : change('weather')}
      </div>
      {s.open === 'weather' && <WeatherChips preset={preset} onPreset={onPreset} />}
      {!prep && <small>작전 개시 뒤에는 시나리오·포·기상을 바꿀 수 없다.</small>}
    </section>
  );
}

// ---- C: scenario list first, chips, and a sticky bar
function TopC(props: ProtoProps) {
  const { seed, seedKind, preset, onPreset, phase } = props;
  const s = useP();
  const daily = seedKind === 'daily';
  if (phase !== 'prep') return null;
  return (
    <section aria-label="시나리오와 포" className="p130-c">
      <ScenarioList seed={seed} seedKind={seedKind} />
      {daily && <small className="p130-hint">일일 판: 시나리오를 누르면 그 연습 판이 열린다. 포·기상은 연습에서만.</small>}
      <div className="p130-row">
        <b>포</b>
        {daily ? (
          <>
            <span>{gunName(s.gun)}</span> <span className="p130-lock">기본 포 · 일일</span>
          </>
        ) : (
          <GunList chips />
        )}
      </div>
      {!daily && (
        <div className="p130-row">
          <b>기상</b> <WeatherChips preset={preset} onPreset={onPreset} />
        </div>
      )}
      <small>{seedLine(props)}</small>
    </section>
  );
}

export function protoSlots(props: ProtoProps): Slots {
  const { phase, switchMode } = props;
  const s = P.get();
  const menuModes = <ModeButtons phase={phase} switchMode={switchMode} />;
  const modeName = P.MODE_NAMES[s.mode];
  if (P.PROTO === 'A') return { seed: <RowsA {...props} />, menuModes, headExtra: <Countdown phase={phase} />, modeName };
  if (P.PROTO === 'B') return { top: <CardB {...props} />, seed: null, menuModes, modeName };
  return {
    top: <TopC {...props} />,
    seed: null,
    menuModes,
    modeName,
    start: (button) => (
      <div className="p130-bar">
        <ModeButtons phase={phase} switchMode={switchMode} blurb />
        <Countdown phase={phase} />
        {button}
      </div>
    ),
  };
}

export const PROTO_CSS = `
.p130-card{border:1px solid var(--amber);padding:6px 8px;margin:0 0 8px;display:grid;gap:4px}
.p130-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.p130-row>b{min-width:4.5em}
.p130-lock{font-size:11px;color:var(--dim);border:1px dashed var(--dim);padding:0 4px}
.p130-blurb{display:block;color:var(--dim);font-size:11px;line-height:1.35}
.p130-list{display:grid;gap:3px}
.p130-list button{text-align:left;width:100%}
.p130-chips{display:flex;flex-wrap:wrap;gap:4px}
.p130-hint{color:var(--amber);font-size:11px}
.p130-count{color:var(--amber);font-weight:bold}
.p130-count[data-zero]{color:#f66}
.p130-modes{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}
.p130-c{display:grid;gap:6px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.p130-bar{position:sticky;bottom:0;z-index:1;background:var(--panel);border-top:1px solid var(--amber);padding:6px;margin:6px -6px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
`;
