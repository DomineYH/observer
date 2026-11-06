import type { StreamName } from './rng';
import type { TerrainData } from './terrain';

export type SeedKind = 'daily' | 'practice';
export type Mode = 'training' | 'standard';

export interface Ref {
  id: string;
  version: number;
}
export type Scenario = Ref;
export type GunData = Ref;

/** 기상 값, all integers in spec units. */
export interface Weather {
  visibilityM: number;
  cloudPct: number;
  windFromDeg: number; // direction the wind blows from, 0–359
  windSpeedTenthMs: number;
  tempTenthC: number;
  precipTenthMmH: number;
  pressureHpa: number;
  humidityPct: number;
}

/** 생성 인자: complete values only. */
export interface SimInit {
  seed: number;
  seedKind: SeedKind;
  scenario: Scenario;
  guns: GunData;
  weather: Weather;
  mode: Mode;
  terrain: TerrainData;
}

/** 입력. Kinds are added by the slices that use them; until then every kind is unknown. */
export interface Input {
  a: string;
  v?: readonly number[];
}

/** 사건. None yet. */
export type SimEvent = never;

export interface StepResult {
  events: readonly SimEvent[];
  accepted: readonly boolean[]; // one per input, same order
}

export interface SimState {
  tick: number;
  mode: Mode;
  score: number;
  rng: Record<StreamName, { a: number; count: number }>;
}

type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };
export type ReadonlySimState = DeepReadonly<SimState>;

/** 판 기록 (no creation time; the record store stamps it). */
export interface GameRecord {
  ticks: number;
  score: number;
}

export interface Sim {
  /** Advance exactly one tick (50 ms) with this tick's inputs. The only way inputs enter. */
  step(inputs: readonly Input[]): StepResult;
  readonly state: ReadonlySimState;
  record(): GameRecord;
  /** 상태 해시: 16 lowercase hex digits. */
  hash(): string;
}

/** One 입력 기록 entry: applied in the step that starts at tick `t` (0-based). */
export interface RecordedInput extends Input {
  t: number;
}

/** 재생 자료, format 1. Terrain and grammar versions are not carried. */
export interface ReplayData extends Omit<SimInit, 'terrain'> {
  format: 1;
  simVersion: number;
  stepMs: 50;
  inputs: RecordedInput[];
  totalTicks: number;
}

export interface ReplayResult {
  record: GameRecord;
  ignored: number;
  /** Every tick's state hash folded into one. */
  chain: string;
  /** State hash every 200 ticks. */
  checkpoints: { tick: number; hash: string }[];
}
