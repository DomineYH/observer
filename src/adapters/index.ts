// 다섯 이음매(지형 원천·기상 원천·계정·기록 보관소·음성 출력)의 인터페이스와 mock 구현 자리. 각 슬라이스가 더한다.
import type { Effect, GameRecord, ReplayData, SeedKind, Speaker, TerrainData, Weather } from '@sim';

/** 지형 원천: one 지형 자료 per seed, finished. */
export interface TerrainSource {
  load(seed: number): Promise<TerrainData>;
}

/** Why a 지형 원천 refused: not received, not this game's data, or no gzip unpacking in this browser. */
export const TERRAIN_FAILURES = ['fetch', 'mismatch', 'unsupported'] as const;
export type TerrainFailure = (typeof TERRAIN_FAILURES)[number];

/** The only rejection of the real 지형 원천: it never resolves to other data. */
export class TerrainLoadError extends Error {
  constructor(
    readonly reason: TerrainFailure,
    options?: ErrorOptions,
  ) {
    super(`지형 원천: ${reason}`, options);
    this.name = 'TerrainLoadError';
  }
}

export const WEATHER_PRESETS = ['clear', 'haze', 'rain', 'wind', 'fog'] as const;
export type WeatherPreset = (typeof WEATHER_PRESETS)[number];

/** 기상 원천: the weather of one game, finished. The preset is used for practice seeds only. */
export interface WeatherSource {
  load(seed: number, seedKind: SeedKind, preset?: WeatherPreset): Promise<Weather>;
}

/** 음성 출력: reads a sentence aloud, or stops. Never waits for the result. */
export interface VoiceOutput {
  speak(speaker: Speaker, text: string): void;
  stop(): void;
}

/** Why 계정 refuses a callsign. */
export type CallsignRejection = 'format' | 'reserved' | 'taken';

/** 계정: this browser's anonymous user and callsign. Async, so a real service plugs in without changing callers. */
export interface Account {
  /** The callsign set in this browser; null until one is. */
  callsign(): Promise<string | null>;
  claim(callsign: string): Promise<{ ok: true; callsign: string } | { ok: false; reason: CallsignRejection }>;
}

/** 임무 요약 (PRD 10.2): one per mission that fired. */
export interface MissionSummary {
  targetNumber: number | null;
  corrections: number;
  rounds: number;
  firstError: number | null;
  directionError: number | null;
  rangeCorrections: number[];
  report: Effect | null;
}

/** What 기록 보관소 receives for an ended game. */
export interface Submission {
  callsign: string;
  record: GameRecord;
  missions: MissionSummary[];
  replay: ReplayData;
}

/** A submission as kept: the archive stamps the time and decides whether it is ranked. */
export interface StoredRun extends Submission {
  createdAt: string;
  ranked: boolean;
}

export type Board = 'total' | 'time' | 'rounds' | 'accuracy';

export interface RankRow {
  callsign: string;
  fake: boolean; // a mock row, not a player's
  createdAt: string;
  record: Pick<GameRecord, 'score' | 'cleared' | 'clearTick' | 'roundsTotal' | 'firstErrorAvg' | 'reportAccuracyPct' | 'missions'>;
}

/** 기록 보관소: keeps ended games and ranks them by board. */
export interface RecordArchive {
  submit(s: Submission): Promise<StoredRun>;
  /** Ranked runs and the fake rows: the best one per callsign, best first, at most 20. */
  board(b: Board): Promise<RankRow[]>;
  /** This browser's runs, newest first. */
  mine(): Promise<StoredRun[]>;
}
