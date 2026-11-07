// Input values as the slots of the observer's 교신 한 마디 (inputs.ts formats → radio.ts slots). Pure, no draws.
import { snap } from './ballistics';
import type { Corrections, CorrectionSlots, DescriptionSlots, LateralDir, Next, RangeDir, Target } from './radio';
import type { Mission } from './types';

/** A target as its slots: only its own slots are present (미상 has no activity or size, only men·vehicles·tubes a count). */
export function targetSlots(v: readonly (number | string)[]): Target {
  const [targetType, activity, unit, count] = v;
  return (targetType === 'unknown' ? { targetType } : count === undefined ? { targetType, activity, unit } : { targetType, activity, unit, count }) as Target;
}

/** The `desc` values as slots. */
export function descSlots(v: readonly (number | string)[]): DescriptionSlots {
  const [rounds, fuzeRequest, control, dangerClose] = v;
  return { rounds, fuzeRequest, control, dangerClose, ...targetSlots(v.slice(4)) } as DescriptionSlots;
}

/** 수정량 as sent (demo sendCorr, lines 799–818): snapped to 10 m across and 50 m in range; an axis that snaps to 0 is
 * left out (both out reads 동제원). */
export function corrections(lateralDir: LateralDir, rawLat: number, rangeDir: RangeDir, rawRng: number): Corrections {
  const lateral = snap(rawLat, 10);
  const range = snap(rawRng, 50);
  return { ...(lateral > 0 ? { lateralDir, lateral } : {}), ...(range > 0 ? { rangeDir, range } : {}) } as Corrections;
}

/** A 수정 as sent: 방향 only with the mission's first correction. */
export function corrSlots(m: Mission, v: readonly (number | string)[]): CorrectionSlots {
  const first = m.direction === null;
  const [lateralDir, rawLat, rangeDir, rawRng, nextStep] = (first ? v.slice(1) : v) as [LateralDir, number, RangeDir, number, Next];
  return { ...(first ? { direction: v[0] as number } : {}), ...corrections(lateralDir, rawLat, rangeDir, rawRng), next: nextStep } as CorrectionSlots;
}
