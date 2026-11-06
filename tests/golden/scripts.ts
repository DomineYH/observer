import { SIM_VERSION, type ReplayData } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@app/clearWeather';

// 각본 입력: the source each golden file is generated from by `npm run golden:update`.
export const SCRIPTS: { file: string; replay: ReplayData }[] = [
  {
    file: '0-empty.json', // 0번: 계획된 관측소에서 개시만 한 빈 판 400틱
    replay: {
      format: 1,
      simVersion: SIM_VERSION,
      seed: 20261106,
      seedKind: 'daily',
      scenario: { id: BASE_SCENARIO.id, version: BASE_SCENARIO.version },
      guns: BASE_GUNS,
      weather: CLEAR_WEATHER,
      mode: 'standard',
      stepMs: 50,
      inputs: [{ t: 0, a: 'start', v: [BASE_SCENARIO.plannedOp.x, BASE_SCENARIO.plannedOp.y] }],
      totalTicks: 400,
    },
  },
];
