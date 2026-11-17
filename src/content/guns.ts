import type { GunProfile } from '@sim';

/** 포 프로파일 목록의 항목: the profile (its numbers, under its version) and beside it the 글, outside every version. */
export interface Gun {
  profile: GunProfile;
  name: string;
  blurb: string;
}

// base@1: the numbers the simulation code held until M3-2. Changing one raises `version` and needs a new 기대값 줄.
export const BASE_GUNS: GunProfile = {
  id: 'base',
  version: 1,
  maxRangeM: 24000,
  tof: { baseS: 3, sPerKm: 2.6 },
  peRange: { baseM: 2, mPerKm: 1.5 },
  peDeflection: { baseM: 1, mPerKm: 0.5 },
  sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
  ffe: { intervalS: 9, jitterS: 2.2 },
  lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
};

/** 포 프로파일 목록: the 기본 포 first, then the four guns of #118's 게임 조정 묶음. Every profile writes all its numbers
 * (none is taken from another), so changing one gun never moves another. */
export const GUNS: readonly Gun[] = [
  { profile: BASE_GUNS, name: '155mm 견인포', blurb: '데모의 155mm 견인포 6문 포대. 일일 판은 늘 이 포로 쏜다.' },
  {
    profile: {
      id: 'kh178',
      version: 1,
      maxRangeM: 14700,
      tof: { baseS: 4.22, sPerKm: 3.66 },
      peRange: { baseM: 2.53, mPerKm: 1.89 },
      peDeflection: { baseM: 1.26, mPerKm: 0.63 },
      sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
      ffe: { intervalS: 4, jitterS: 0.98 },
      lethalRadiusM: { man: { quick: { stand: 20.6, prone: 11.9 }, vt: { stand: 22.1, prone: 19.0 } }, vehicle: 5.5, tube: { quick: 7.9, vt: 5.5 } },
    },
    name: 'KH178 105mm 견인포',
    blurb: '105mm 견인포 6문 포대. 효력사는 빠르지만 탄이 작고 비과시간이 길다. 최대 사거리 14.7 km.',
  },
  {
    profile: {
      id: 'kh179',
      version: 1,
      maxRangeM: 24000,
      tof: { baseS: 3, sPerKm: 2.6 },
      peRange: { baseM: 2, mPerKm: 1.5 },
      peDeflection: { baseM: 1, mPerKm: 0.5 },
      sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
      ffe: { intervalS: 15, jitterS: 3.67 },
      lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
    },
    name: 'KH179 155mm 견인포',
    blurb: '155mm 견인포 6문 포대. 효력사가 문당 15초로 느리다. 최대 사거리 24 km.',
  },
  {
    profile: {
      id: 'k55',
      version: 1,
      maxRangeM: 24000,
      tof: { baseS: 3, sPerKm: 2.6 },
      peRange: { baseM: 2, mPerKm: 1.5 },
      peDeflection: { baseM: 1, mPerKm: 0.5 },
      sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
      ffe: { intervalS: 15, jitterS: 3.67 },
      lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
    },
    name: 'K55 155mm 자주포',
    blurb: '155mm 자주포 6문 포대. 탄도는 KH179와 같다. 최대 사거리 24 km.',
  },
  {
    profile: {
      id: 'k9',
      version: 1,
      maxRangeM: 40000,
      tof: { baseS: 2.2, sPerKm: 1.91 },
      peRange: { baseM: 2, mPerKm: 1.5 },
      peDeflection: { baseM: 1, mPerKm: 0.5 },
      sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
      ffe: { intervalS: 7.5, jitterS: 1.83 },
      lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
    },
    name: 'K9 155mm 자주포',
    blurb: '155mm 자주포 6문 포대. 비과시간이 짧고 효력사가 빠르다. 최대 사거리 40 km.',
  },
];
