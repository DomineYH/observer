// 작전 준비 (F-22, demo lines 922–936): the briefing, the seed and weather, the 관측소 후보 and 작전 개시.
// After the start, one line on the occupied post until the 위치 보고 slice brings its form.
// The 지형 자료's 자료 출처 lines close the prep screen; the mock land has none, so its screen is unchanged.
import type { Input, Point, ReadonlySimState, Scenario, SeedKind, TerrainData, Weather } from '@sim';
import { WEATHER_PRESETS, type WeatherPreset } from '@adapters/index';
import type { Briefing } from '@content/placement';
import { gridOf, underCanopy } from '@render/mapView';
import { startInput } from './prep';
import { gridLabel } from './radio/readings';

export type PrepState = Pick<ReadonlySimState, 'phase' | 'op' | 'picked' | 'reportDue'>;

export interface PrepPanelProps {
  state: PrepState;
  scenario: Scenario;
  briefing: Briefing; // the chosen 배치's 작전 준비 글
  terrain: TerrainData; // its 방안 기준 labels grids; its forest marks a candidate under the canopy
  seed: number;
  seedKind: SeedKind;
  weather: Weather;
  send: (input: Input) => void;
  /** Inputs sent and not yet stepped. */
  queued: readonly Input[];
  /** The simulation's live state, read when 작전 개시 is pressed. */
  live: Pick<ReadonlySimState, 'op'>;
  /** The practice seed's preset in use (null for a daily seed), and choosing another one (F-30). */
  preset: WeatherPreset | null;
  onPreset: (p: WeatherPreset) => void;
}

const PRESET_NAMES: Record<WeatherPreset, string> = { clear: '맑음', haze: '박무', rain: '비', wind: '강한 북서풍', fog: '안개' };

/** The 머리띠 메뉴's short 기상 (demo 349): visibility and wind. */
export function weatherChip(w: Weather): string {
  return `시정 ${(w.visibilityM / 1000).toFixed(1)}km·바람 ${w.windFromDeg}° ${(w.windSpeedTenthMs / 10).toFixed(1)}m/s`;
}

function weatherText(w: Weather): string {
  const parts = [
    `시정 ${(w.visibilityM / 1000).toFixed(1)} km`,
    `구름 ${w.cloudPct}%`,
    `바람 ${w.windFromDeg}° ${(w.windSpeedTenthMs / 10).toFixed(1)} m/s`,
    `${(w.tempTenthC / 10).toFixed(1)}°C`,
    `습도 ${w.humidityPct}%`,
    `${w.pressureHpa} hPa`,
  ];
  if (w.precipTenthMmH > 0) parts.push(`강수 ${(w.precipTenthMmH / 10).toFixed(1)} mm/h`);
  return parts.join(' · ');
}

/** The 작전 개시 button's press: the post comes from the live state (and a queued pick), never the rendered `state`. */
export function pressStart({ live, queued, send }: Pick<PrepPanelProps, 'state' | 'live' | 'queued' | 'send'>): void {
  send(startInput(live, queued));
}

export function PrepPanel({ state, scenario, briefing, terrain, seed, seedKind, weather, send, queued, live, preset, onPreset }: PrepPanelProps) {
  const grid = terrain.grid;
  const at = (p: Point) => gridLabel(grid.letters, gridOf(grid, p));
  if (state.phase === 'live')
    return (
      <section aria-label="작전 준비">
        <p>
          작전 개시 — {at(state.op)} 점령.{state.reportDue && ' 계획과 다른 위치이므로 기러기에게 위치를 보고하십시오.'}
        </p>
      </section>
    );
  return (
    <section aria-label="작전 준비">
      <h2>작전 준비 — 관측소 선정</h2>
      <p>
        <b>적정(첩보)</b> {briefing.enemy}
      </p>
      <p>
        <b>첩보 지점</b> (지도 주황 원)
      </p>
      <ul>
        {scenario.nais.map((a, i) => (
          <li key={i}>
            NAI {i + 1} {briefing.nais[i]} (신뢰도 {briefing.conf[a.conf]})
          </li>
        ))}
      </ul>
      <p>
        <b>예상 접근로</b> (지도 붉은 점선){' '}
        {scenario.intelRoutes.map((r) => `${briefing.routes[r.route]}(가능성 ${briefing.conf[r.conf]})`).join(', ')}
      </p>
      <p>
        <b>임무</b> {briefing.mission}
      </p>
      <p>
        <b>기상</b> {weatherText(weather)}
      </p>
      <p>
        <b>시드</b>{' '}
        {seedKind === 'daily' ? `일일 ${seed} — 오늘은 모두 같은 배치·기상·편차로 경쟁` : `연습 ${seed} — 랭킹 제외`}
      </p>
      {seedKind === 'practice' && preset && (
        <p>
          <label>
            기상 바꾸기{' '}
            <select value={preset} onChange={(e) => onPreset(e.target.value as WeatherPreset)}>
              {WEATHER_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PRESET_NAMES[p]}
                </option>
              ))}
            </select>
          </label>
        </p>
      )}
      <p>
        <b>주의</b> {briefing.caution} 계획된 관측소 {briefing.plannedOp} {at(scenario.plannedOp)}.
        {scenario.reserveOps?.length ? ` 예비 관측소 ${scenario.reserveOps.map((p, i) => `예비 ${i + 1} ${at(p)}`).join(', ')}.` : ''}
      </p>
      <p>
        {state.picked
          ? `관측소 후보: ${at(state.op)}${underCanopy(terrain, state.op.x, state.op.y) ? ' · 숲 속 — 시야 가림' : ''}`
          : // ponytail: the particle is fixed as 를; both M2 배치 name the post "1번 고지". Pick by 받침 when a name ends in a consonant.
            `지도를 눌러 관측소 후보를 고르십시오. 고르지 않으면 계획된 ${briefing.plannedOp}를 점령합니다.`}
      </p>
      <button type="button" onClick={() => pressStart({ state, live, queued, send })}>
        관측소 점령 · 작전 개시
      </button>
      {terrain.credits.map((c) => (
        <p key={c}>
          <small>{c}</small>
        </p>
      ))}
    </section>
  );
}
