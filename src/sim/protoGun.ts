// PROTOTYPE, not product code (#118, branch prototype/m3-gun-numbers): the 포 프로파일 fields of #117 as one mutable
// object, so the runner in prototype/gun-numbers/ can swap bundles. The default is today's numbers (base@1).
export const protoGun = {
  maxRangeM: null as number | null, // the sim never reads it; base's value is #119's
  tof: { baseS: 3, sPerKm: 2.6 }, // 비과시간
  peRange: { baseM: 2, mPerKm: 1.5 }, // 사거리 공산오차
  peDeflection: { baseM: 1, mPerKm: 0.5 }, // 편의 공산오차
  sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]] as (readonly [lat: number, rng: number])[],
  ffe: { intervalS: 9, jitterS: 2.2 },
  lethalRadiusM: {
    man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } },
    vehicle: 7,
    tube: { quick: 10, vt: 7 },
  },
};

export type ProtoGun = typeof protoGun;
