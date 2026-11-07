// 작전 준비 (F-22, demo lines 922–936): the briefing, the seed and weather, the 관측소 후보 and 작전 개시.
// After the start, one line on the occupied post until the 위치 보고 slice brings its form.
import type { GridRef, Input, Point, ReadonlySimState, Scenario, SeedKind, Weather } from '@sim';
import { BRIEFING } from '@content/scenario';
import { gridOf } from '@render/mapView';
import { startInput } from './prep';
import { gridLabel } from './radio/readings';

export type PrepState = Pick<ReadonlySimState, 'phase' | 'op' | 'picked' | 'reportDue'>;

export interface PrepPanelProps {
  state: PrepState;
  scenario: Scenario;
  grid: GridRef;
  seed: number;
  seedKind: SeedKind;
  weather: Weather;
  send: (input: Input) => void;
  /** Inputs sent and not yet stepped. */
  queued: readonly Input[];
  /** The simulation's live state, read when 작전 개시 is pressed. */
  live: Pick<ReadonlySimState, 'op'>;
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

export function PrepPanel({ state, scenario, grid, seed, seedKind, weather, send, queued, live }: PrepPanelProps) {
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
        <b>적정(첩보)</b> {BRIEFING.enemy}
      </p>
      <p>
        <b>첩보 지점</b> (지도 주황 원)
      </p>
      <ul>
        {scenario.nais.map((a, i) => (
          <li key={i}>
            NAI {i + 1} {BRIEFING.nais[i]} (신뢰도 {BRIEFING.conf[a.conf]})
          </li>
        ))}
      </ul>
      <p>
        <b>예상 접근로</b> (지도 붉은 점선){' '}
        {scenario.intelRoutes.map((r) => `${BRIEFING.routes[r.route]}(가능성 ${BRIEFING.conf[r.conf]})`).join(', ')}
      </p>
      <p>
        <b>임무</b> {BRIEFING.mission}
      </p>
      <p>
        <b>기상</b> {weatherText(weather)}
      </p>
      <p>
        <b>시드</b>{' '}
        {seedKind === 'daily' ? `일일 ${seed} — 오늘은 모두 같은 배치·기상·편차로 경쟁` : `연습 ${seed} — 랭킹 제외`}
      </p>
      <p>
        <b>주의</b> {BRIEFING.caution} 계획된 관측소 1번 고지 {at(scenario.plannedOp)}.
      </p>
      <p>
        {state.picked
          ? `관측소 후보: ${at(state.op)}`
          : '지도를 눌러 관측소 후보를 고르십시오. 고르지 않으면 계획된 1번 고지를 점령합니다.'}
      </p>
      <button type="button" onClick={() => pressStart({ state, live, queued, send })}>
        관측소 점령 · 작전 개시
      </button>
    </section>
  );
}
