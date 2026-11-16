// 포 프로파일 (ADR 0014): base@1 holds the numbers the simulation code held before M3-2.
import { expect, test } from 'vitest';
import { BASE_GUNS } from '@content/guns';

test('포 프로파일: base의 숫자는 지금 코드의 값이다', () => {
  // A second copy on purpose: a changed number goes red here by name, not only in the 기대값 표.
  expect(BASE_GUNS).toEqual({
    id: 'base',
    version: 1,
    maxRangeM: 24000,
    tof: { baseS: 3, sPerKm: 2.6 },
    peRange: { baseM: 2, mPerKm: 1.5 },
    peDeflection: { baseM: 1, mPerKm: 0.5 },
    sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
    ffe: { intervalS: 9, jitterS: 2.2 },
    lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
  });
});
