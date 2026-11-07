// 재생 자료 and the 기록 보관소 submission, built by the assembly point from what the session took (ADR 0003).
import { SIM_VERSION, type ReadonlySimState, type RecordedInput, type ReplayData, type Sim, type SimInit } from '@sim';
import type { MissionSummary, Submission } from '@adapters/index';

/** 재생 자료 of a game: its 생성 인자 (scenario by identity, no terrain) and its 입력 기록 up to `totalTicks`. */
export function replayOf(init: Omit<SimInit, 'terrain'>, log: readonly RecordedInput[], totalTicks: number): ReplayData {
  const { seed, seedKind, scenario, guns, weather, mode } = init;
  return {
    format: 1,
    simVersion: SIM_VERSION,
    seed,
    seedKind,
    scenario: { id: scenario.id, version: scenario.version },
    guns,
    weather,
    mode,
    stepMs: 50,
    inputs: [...log],
    totalTicks,
  };
}

/** 임무 요약: one entry per mission that fired. */
export const missionsOf = (missions: ReadonlySimState['missions']): MissionSummary[] =>
  missions
    .filter((m) => m.impacts.length + m.flights.length > 0)
    .map((m) => ({
      targetNumber: m.mto?.targetNumber ?? null,
      corrections: m.corrections,
      rounds: m.impacts.length + m.flights.length,
      firstError: m.firstError,
      directionError: m.directionError,
      rangeCorrections: [...m.rangeCorrections],
      report: m.report,
    }));

/** What goes to 기록 보관소 once a game ends. The 모드 is the game's own until #38 puts it in the 판 기록 (there is no
 * `mode` input before then). */
export function submissionOf(callsign: string, sim: Sim, init: Omit<SimInit, 'terrain'>, log: readonly RecordedInput[]): Submission {
  return {
    callsign,
    record: { ...sim.record(), mode: init.mode },
    missions: missionsOf(sim.state.missions),
    replay: replayOf(init, log, sim.state.tick),
  };
}
