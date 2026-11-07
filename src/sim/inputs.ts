// 입력 종류 and their value formats (재생 자료 format 1, spec 입력 기록). The one kind table: the replay format check
// and the simulation's step both use it. Kinds are added by the slices that use them.
import { ACTIVITIES, CONTROLS, EFFECTS, FUZE_REQUESTS, LATERAL_DIRS, NEXTS, RANGE_DIRS, SLOT_RANGES, TARGET_TYPES, WARNINGS } from './radio';
import type { Input } from './types';

/** An integer in range, or one of the enum identifiers (ASCII strings, spec 열거형 식별자). */
type Field = readonly [min: number, max: number] | readonly string[];
/** The value lists a kind accepts: most kinds have one. */
type Format = readonly (readonly Field[])[];

const range = (k: keyof typeof SLOT_RANGES): Field => [SLOT_RANGES[k].min, SLOT_RANGES[k].max];
/** 표적성질 input: 발수, 신관(요청), 통제, 위험근접, then the target as its slots (radio.ts `Target`). */
const DESC_HEAD: readonly Field[] = [range('rounds'), FUZE_REQUESTS, CONTROLS, [0, 1]];
const KNOWN: readonly Field[] = [TARGET_TYPES.filter((t) => t !== 'unknown'), ACTIVITIES];
/** 수정 input: 좌우·거리, 사거리·거리 as raw meters (the simulation snaps them), 다음 (조정 · 효력사). */
const CORR: readonly Field[] = [LATERAL_DIRS, [0, SLOT_RANGES.lateral.max], RANGE_DIRS, [0, SLOT_RANGES.range.max], NEXTS];
/** 수정 후 효력사, sent after 효력사: the same, 다음 효력사 only, and the 효과 seen. */
const CORR_EFFECT: readonly Field[] = [...CORR.slice(0, 4), ['ffe'], EFFECTS];

// A Map, so no kind name can reach an inherited object key.
const FORMATS = new Map<string, Format>([
  ['cam', [[[0, 63999], [-2000, 2000]]]], // 조준: 방위 · 고저, 0.1 mil
  ['bino', [[[0, 1]]]], // 쌍안경: 끔 · 켬
  ['pick', [[[0, 99999], [0, 99999]]]], // 관측소 후보 선정: 동 · 북 m (one 방안)
  ['start', [[[0, 99999], [0, 99999]]]], // 작전 개시: 동 · 북 m
  ['id', [[[0, 63999], [-6000, 6000]]]],
  ['lase', [[[0, 63999], [-2000, 2000]]]], // 레이저: 방위 · 고저, 0.1 mil // 식별: the pressed point's 방위 · 고저, 0.1 mil; the simulation picks the target
  ['call', [[WARNINGS]]], // 호출: 경고명령
  // 표적위치: 좌표법 동 · 북 4자리, or 극좌표법 방위각 mils · 거리 m (raw; the simulation snaps it to 10 m)
  ['loc', [[['grid'], range('easting'), range('northing')], [['polar'], range('azimuth'), range('distance')]]],
  ['desc', [
    [...DESC_HEAD, ['unknown']], // 미상 표적: no activity or size
    [...DESC_HEAD, ...KNOWN, ['platoon', 'platoon_minus', 'squad', 'none']],
    [...DESC_HEAD, ...KNOWN, ['men', 'vehicles', 'tubes'], range('count')],
  ]],
  ['fire', [[]]], // 발사 (준비 쏴): no values
  // 수정: 방향 only with the mission's first correction
  ['corr', [CORR, [range('direction'), ...CORR], CORR_EFFECT, [range('direction'), ...CORR_EFFECT]]],
  ['repeat', [[EFFECTS, range('rounds')]]], // 재효력사: 효과, 발수
  ['eom', [[EFFECTS]]], // 임무끝: 효과
]);

function fits(f: Field, x: unknown): boolean {
  if (typeof f[0] === 'string') return (f as readonly string[]).includes(x as string);
  const [min, max] = f as readonly [number, number];
  return Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
}

/** A known kind with exactly the values of one of its formats. Kinds without values carry no `v`. */
export function validInput(a: string, v: unknown): boolean {
  const formats = FORMATS.get(a);
  if (!formats) return false;
  if (v === undefined) return formats.some((f) => f.length === 0);
  if (!Array.isArray(v)) return false;
  return formats.some((f) => f.length > 0 && v.length === f.length && f.every((field, i) => fits(field, v[i])));
}

export const isValid = (input: Input): boolean => validInput(input.a, input.v);
