// 다섯 이음매(지형 원천·기상 원천·계정·기록 보관소·음성 출력)의 인터페이스와 mock 구현 자리. 각 슬라이스가 더한다.
import type { Effect, GameRecord, Mode, ReplayData, Speaker, TerrainData } from '@sim';

/** 지형 원천: one 지형 자료 per seed, finished. */
export interface TerrainSource {
  load(seed: number): Promise<TerrainData>;
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

/** 판 기록 with the game's 모드. #38 adds `mode` to GameRecord (training once used); then this is GameRecord. */
export interface RunRecord extends GameRecord {
  mode: Mode;
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
  record: RunRecord;
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
