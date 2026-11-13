// PROTOTYPE #118: the number bundles. Every public number comes from research-110-o1 (claim numbers in `src`); the
// rest is "game value". Conversions are written next to the numbers.
import type { ProtoGun } from '@sim/protoGun';

export interface Bundle {
  name: string;
  gun: ProtoGun;
  src: Record<string, string>; // field → source and conversion, for the bundle table
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Vacuum flight time over flat ground at the low angle for `d` m with muzzle velocity `v` m/s. */
const vacTof = (v: number, d: number) => (2 * v * Math.sin(0.5 * Math.asin((9.81 * d) / (v * v)))) / 9.81;
/** TOF scale vs the base: base TOF taken as KH179's (684 m/s, #14), scaled by the vacuum-TOF ratio at 10 km. */
const tofScale = (v: number) => vacTof(v, 10_000) / vacTof(684, 10_000);

const BASE: ProtoGun = {
  maxRangeM: null,
  tof: { baseS: 3, sPerKm: 2.6 },
  peRange: { baseM: 2, mPerKm: 1.5 },
  peDeflection: { baseM: 1, mPerKm: 0.5 },
  sheaf: [[-60, 22], [-36, -22], [-12, 22], [12, -22], [36, 22], [60, -22]],
  ffe: { intervalS: 9, jitterS: 2.2 },
  lethalRadiusM: { man: { quick: { stand: 26, prone: 15 }, vt: { stand: 28, prone: 24 } }, vehicle: 7, tube: { quick: 10, vt: 7 } },
};

// 155mm 공개 PE: FM 6-40 at 6 km PE_r 15 m, PE_d 4 m (#13). The base at 6 km is 11 / 4 m: range ×15/11, deflection ×1.
const PE155_R = 15 / 11;
// 105mm vs 155mm PE: ARES 105mm CEP 120 m (#5) vs GICHD 155mm CEP 95 m (#13), both at 15 km: ×120/95.
const PE105 = 120 / 95;
// 공개 살상: base PD 서 있음 area 0.92·π·26² = 1,954 m² → ARES/ICRC 155mm 800 m² (#15): man R ×√(800/1954).
const R155 = Math.sqrt(800 / (0.92 * Math.PI * 26 * 26));
// 105 : 155 lethal area 500 : 800 m² (#7, #15): every R ×√(500/800).
const R105 = Math.sqrt(500 / 800);

interface Spec {
  key: string;
  cal: 105 | 155;
  maxRangeM: number;
  rangeSrc: string;
  v: number;
  vSrc: string;
  intervalS: number;
  intervalSrc: string;
}

const SPECS: Spec[] = [
  { key: 'KH178', cal: 105, maxRangeM: 14_700, rangeSrc: '#3 HE 14.7 km', v: 494, vSrc: '#6 KM1 494 m/s', intervalS: 4, intervalSrc: '#8 최대 15발/분 → 4.0초' },
  { key: 'KH179', cal: 155, maxRangeM: 24_000, rangeSrc: '#12 HE 24 km', v: 684, vSrc: '#14 KM107·KM119A1 684 m/s', intervalS: 15, intervalSrc: '#16 최대 4발/분 → 15초' },
  { key: 'K55', cal: 155, maxRangeM: 24_000, rangeSrc: '#20 K55 24 km', v: 684.3, vSrc: '#20 KM119A1 684.3 m/s', intervalS: 15, intervalSrc: '#21 최대 4발/분 → 15초' },
  { key: 'K9', cal: 155, maxRangeM: 40_000, rangeSrc: '#24 표준 40 km', v: 928, vSrc: '#24 K307+K676 928 m/s', intervalS: 7.5, intervalSrc: '#25 최대 6–8발/분 중 8발/분 → 7.5초' },
];

const scaleR = (g: ProtoGun['lethalRadiusM'], man: number, other: number): ProtoGun['lethalRadiusM'] => ({
  man: {
    quick: { stand: r1(g.man.quick.stand * man), prone: r1(g.man.quick.prone * man) },
    vt: { stand: r1(g.man.vt.stand * man), prone: r1(g.man.vt.prone * man) },
  },
  vehicle: r1(g.vehicle * other),
  tube: { quick: r1(g.tube.quick * other), vt: r1(g.tube.vt * other) },
});

function bundles(s: Spec): Bundle[] {
  const k = tofScale(s.v);
  const c = s.cal === 105 ? PE105 : 1;
  const common = {
    maxRangeM: s.maxRangeM,
    tof: { baseS: r2(3 * k), sPerKm: r2(2.6 * k) },
    sheaf: BASE.sheaf,
    ffe: { intervalS: s.intervalS, jitterS: r2((s.intervalS * 2.2) / 9) },
  };
  const srcCommon = {
    maxRangeM: s.rangeSrc,
    tof: `${s.vSrc}; base TOF × 진공 비과시간 비(10 km, 684 m/s 기준) ${r2(k)} [game value]`,
    sheaf: '6문 W자 그대로 (#2·#23 문수 unconfirmed, ATP 6문) [game value]',
    ffe: `${s.intervalSrc}; 흔들림 = 간격 × 2.2/9 [game value]`,
  };
  const pub: ProtoGun = {
    ...common,
    peRange: { baseM: r2(2 * PE155_R * c), mPerKm: r2(1.5 * PE155_R * c) },
    peDeflection: { baseM: r2(1 * c), mPerKm: r2(0.5 * c) },
    lethalRadiusM: scaleR(BASE.lethalRadiusM, s.cal === 105 ? R155 * R105 : R155, s.cal === 105 ? R105 : 1),
  };
  const game: ProtoGun = {
    ...common,
    peRange: { baseM: r2(2 * c), mPerKm: r2(1.5 * c) },
    peDeflection: pub.peDeflection,
    lethalRadiusM: scaleR(BASE.lethalRadiusM, s.cal === 105 ? R105 : 1, s.cal === 105 ? R105 : 1),
  };
  const pe105 = s.cal === 105 ? ' × 105/155 CEP 비 120/95 (#5/#13)' : '';
  return [
    {
      name: `${s.key} 공개`,
      gun: pub,
      src: {
        ...srcCommon,
        peRange: `FM 6-40 6 km 15 m (#13): base × 15/11${pe105}`,
        peDeflection: `FM 6-40 6 km 4 m (#13) = base${pe105}`,
        lethal: s.cal === 105 ? '사람 R: 800 m² 맞춤 × √(500/800) (#15·#7); 장갑차·포신 base × √(500/800)' : '사람 R: PD 서 있음 면적 800 m² (#15)에 맞춰 base × 0.640; 장갑차·포신 base [game value]',
      },
    },
    {
      name: `${s.key} 게임`,
      gun: game,
      src: {
        ...srcCommon,
        peRange: `공개 × 11/15 (base가 FM 6-40에 거는 조정)${pe105}`,
        peDeflection: '공개와 같음 (base 조정 ×1)',
        lethal: s.cal === 105 ? 'base R × √(500/800) (#7/#15 면적 비) [game value]' : 'base R [game value]',
      },
    },
  ];
}

export const BUNDLES: Bundle[] = [{ name: 'base', gun: BASE, src: { all: '지금 코드 (#28)' } }, ...SPECS.flatMap(bundles)];
