import type { Activity, CorrectionSlots, DescriptionSlots, Effect, Fuze, LocationSlots, MtoSlots, Next, RadioEvent, ShiftSlots, Unit, Warning } from './radio';
import type { Scheduled } from './queue';
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
  x: number; // where it stands now, from the unit's centre, heading and formation
  y: number;
  prone: boolean;
  alive: boolean; // a dead member lies still, is never seen and never comes back
  /** 보임: decided by the simulation every 6 ticks (가시선 · 각크기 · 시정). The renderer draws only these. */
  vis: boolean;
}

/** wait: before its start time · approach/assault: infantry on the move · hold: the recon at its post ·
 * support: APCs halted and firing · emplaced: the mortar section · broken: 무력화 (30% casualties): it stops, then
 * falls back · destroyed: 파괴 (60%): it stays where it is and does nothing more. */
export type PlatoonState = 'wait' | 'approach' | 'assault' | 'hold' | 'support' | 'emplaced' | 'broken' | 'destroyed';

/** 실제 배치 of one unit, decided by the seed when the simulation is created, and how it moves since. */
export interface Platoon {
  type: UnitType;
  route: RouteKey | null;
  path: Point[]; // the route as this unit walks it; empty for the mortar
  x: number; // centre of the unit
  y: number;
  members: Member[];
  state: PlatoonState;
  t0: number; // tick it sets off
  wp: number; // index in `path` it is heading for
  dir: number; // heading, radians east of north
  form: number; // 0 approach column … 1 line
  moving: boolean;
  assaultTick: number; // tick the assault began, −1 before
  nextFire: number; // tick of the next shot (APC, mortar)
  lastFire: number; // tick of the last shot, −1 never
  dustTick: number; // tick of the last dust cloud
  pinnedUntil: number; // 피격 반응: down and still (the APCs excepted) while the tick is below this
  activity: Activity; // what it is doing now, as the observer would report it
  intel: Intel;
}

/** What the click that found a unit landed on: a man (tubes count as men), a vehicle, its dust or its fire. */
export type Cue = 'man' | 'veh' | 'dust' | 'muzzle';

/** 적정: what the observer has learnt about one unit. stage 0 unknown · 1 탐지 · 2 병종·활동 · 3 규모. */
export interface Intel {
  stage: 0 | 1 | 2 | 3;
  tnum: number; // 표적 번호, from 1 in the order found; 0 before
  cue: Cue | null;
  prog: number; // time watched through the binoculars, in half-ticks (signals alone count half)
  seenMax: number; // most men (or vehicles) seen at once; tubes apart
  tubes: number;
  firstTick: number; // −1 before it is found
  seenTick: number; // last seen
  seenAz: number; // mils from the observation post to the unit's centre when last seen
  size: { unit: Unit; n: number } | null; // 규모, known from stage 3
}

/** 먼지 (a moving vehicle) or 사격 섬광·연기 (APC: `small`, mortar), seen like members. */
export interface FieldEffect {
  kind: 'dust' | 'muzzle' | 'burst'; // burst: our own round's 탄착 (pid −1)
  x: number;
  y: number;
  gz: number; // height it starts from, m
  tick: number; // made at
  life: number; // ticks it lasts
  pid: number; // index of the platoon that made it
  small: boolean;
  vt: boolean; // a 접근신관 burst, 7 m above the ground
  vis: boolean;
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
  v?: readonly (number | string)[]; // integers, and enum identifiers as their ASCII strings
}

/** 탄착: where a round landed. */
export interface ImpactEvent {
  type: 'impact';
  tick: number; // the simulation's tick when the step that saw it land ends
  x: number;
  y: number;
  fuze: Fuze; // vt: 공중 파열
}

/** 사건. */
export type SimEvent = RadioEvent | ImpactEvent;

export interface StepResult {
  events: readonly SimEvent[];
  accepted: readonly boolean[]; // one per input, same order
}

/** 교신 단계: off until 감명 양호 has gone out · idle takes a call · wait for 기러기 · loc · desc take those
 * transmissions · ready once 사격준비 끝 has come (지명사: takes 준비 쏴) · flight while rounds fly · adjust takes a
 * correction · effect once the last round of the 효력사 has landed (효과 관측). */
export type RadioStage = 'off' | 'idle' | 'wait' | 'loc' | 'desc' | 'ready' | 'flight' | 'adjust' | 'effect';

/** A round in the air: where and at which tick it lands, and its fuze. */
export interface Flight {
  x: number;
  y: number;
  at: number;
  fuze: Fuze;
}

/** 사격 임무: what the observer sent and what 기러기 decided, filled in as the procedure goes. */
export interface Mission {
  warning: Warning;
  location: LocationSlots | null;
  description: DescriptionSlots | null;
  mto: MtoSlots | null;
  phase: Next; // what the battery fires next: the adjusting round, or 효력사 (called so, or a correction ending 효력사)
  bias: Point; // 비표준 조건 오차, m: drawn when the call is accepted
  aim: Point | null; // 조준점: the sent grid, then moved by each correction
  direction: number | null; // 방향 the observer sent with the first correction, mils: the corrections' 기준선
  correction: CorrectionSlots | null; // the last correction as sent (snapped), for 기러기's readback
  flights: Flight[]; // rounds in the air, by landing tick (ties in firing order)
  impacts: { x: number; y: number; tick: number }[];
  kills: (number | null)[]; // members this mission's rounds killed, by unit; null: none of them landed within 220 m
  // 임무 요약 (사후강평, 기록)
  target: number; // the unit nearest the sent grid (within 600 m) when it was sent; −1 none
  firstError: number | null; // 초탄 오차, m: the first adjusting round that had a unit to measure from (demo); null for 바로 효력사
  directionError: number | null; // 방향 오차, mils: the sent 방향 from the target's true azimuth; null without either
  rangeCorrections: number[]; // 수정열: each correction's 사거리 (snapped, m) when it had one, in order
  corrections: number; // corrections accepted
  report: Effect | null; // the last 전과 보고 sent (재효력사 · 임무끝 · 수정 후 효력사)
  truth: Effect | null; // the reported unit's real effect at that report; null when there was no unit to judge
  truthPct: number; // its casualties then, %; −1 when no unit
  score: number; // this mission's 전과 보고 points (also in the game's score)
  dangerClose: boolean; // 위험근접 rules apply: declared, or applied by 기러기
  dangerMissed: boolean; // near and not declared (−30)
  shift: ShiftSlots | null; // the 전이 as sent (snapped); null for a mission opened by a call
}

/** One 레이저 press: the angles it went out on and what came back. */
export interface Lase {
  tick: number;
  az: number; // as sent, 0.1 mil
  el: number;
  /** null: 반사 없음. dist: 수평거리 m (with the laser's error), vm: 고저각 mil, x/y: the point measured, target: 표적 반사. */
  range: { dist: number; vm: number; x: number; y: number; target: boolean } | null;
}

export interface SimState {
  /** Stays 0 through 작전 준비: the tick advances only once the operation has started. */
  tick: number;
  phase: Phase;
  /** 관측소: in prep the candidate (the planned one until a pick), once started the occupied one. */
  op: Point;
  /** 기러기가 아는 관측소 위치: the planned post until a 위치 보고 (M1-12). Polar 표적위치 are taken from here. */
  knownOp: Point;
  picked: boolean;
  /** 위치 보고 required: the operation started away from the planned observation post. */
  reportDue: boolean;
  platoons: Platoon[];
  effects: FieldEffect[]; // oldest first
  targets: number; // units found so far: the last 표적 번호 given
  mode: Mode;
  score: number;
  /** 조준 last accepted: azimuth 0–63999 and elevation −2000–2000, in 0.1 mils. */
  aim: { az: number; el: number };
  bino: boolean;
  lases: Lase[]; // newest first, at most 5
  radio: { stage: RadioStage; lastTn: number }; // lastTn: the last 표적번호 기러기 gave (starts 1000, so AB1001)
  missions: Mission[]; // one per accepted call; the last is the current one
  queue: Scheduled[]; // 예약 이벤트, by tick
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
