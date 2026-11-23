// 여섯 이음매(지형 원천·기상 원천·계정·기록 보관소·음성 출력·음성 입력)의 인터페이스와 mock 구현 자리. 각 슬라이스가 더한다.
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

/** Why 음성 입력 cannot be used: this browser cannot run it, no microphone permission, or the 음성 모델 did not come. */
export const VOICE_INPUT_FAILURES = ['unsupported', 'denied', 'model'] as const;
export type VoiceInputFailure = (typeof VOICE_INPUT_FAILURES)[number];

/** The only rejection of `VoiceInput.open`. */
export class VoiceInputError extends Error {
  constructor(
    readonly reason: VoiceInputFailure,
    options?: ErrorOptions,
  ) {
    super(`음성 입력: ${reason}`, options);
    this.name = 'VoiceInputError';
  }
}

/** 음성 입력: hears what is said while the player holds 눌러서 말하기 and gives it as text. Knows words, not 교신 문법 (ADR 0023). */
export interface VoiceInput {
  /** Asks for the microphone and gets the 인식기 ready. Rejects with a `VoiceInputError`; may be called again. */
  open(): Promise<void>;
  /** Starts hearing. `words` (들을 낱말): the only words that may be heard. */
  listen(words: readonly string[]): Listening;
  /** Lets the microphone and the 인식기 go; an `open` still under way is given up. */
  close(): void;
}
export interface Listening {
  /** The player stopped talking: the 들린 글, likeliest first; empty when nothing was heard. */
  stop(): Promise<string[]>;
  cancel(): void;
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
/** The modes a ranked run ends in: a 보드 is one of these, a scenario id and a Board (ADR 0021). */
export type RankedMode = Extract<GameRecord['mode'], 'standard' | 'combat'>;

export interface RankRow {
  callsign: string;
  fake: boolean; // a mock row, not a player's
  createdAt: string;
  record: Pick<GameRecord, 'score' | 'cleared' | 'clearTick' | 'roundsTotal' | 'firstErrorAvg' | 'reportAccuracyPct' | 'missions'>;
}

/** 기록 보관소: keeps ended games and ranks them by board. */
export interface RecordArchive {
  submit(s: Submission): Promise<StoredRun>;
  /** One board's ranked runs and the fake rows: the best one per callsign, best first, at most 20. The scenario is the
   * 재생 자료 header's id, the mode the 판 기록's; versions are not looked at. */
  board(mode: RankedMode, scenario: string, b: Board): Promise<RankRow[]>;
  /** This browser's runs, newest first. */
  mine(): Promise<StoredRun[]>;
}
