import { SIM_VERSION, type ReplayData } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { BASE_SCENARIO } from '@content/scenario';
import { CLEAR_WEATHER } from '@adapters/mock/weather';

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
  {
    // ②: 레이저 at the mortar section (the ground on the ridge short of it answers: 5425 m) → 극좌표 조정 → 수정 0과 함께
    // 효력사 → 임무끝 → 전이 with 위험근접 declared (one adjusting round first) → 100 m 수정과 함께 효력사 → 임무끝 →
    // 관측소 이동 80 m east (behind the front: 78 s on foot, 30 s setup) → 위치 보고 at its grid. Each input about 200
    // ticks after its stage opens (probe, SIM_VERSION 12: loc 427, desc 682, adjust 2371, effect 4139, shift's adjust 5840,
    // effect 7399, set up 9968, readback 10231); no 발각 on this seed.
    file: '2-polar-move.json',
    replay: {
      ...HEAD,
      inputs: [
        START,
        { t: 150, a: 'lase', v: [987, -14] },
        { t: 351, a: 'call', v: ['adjust'] },
        { t: 627, a: 'loc', v: ['polar', 99, 5425] },
        { t: 882, a: 'desc', v: [3, 'none', 'ready', 0, 'mortar', 'halted', 'none'] },
        { t: 2571, a: 'corr', v: ['left', 0, 'drop', 0, 'ffe'] },
        { t: 4339, a: 'eom', v: ['neutralized'] },
        { t: 4540, a: 'shift', v: [99, 'left', 200, 'add', 300, 2, 1, 'unknown'] },
        { t: 6040, a: 'corr', v: ['right', 100, 'drop', 100, 'ffe'] },
        { t: 7599, a: 'eom', v: ['ineffective'] },
        { t: 7800, a: 'move', v: [5200, 1800] },
        { t: 10168, a: 'pos', v: [4520, 3180] },
      ],
      totalTicks: 10631,
    },
  },
  {
    // ③: 개시 at the planned post, then nothing until the 40분 한도 ends the game at tick 48 000 (probe, SIM_VERSION 15:
    // no 발각; 적 1소대 overruns our 2소대 at 29 338, 적 2소대 falls to our direct fire, the APCs and the mortar stay up;
    // score −1263).
    file: '3-time-limit.json',
    replay: { ...HEAD, inputs: [START], totalTicks: 48000 },
  },
];
