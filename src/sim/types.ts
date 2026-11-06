import type { RadioEvent } from './radio';
import type { StreamName } from './rng';
import type { Point, TerrainData } from './terrain';

export type SeedKind = 'daily' | 'practice';
export type Mode = 'training' | 'standard';

export interface Ref {
  id: string;
  version: number;
}
export type GunData = Ref;

export type RouteKey = 'A' | 'B' | 'C';
export type Confidence = 'high' | 'medium' | 'low';
export type UnitType = 'recon' | 'inf' | 'apc' | 'mortar';
/** A fixed route, or `first` when the scenario stream draws below `p`, else `second`. */
export type RoutePick = RouteKey | { first: RouteKey; second: RouteKey; p: number };
export type UnitDef =
  | { type: Exclude<UnitType, 'mortar'>; route: RoutePick; t0: number } // t0: seconds after start it sets off
  | { type: 'mortar'; nai: number; spread: Point; t0: number }; // somewhere in the box `spread` wide around NAI `nai`

/** 시나리오: the briefing's map data and the enemy order of battle. Texts live with the ui, not here. */
export interface Scenario extends Ref {
  plannedOp: Point; // 계획된 관측소
  battery: Point; // 포대, off the map
  frontY: number; // 아군 전선 (이동 한계선), north meters
  friends: readonly Point[]; // 아군 진지
  routes: { readonly [K in RouteKey]: readonly Point[] }; // 접근로, start to objective
  nais: readonly { x: number; y: number; r: number; conf: Confidence }[]; // 주요 감시 지역
  intelRoutes: readonly { route: RouteKey; conf: Confidence }[]; // 예상 접근로
  units: readonly UnitDef[];
}

/** One soldier, vehicle or tube: `u,v` line formation and `uc,vc` approach column offsets (m), `ph` animation phase. */
export interface Member {
  kind: 'man' | 'veh' | 'tube';
  u: number;
  v: number;
  uc: number;
  vc: number;
  ph: number;
}

/** 실제 배치 of one unit, decided by the seed when the simulation is created. */
export interface Platoon {
  type: UnitType;
  route: RouteKey | null;
  path: Point[]; // the route as this unit walks it; empty for the mortar
  x: number;
  y: number;
  members: Member[];
}

export type Phase = 'prep' | 'live';

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

/** 입력. The kinds and their values are listed in inputs.ts; anything else is ignored. */
export interface Input {
  a: string;
  v?: readonly number[];
}

/** 사건. Nothing emits radio events until the radio state machine slice. */
export type SimEvent = RadioEvent;

export interface StepResult {
  events: readonly SimEvent[];
  accepted: readonly boolean[]; // one per input, same order
}

export interface SimState {
  /** Stays 0 through 작전 준비: the tick advances only once the operation has started. */
  tick: number;
  phase: Phase;
  /** 관측소: in prep the candidate (the planned one until a pick), once started the occupied one. */
  op: Point;
  picked: boolean;
  /** 위치 보고 required: the operation started away from the planned observation post. */
  reportDue: boolean;
  platoons: Platoon[];
  mode: Mode;
  score: number;
  /** 조준 last accepted: azimuth 0–63999 and elevation −2000–2000, in 0.1 mils. */
  aim: { az: number; el: number };
  bino: boolean;
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
export interface ReplayData extends Omit<SimInit, 'terrain' | 'scenario'> {
  scenario: Ref;
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
