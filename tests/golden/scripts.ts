import { SIM_VERSION, type ReplayData } from '@sim';
import { BASE_GUNS } from '@content/guns';
import { MIL } from '@sim/ballistics';
import { atan2 } from '@sim/math';
import { BASE_SCENARIO } from '@content/scenario';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
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

// ⑤'s points, read from the 문경 배치: the planned post, the bearing to NAI 3 in 0.1 mil, and the new post 80 m east.
const MUNGYEONG = (() => {
  const { scenario, terrain } = MUNGYEONG_PLACEMENT;
  const op = scenario.plannedOp;
  const nai = scenario.nais[2]!;
  return { scenario, terrain, op, laseAz: Math.round(atan2(nai.x - op.x, nai.y - op.y) * MIL * 10), moveTo: { x: op.x + 80, y: op.y } };
})();

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
  {
    // ④: one full desktop game on the reference desktop (Intel Core i5-10210U, integrated graphics) in Chrome (ego lite):
    // 일일 시드 20261111, 표준 모드, three 효력사 missions, ended by the 40분 한도. Played by the agent at the owner's
    // request for #45, not by a person; exported as is from the 사후강평 전송 데이터 미리보기 on build 2fe5f88.
    file: '4-desktop-play.json',
    replay: {
      format: 1,
      simVersion: 17,
      seed: 20261111,
      seedKind: 'daily',
      scenario: { id: 'base', version: 1 },
      guns: { id: 'base', version: 1 },
      weather: { visibilityM: 2500, cloudPct: 100, windFromDeg: 180, windSpeedTenthMs: 7, tempTenthC: 40, precipTenthMmH: 0, pressureHpa: 1020, humidityPct: 99 },
      mode: 'training',
      stepMs: 50,
      inputs: [
        { t: 0, a: 'mode', v: ['standard'] },
        { t: 0, a: 'start', v: [5120, 1800] },
        { t: 75, a: 'bino', v: [1] },
        { t: 1018, a: 'cam', v: [204, -270] },
        { t: 1034, a: 'cam', v: [204, -320] },
        { t: 1891, a: 'cam', v: [204, -370] },
        { t: 1919, a: 'cam', v: [204, -420] },
        { t: 1947, a: 'cam', v: [204, -470] },
        { t: 1972, a: 'cam', v: [204, -520] },
        { t: 1993, a: 'cam', v: [204, -570] },
        { t: 2021, a: 'cam', v: [204, -620] },
        { t: 2994, a: 'bino', v: [0] },
        { t: 16380, a: 'cam', v: [62204, -620] },
        { t: 16388, a: 'cam', v: [60204, -620] },
        { t: 16394, a: 'cam', v: [60004, -620] },
        { t: 16399, a: 'cam', v: [59804, -620] },
        { t: 16404, a: 'cam', v: [59604, -620] },
        { t: 16410, a: 'cam', v: [59404, -620] },
        { t: 16414, a: 'cam', v: [59404, -870] },
        { t: 16420, a: 'cam', v: [59404, -1120] },
        { t: 16427, a: 'cam', v: [59404, -1370] },
        { t: 16436, a: 'cam', v: [59404, -1620] },
        { t: 16444, a: 'cam', v: [59404, -1670] },
        { t: 16451, a: 'cam', v: [59404, -1720] },
        { t: 16457, a: 'cam', v: [59404, -1770] },
        { t: 16464, a: 'bino', v: [1] },
        { t: 17327, a: 'cam', v: [59404, -1720] },
        { t: 17333, a: 'cam', v: [59404, -1670] },
        { t: 17340, a: 'cam', v: [59404, -1620] },
        { t: 17347, a: 'cam', v: [59404, -1570] },
        { t: 17354, a: 'cam', v: [59404, -1520] },
        { t: 17360, a: 'cam', v: [59404, -1470] },
        { t: 17366, a: 'cam', v: [59404, -1420] },
        { t: 17387, a: 'cam', v: [59604, -1420] },
        { t: 17395, a: 'cam', v: [59804, -1420] },
        { t: 17403, a: 'cam', v: [60004, -1420] },
        { t: 17422, a: 'cam', v: [60204, -1420] },
        { t: 17428, a: 'cam', v: [60404, -1420] },
        { t: 17434, a: 'cam', v: [60604, -1420] },
        { t: 18145, a: 'bino', v: [0] },
        { t: 18155, a: 'cam', v: [62604, -1420] },
        { t: 18164, a: 'cam', v: [604, -1420] },
        { t: 19812, a: 'call', v: ['ffe'] },
        { t: 20336, a: 'loc', v: ['grid', 4511, 3414] },
        { t: 20410, a: 'desc', v: [3, 'none', 'ready', 0, 'unknown'] },
        { t: 22476, a: 'eom', v: ['ineffective'] },
        { t: 22496, a: 'call', v: ['ffe'] },
        { t: 22653, a: 'loc', v: ['grid', 4607, 3414] },
        { t: 22728, a: 'desc', v: [3, 'none', 'ready', 0, 'unknown'] },
        { t: 24399, a: 'eom', v: ['ineffective'] },
        { t: 25128, a: 'call', v: ['ffe'] },
        { t: 25264, a: 'loc', v: ['grid', 4435, 3414] },
        { t: 25343, a: 'desc', v: [3, 'none', 'ready', 0, 'unknown'] },
        { t: 26897, a: 'eom', v: ['ineffective'] },
        { t: 27964, a: 'bino', v: [1] },
        { t: 28624, a: 'bino', v: [0] },
        { t: 30043, a: 'bino', v: [1] },
        { t: 30695, a: 'bino', v: [0] },
      ],
      totalTicks: 48000,
    },
  },
  {
    // ⑤: ②'s first half on the 문경 land (no 전이·위험근접): 레이저 toward NAI 3, the 박격포 NAI (the ground near its
    // middle answers: 4580 m) → 극좌표 조정 → 수정 0과 함께 효력사 → 임무끝 → 관측소 이동 80 m east (175 s on foot, 30 s
    // setup) → 위치 보고 at its grid. Each input about 200 ticks after its stage opens (probe, SIM_VERSION 17: call 110,
    // loc 386, desc 641, adjust 2280, effect 3999, idle 4200, set up 8504, readback 8782); no 발각 on this seed.
    file: '5-real-laser-move.json',
    replay: {
      ...HEAD,
      scenario: { id: MUNGYEONG.scenario.id, version: MUNGYEONG.scenario.version },
      terrain: MUNGYEONG.terrain,
      inputs: [
        { t: 0, a: 'start', v: [MUNGYEONG.op.x, MUNGYEONG.op.y] },
        { t: 150, a: 'lase', v: [MUNGYEONG.laseAz, -396] },
        { t: 310, a: 'call', v: ['adjust'] },
        { t: 586, a: 'loc', v: ['polar', Math.round(MUNGYEONG.laseAz / 10), 4580] },
        { t: 841, a: 'desc', v: [3, 'none', 'ready', 0, 'mortar', 'halted', 'none'] },
        { t: 2480, a: 'corr', v: ['left', 0, 'drop', 0, 'ffe'] },
        { t: 4199, a: 'eom', v: ['neutralized'] },
        { t: 4400, a: 'move', v: [MUNGYEONG.moveTo.x, MUNGYEONG.moveTo.y] },
        { t: 8704, a: 'pos', v: [4665, 3115] }, // the grid of moveTo (the test ties them)
      ],
      totalTicks: 9182,
    },
  },
];
