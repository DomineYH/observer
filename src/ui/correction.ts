// 수정 입력 (demo lines 778–792, 799–818, 909–916, 985–991): the correction form's sentence and input, and the
// training-mode help (탄착 편의, 수정값 제안, 미리 채운 방향). Pure.
import type { Corrections, CorrectionSlots, Effect, LateralDir, Mode, Next, Point, RangeDir } from '@sim';
import type { Draft } from './radio/drafts';

/** 좌우·사거리 as typed: numbers stay strings until sent. */
export interface Amount {
  lateralDir: LateralDir;
  lateral: string;
  rangeDir: RangeDir;
  range: string;
}

/** The correction form's fields as typed. */
export interface CorrForm extends Amount {
  direction: string;
  next: Next; // 조정 · 효력사
}

/** Where the last round landed from the nearest platoon, m: + right and + over along the observer–platoon line. */
export interface Deviation {
  lat: number;
  rng: number;
}

const NEAR_M = 800; // demo devAgainst: no platoon this close to the impact → 표적 없음
// The `corr` input's raw-meter bounds and the 방향 range (sim inputs.ts; ui may import sim types only).
const MAX = { direction: 6399, lateral: 800, range: 1500 };

export function deviation(s: {
  op: Point;
  platoons: readonly { x: number; y: number; state: string }[];
  missions: readonly { impacts: readonly Point[] }[];
}): Deviation | null {
  const hit = s.missions.at(-1)?.impacts.at(-1);
  if (!hit) return null;
  let best: Point | null = null;
  let bd = NEAR_M;
  for (const p of s.platoons) {
    const d = Math.hypot(p.x - hit.x, p.y - hit.y);
    if (p.state !== 'wait' && d < bd) [best, bd] = [p, d];
  }
  if (!best) return null;
  const od = Math.hypot(best.x - s.op.x, best.y - s.op.y);
  const ux = (best.x - s.op.x) / od;
  const uy = (best.y - s.op.y) / od;
  const rx = hit.x - best.x;
  const ry = hit.y - best.y;
  return { lat: rx * uy - ry * ux, rng: rx * ux + ry * uy };
}

const snap = (v: number, step: number) => Math.round(v / step) * step; // as the simulation snaps a correction

/** 탄착 편의 and the correction that would bring the round onto the platoon (10 m across, 50 m in range). */
export function suggestion(dev: Deviation | null): { text: string; form: Omit<CorrForm, 'direction' | 'next'> | null } {
  if (!dev) return { text: '탄착 부근에 표적 없음', form: null };
  const lateral = snap(Math.abs(dev.lat), 10);
  const range = snap(Math.abs(dev.rng), 50);
  const [lw, rw] = [dev.lat > 0 ? '좌로' : '우로', dev.rng > 0 ? '줄이기' : '늘리기'];
  return {
    text: `탄착 편의 ${dev.lat > 0 ? '우' : '좌'} ${lateral} m · 사거리 ${dev.rng > 0 ? '원' : '근'} ${Math.round(Math.abs(dev.rng))} m → ${lw} ${lateral}, ${rw} ${range}`,
    form: { lateralDir: dev.lat > 0 ? 'left' : 'right', lateral: String(lateral), rangeDir: dev.rng > 0 ? 'drop' : 'add', range: String(range) },
  };
}

/** 방향 field's start: in training the view's azimuth (0.1 mil) in mils, in standard empty (read it off the view). */
export const prefillDirection = (s: { mode: Mode; aim: { az: number } }): string =>
  s.mode === 'training' ? String(Math.round(s.aim.az / 10) % 6400) : '';

/** A whole number from a field in [min, max]; an empty field is 0. */
function field(text: string, min: number, max: number): number | null {
  const n = text.trim() === '' ? 0 : Number(text);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** The meters as sent (raw, the simulation snaps them) and the 수정량 as said (snapped; an axis at 0 is left out), or null
 * while a field is out of range. */
export function amounts(f: Amount): { lateral: number; range: number; slots: Corrections } | null {
  const lateral = field(f.lateral, 0, MAX.lateral);
  const range = field(f.range, 0, MAX.range);
  if (lateral === null || range === null) return null;
  const [l, r] = [snap(lateral, 10), snap(range, 50)];
  const slots = { ...(l > 0 ? { lateralDir: f.lateralDir, lateral: l } : {}), ...(r > 0 ? { rangeDir: f.rangeDir, range: r } : {}) } as Corrections;
  return { lateral, range, slots };
}

/** A 방향 field: 1–4 digits, 0–6399; else null. */
export const directionOf = (text: string): number | null => (/^\d{1,4}$/.test(text.trim()) ? field(text, 0, MAX.direction) : null);

/** The correction to send, or null while the form cannot be sent (the first correction has no valid 방향). With `effect`
 * it is 수정 후 효력사: the 효과 rides along in the input, not in the sentence. */
export function corrDraft(f: CorrForm, mission: { direction: number | null }, effect?: Effect): Draft | null {
  const first = mission.direction === null;
  const direction = first ? directionOf(f.direction) : null;
  const a = amounts(f);
  if ((first && direction === null) || a === null) return null;
  const slots = { ...(direction !== null ? { direction } : {}), ...a.slots, next: f.next } as CorrectionSlots;
  return {
    input: { a: 'corr', v: [...(direction !== null ? [direction] : []), f.lateralDir, a.lateral, f.rangeDir, a.range, f.next, ...(effect ? [effect] : [])] },
    utterance: { speaker: 'observer', ending: 'over', kind: 'correction', slots },
  };
}
