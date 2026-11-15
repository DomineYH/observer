// PROTOTYPE, not product code, ticket #130 (시제품: 시나리오·포·모드를 고르는 화면의 모양).
// Three layouts of the 작전 준비 choices on the game page behind ?variant=A|B|C&state=…&n=1|2|4 (dev builds only).
// The scenario list, the five guns, 실전 and the 300 s countdown are faked here; nothing reaches the simulation except
// the 훈련↔표준 `mode` input and the practice weather change, which main already has.
import type { Mode, Phase, SeedKind } from '@sim';
import { dailySeed, kstDate } from '@app/seed';

export const VARIANTS = ['A', 'B', 'C'] as const;
export type Variant = (typeof VARIANTS)[number];
export const VARIANT_NAME: Record<Variant, string> = { A: '줄로 쌓기 · 모드는 머리띠', B: '판 정보 카드', C: '시나리오 먼저 · 개시 바' };
/** daily · practice · combat (실전 chosen, daily) · locked (표준 after 작전 개시) · lockedc (실전 after 작전 개시). */
export const STATES = ['daily', 'practice', 'combat', 'locked', 'lockedc'] as const;
export type State = (typeof STATES)[number];
export const COUNTS = [1, 2, 4] as const;

const q = new URLSearchParams(location.search);
const pick = <T extends string | number>(xs: readonly T[], v: unknown, d: T): T => (xs.includes(v as T) ? (v as T) : d);
const v = q.get('variant');
export const PROTO: Variant | null = import.meta.env.DEV && VARIANTS.includes(v as Variant) ? (v as Variant) : null;
export const STATE: State = pick(STATES, q.get('state'), 'daily');
const REAL = import.meta.env.VITE_OBSERVER_BACKEND === 'real';
export const N = pick(COUNTS, Number(q.get('n')), REAL ? 2 : 1);

/** What main gives chooseSeed: practice gets a seed (today's number) if the address has none; daily drops it. */
export function protoSearch(search: string): string {
  if (!PROTO) return search;
  const p = new URLSearchParams(search);
  const { y, m, d } = kstDate(Date.now());
  if (STATE === 'practice' && !/^\d{1,9}$/.test(p.get('seed') ?? '')) p.set('seed', String(dailySeed(y, m, d)));
  if (STATE === 'daily') p.delete('seed');
  return `?${p}`;
}
/** The real game's mode at load (실전 is played as 표준 underneath) and whether it starts at once (the locked states). */
export const REAL_MODE: Mode = STATE === 'daily' || STATE === 'practice' ? 'training' : 'standard';
export const AUTOSTART = !!PROTO && (STATE === 'locked' || STATE === 'lockedc');

export interface Scn {
  id: string;
  name: string;
  blurb: string;
  fake?: boolean;
}
const BASE_ID = REAL ? 'base-mungyeong' : 'base';
const ALL: Scn[] = [
  { id: BASE_ID, name: '보병 중대', blurb: '세 접근로. 보병 중대(-)와 장갑차, 박격포. 40분.' },
  { id: 'apc-mungyeong', name: '장갑차 선두', blurb: '두 접근로. 장갑차가 앞서고 보병이 뒤따른다. 30분.', fake: !REAL },
  { id: 'fake-3', name: '임시 셋', blurb: '(임시 글) 가짜 시나리오. 세 접근로, 야간.', fake: true },
  { id: 'fake-4', name: '임시 넷', blurb: '(임시 글) 가짜 시나리오. 한 접근로, 기계화 대대(-).', fake: true },
];
export const SCENARIOS = ALL.slice(0, N);
export const GUNS = [
  { id: 'base', name: '155mm 견인포' },
  { id: 'kh178', name: 'KH178 105mm 견인포' },
  { id: 'kh179', name: 'KH179 155mm 견인포' },
  { id: 'k55', name: 'K55 155mm 자주포' },
  { id: 'k9', name: 'K9 155mm 자주포' },
] as const;
/** Faked: with four scenarios KH178 fails the range check, so the disabled look can be seen. All five pass both real ones. */
export const gunOff = (id: string): string | null => (N === 4 && id === 'kh178' ? '사거리 밖 (가짜 예)' : null);
export const COMBAT_BLURB = '실전: 적이 더 오고 적 포병이 쏜다. 보조 정보와 일시정지가 없고 작전 준비에 시간 제한이 있으며, 작전 개시 뒤에는 모드를 바꿀 수 없다.';
export const LIMIT_S = 300;
export type ProtoMode = Mode | 'combat';
export const MODE_NAMES: Record<ProtoMode, string> = { training: '훈련', standard: '표준', combat: '실전' };

/** The scenario this game shows: `scenario` on a practice address if it is in the list, else the 기본 시나리오. */
export function scenarioOf(seedKind: SeedKind): Scn {
  const id = seedKind === 'practice' ? q.get('scenario') : null;
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

// ---- the faked state, one object replaced on every change
const LAST = 'proto130-last';
const read = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
interface S {
  mode: ProtoMode;
  gun: string;
  combatSince: number | null; // 실전 first chosen (wall clock)
  open: 'scenario' | 'gun' | 'weather' | null; // variant B's open chooser
  last: string;
}
let s: S = {
  mode: STATE === 'combat' || STATE === 'lockedc' ? 'combat' : REAL_MODE,
  gun: 'base',
  combatSince: STATE === 'combat' || STATE === 'lockedc' ? Date.now() : null,
  open: null,
  last: read(LAST) ?? '—',
};
const listeners = new Set<() => void>();
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const get = () => s;
export const set = (p: Partial<S>) => {
  s = { ...s, ...p };
  listeners.forEach((l) => l());
};
const say = (last: string) => set({ last });

/** Opens a scenario's practice address, a fresh game (no state kept). Keeps the prototype's own arguments. */
export function chooseScenario(id: string, seed: number): void {
  const url = `?seed=${seed}&scenario=${id}`;
  try {
    sessionStorage.setItem(LAST, `${url} 열림 → 새 연습 판(훈련 ×2, 기본 포, 맑음, 관측소 후보 없음)`);
  } catch {
    /* no storage: the strip just shows — */
  }
  const p = new URLSearchParams(url);
  p.set('variant', PROTO!);
  p.set('state', 'practice');
  if (q.get('n')) p.set('n', q.get('n')!);
  location.search = p.toString();
}
export function chooseGun(id: string): void {
  if (gunOff(id)) return;
  set({ gun: id, open: null, last: `새 판(같은 시드·시나리오, 관측소 후보·모드 유지), 포 = ${GUNS.find((g) => g.id === id)!.name}` });
}
/** Which mode buttons are off: after 작전 개시 a 실전 game locks all three, a 훈련·표준 game only 실전. */
export const modeOff = (m: ProtoMode, phase: Phase): boolean => phase !== 'prep' && (s.mode === 'combat' || m === 'combat');
export function chooseMode(m: ProtoMode, phase: Phase, realSwitch: (m: Mode) => void): void {
  if (m === s.mode || modeOff(m, phase)) return;
  if (m === 'combat') {
    realSwitch('standard');
    set({ mode: m, combatSince: s.combatSince ?? Date.now(), last: '새 판(실전, 관측소 후보·기상·포 유지) · 300초 셈 시작(처음 고른 때부터)' });
  } else if (s.mode === 'combat') {
    realSwitch(m);
    set({ mode: m, last: `새 판(${MODE_NAMES[m]}, 관측소 후보 유지) · 셈은 멈추지 않고 실전으로 돌아오면 이어진다` });
  } else {
    realSwitch(m);
    set({ mode: m, last: `mode 입력 ${MODE_NAMES[m]} (지금과 같다)` });
  }
}
export const noteWeather = (name: string) => say(`새 판(기상 = ${name}, 관측소 후보·모드·포 유지)`);
export const toggle = (open: S['open']) => set({ open: s.open === open ? null : open });

/** Remaining 작전 준비 seconds in 실전, or null. */
export function remaining(now: number): number | null {
  if (s.mode !== 'combat' || s.combatSince === null) return null;
  return Math.max(0, LIMIT_S - Math.floor((now - s.combatSince) / 1000));
}
export const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
