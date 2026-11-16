import type { CombatData } from '@sim';

/** 실전 자료 (ADR 0019): the thirteen 실전 수치 at 실전 자료 판 1. The 판 also covers every scenario's 증원 and every
 * 포 프로파일's 진지 변환 시간: change any of them and it rises, nothing else does. */
export const COMBAT: CombatData = {
  version: 1,
  numbers: {
    radioExposure: 1,
    laserExposure: 2,
    exposureLimit: 40,
    samePlaceM: 100,
    rangingDelayS: 240,
    rangingOffsetM: 150,
    barrageDelayS: 90,
    barrage: { rounds: 6, intervalS: 4 },
    hitRadiusM: 40,
    stayLimitS: 600,
    displacementFactor: 0.25,
    correctionDelayS: 2.5,
    laserLimit: 5,
  },
};
