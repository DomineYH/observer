import type { Activity, CorrectionSlots, DescriptionSlots, Effect, Fuze, LocationSlots, MtoSlots, Next, RadioEvent, ShiftSlots, Unit, Warning } from './radio';
import type { Scheduled } from './queue';
import type { StreamName } from './rng';
import type { Point, TerrainData } from './terrain';

export type SeedKind = 'daily' | 'practice';
export const MODES = ['training', 'standard'] as const;
export type Mode = (typeof MODES)[number];

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
  fixedPoint: Point; // 고정점: the 기온 잔차 lies along the battery → here line
  frontY: number; // 아군 전선 (이동 한계선), north meters
  friends: readonly Point[]; // 아군 진지
  supplyRoad: number; // index into the terrain's roads the 보급 트럭 drives; no truck when the terrain has no such road
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
 * falls back · destroyed: 파괴 (60%): it stays where it is and does nothing more · overran: 진지 돌파 (infantry within
 * 80 m of its objective with under 30% casualties): it stays there, is never judged again, and the game is no 섬멸. */
export type PlatoonState = 'wait' | 'approach' | 'assault' | 'hold' | 'support' | 'emplaced' | 'broken' | 'destroyed' | 'overran';

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
  kind: 'dust' | 'muzzle' | 'burst'; // burst: a 탄착, ours or the enemy mortar's at the post (pid −1: no unit's cue)
  x: number;
  y: number;
  gz: number; // height it starts from, m
  tick: number; // made at
  life: number; // ticks it lasts
  pid: number; // index of the platoon that made it
  small: boolean;
  vt: boolean; // a 접근신관 burst, 7 m above the ground
  tiny: boolean; // 아군 소화기 섬광: a muzzle flash only, no smoke (pid −1); seen as a small muzzle
  vis: boolean;
}

/** ended (종료): every combat unit down (8 s after nothing is owed or in the air), the 40분 한도, or 관측반 손실: the clock
 * stops and every input is ignored. */
export type Phase = 'prep' | 'live' | 'ended';

/** 관측소 상태: ready (equipment set up), moving (도보 이동: 육안 only), setup (장비 설치, 30 s after arrival). */
export type PostState = 'ready' | 'moving' | 'setup';

/** A 관측소 이동 as planned when accepted (demo planMove): equal steps of at most 20 m from the post, each with the
 * walking time to it (s); `total` s, `dist` m, `forest` m of it under canopy. */
export interface MovePlan {
  to: Point;
  pts: { x: number; y: number; t: number }[];
  total: number;
  dist: number;
  forest: number;
}

/** 아군 병사 (demo makeFriendlies): `pos` indexes the scenario's friends; home `hx, hy`, walking target `tx, ty`.
 * `wait`: ticks left standing at its target (counts down only there); `nextFire`: tick it may fire again. */
export interface FriendlyMan {
  pos: number;
  hx: number;
  hy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  ph: number;
  walker: boolean;
  wait: number;
  moving: boolean;
  dir: number;
  prone: boolean;
  alive: boolean; // a fallen man lies (prone) where he fell and never comes back
  vis: boolean;
  nextFire: number;
}

/** 보급 트럭 (demo makeFriendlies): drives `path` (its road, points every 20 m) to and fro; `i` is the point it last
 * reached, `dirn` the way it drives, `wait` ticks left standing, `dustTick` the tick of its last dust cloud. */
export interface Truck {
  path: Point[];
  i: number;
  dirn: 1 | -1;
  x: number;
  y: number;
  wait: number;
  moving: boolean;
  dir: number;
  dustTick: number;
  vis: boolean;
}

/** Who fires at a compromised post: the enemy mortar section, or infantry/APC direct fire. */
export type Shooter = 'mortar' | 'direct';

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

/** What happened to the post or the 관측반, for the log (the texts are the ui's): arrived · set up (장비 설치 끝) ·
 * compromised by unit `pid`, and who will fire (null: nobody can) · a near miss of the first retaliation round · lost.
 * And to our positions: the enemy mortar's rounds begin to fall (26 s after its first volley) · our round fell within
 * 70 m of position `pos` and `k` men fell to it · the first enemy APC burst of the game · unit `pid` overran its
 * objective (진지 돌파). */
export type PostNote =
  | { what: 'arrived' | 'set_up' }
  | { what: 'compromised'; pid: number; fire: Shooter | null }
  | { what: 'near_miss'; fire: Shooter }
  | { what: 'lost'; cause: Shooter | 'friendly' }
  | { what: 'shelling' }
  | { what: 'apc_fire' }
  | { what: 'friendly_hit'; pos: number; k: number }
  | { what: 'overrun'; pid: number };
export type PostEvent = { type: 'post'; tick: number } & PostNote;

/** 사건. */
export type SimEvent = RadioEvent | ImpactEvent | PostEvent;

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
  /** 관측소: in prep the candidate (the planned one until a pick), once started the occupied one; while moving, where
   * the 관측반 walks now (a new object every tick it moves). */
  op: Point;
  /** 기러기가 아는 관측소 위치: the planned post until a 위치 보고 (M1-12). Polar 표적위치 are taken from here. */
  knownOp: Point;
  picked: boolean;
  /** 위치 보고 required: the operation started away from the planned post, or the post moved; until 기러기 reads back
   * a 위치 보고 or the report is skipped, no 사격요구 is taken. */
  reportDue: boolean;
  /** 관측소 이동: `departed` tick the move was taken, `until` tick the setup ends, `moves` taken so far. */
  post: { state: PostState; move: MovePlan | null; departed: number; until: number; moves: number };
  /** The last 위치 보고 sent (기러기 reads it back and takes it as the known post); null before any. */
  posReport: { easting: number; northing: number } | null;
  /** 발각: tick of the last one (150 s pass before the next can count), −1 never. */
  compromised: number;
  /** 보복 under way: who fires, at the post as it stood when found (`at`), the unit that fires, rounds fired so far. */
  fire: { shooter: Shooter; at: Point; pid: number; fired: number } | null;
  /** 관측반 전투 불능: the operation ends 4 s later. */
  observerLost: boolean;
  /** The tick every combat unit was down with no 진지 돌파 (섬멸 if the 관측반 lives on); −1 not (yet). */
  clearTick: number;
  /** The tick a game whose combat units are all down ends, while nothing is owed or in the air; −1 none. */
  endAt: number;
  platoons: Platoon[];
  friendlies: FriendlyMan[]; // 아군 소대, 24 men per position, in position order
  truck: Truck | null; // null when the terrain has no supply road
  shells: { pos: number; at: number }[]; // enemy mortar rounds in the air: the position they fall on, the tick they land
  shelledUntil: number[]; // per position: the tick its men stay down to after an enemy round (0 never)
  effects: FieldEffect[]; // oldest first
  targets: number; // units found so far: the last 표적 번호 given
  mode: Mode;
  /** In training at some tick from 작전 개시 on: the 판 기록 is a training one (switching in 작전 준비 is free). */
  trainingUsed: boolean;
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

/** 판 기록 (PRD 10.2; no creation time: the record store stamps it). */
export interface GameRecord {
  ticks: number;
  seed: number;
  seedKind: SeedKind;
  cleared: boolean; // 섬멸: every combat unit 격멸·제압, no 진지 돌파, the 관측반 alive
  clearTick: number | null; // 섬멸 시간, ticks from 작전 개시; null unless cleared
  roundsTotal: number; // 사용 포탄: every round fired, adjusting and 효력사 (those in the air too)
  missions: number; // missions that fired
  adjustRounds: number; // corrections, over the missions that fired
  firstErrorAvg: number | null; // 초탄 오차 평균, m (rounded); null: no mission had one
  directionErrorAvg: number | null; // 방향 오차 평균, mils (rounded)
  reportAccuracyPct: number | null; // 전과 보고 정확도: reports that matched the truth, % of those judged
  roundsPerUnit: number | null; // 부대당 탄: rounds ÷ units neutralized, one decimal
  neutralized: number; // 격멸·제압: combat units broken or destroyed
  combatUnits: number; // … of all combat units (the 정찰조 is none)
  earlyDefeats: number; // 조기 격퇴: infantry platoons down before their assault
  friendlyHits: number; // 아군 근접 탄착: rounds within 70 m of a position, a round per position
  friendlyLosses: number; // 아군 손실, men
  dangerCloseMissed: number; // 위험근접 미선언, missions
  observerLost: boolean;
  postMoves: number; // 관측소 이동
  compromised: boolean; // 발각된 적이 있음
  score: number;
  mode: Mode; // training once the game was in training mode after 작전 개시 (demo trainUsed || trainMode)
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
