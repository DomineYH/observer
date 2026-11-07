import { SIM_VERSION, type ReplayData } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@app/clearWeather';

const HEAD = {
  format: 1,
  simVersion: SIM_VERSION,
  seed: 20261106,
  seedKind: 'daily',
  scenario: { id: BASE_SCENARIO.id, version: BASE_SCENARIO.version },
  guns: BASE_GUNS,
  weather: CLEAR_WEATHER,
  mode: 'standard',
  stepMs: 50,
} as const satisfies Partial<ReplayData>;
const START = { t: 0, a: 'start', v: [BASE_SCENARIO.plannedOp.x, BASE_SCENARIO.plannedOp.y] };

// 각본 입력: the source each golden file is generated from by `npm run golden:update`.
export const SCRIPTS: { file: string; replay: ReplayData }[] = [
  {
    file: '0-empty.json', // 0번: 계획된 관측소에서 개시만 한 빈 판 400틱
    replay: { ...HEAD, inputs: [START], totalTicks: 400 },
  },
  {
    // ①: 좌표법 조정 → 수정과 함께 효력사(접근신관) → 임무끝, on the 82 mm mortar section (dug in at grid 4567 3752 on this
    // seed). Each input comes about 200 ticks after its stage opens (probe, SIM_VERSION 9: 수정 from 2206, 효과 관측
    // from 3982), so a small timing change still lands it; a golden with ignored inputs fails its test.
    file: '1-grid-eom.json',
    replay: {
      ...HEAD,
      inputs: [
        START,
        { t: 300, a: 'call', v: ['adjust'] },
        { t: 500, a: 'loc', v: ['grid', 4567, 3752] },
        { t: 700, a: 'desc', v: [3, 'vt', 'ready', 0, 'mortar', 'halted', 'none'] },
        { t: 2400, a: 'corr', v: [100, 'right', 60, 'drop', 50, 'ffe'] },
        { t: 4200, a: 'eom', v: ['neutralized'] },
      ],
      totalTicks: 4600,
    },
  },
];
