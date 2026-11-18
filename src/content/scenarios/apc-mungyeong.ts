import type { Point } from '@sim';
import type { Placement } from '../placement';

const line = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }));

/** 배치 `apc-mungyeong` "장갑차 선두" (#127): two 접근로, two 아군 진지, two NAI on 문경 지형 2판 (국지 m, 동·북). Its land is
 * `base-mungyeong`'s, already measured: A and B copy that 배치's B and C point for point, the posts are the three 벌채 원,
 * the NAI are its NAI 2 and 3. The 편제 and 시간표 are `설계`. Any change in `scenario` raises `version`. */
export const APC_MUNGYEONG: Placement = {
  scenario: {
    id: 'apc-mungyeong',
    version: 1,
    plannedOp: { x: 6340, y: 660 }, // 1번 고지
    reserveOps: line([5400, 1380], [8010, 870]),
    battery: { x: 5420, y: -5740 },
    fixedPoint: { x: 6220, y: 4360 },
    frontY: 4050,
    friends: line([6490, 3410], [7180, 3800]),
    supplyRoad: 28,
    routes: {
      A: line([5500, 5820], [5410, 5120], [5360, 4760], [5600, 4680], [5640, 4610], [5690, 4330], [5880, 4330], [5960, 4100], [6040, 3940], [6200, 3700], [6220, 3600], [6250, 3510], [6490, 3410]),
      // (7185, 4690) lies on its leg past the halt: copied with the rest, so the halt is the one measured on `base-mungyeong`
      B: line([7400, 6300], [7400, 6150], [7450, 5980], [7430, 5730], [7570, 5540], [7508, 5250], [7530, 4990], [7185, 4690], [6840, 4390], [6880, 4160], [6950, 4040], [7180, 3800]),
    },
    nais: [
      { x: 5560, y: 5800, r: 250, conf: 'high' },
      { x: 8220, y: 4820, r: 340, conf: 'low' },
    ],
    intelRoutes: [{ route: 'A', conf: 'high' }],
    timeLimitS: 1800, // 30분
    units: [
      { type: 'recon', route: 'A', t0: 0 }, // 적 정찰조
      { type: 'apc', route: 'A', t0: 60 }, // 적 장갑차 1
      { type: 'apc', route: { first: 'B', second: 'A', p: 0.5 }, t0: 150 }, // 적 장갑차 2
      { type: 'inf', route: { first: 'A', second: 'B', p: 0.6 }, t0: 120 }, // 적 1소대
      { type: 'mortar', nai: 1, spread: { x: 700, y: 500 }, t0: 0, fireFromS: 150 }, // 적 82mm 박격포반
    ],
    reinforcements: [
      { type: 'inf', route: { first: 'A', second: 'B', p: 0.5 }, t0: 240 }, // 적 2소대
    ],
  },
  // The 작전 준비 글 does not tell of the 증원.
  briefing: {
    name: '장갑차 선두',
    blurb: '두 접근로. 장갑차가 앞서고 보병이 뒤따른다. 30분.',
    plannedOp: '1번 고지',
    enemy:
      '장갑차를 앞세운 적 보병 1개 소대(+) 규모가 아군 1·2소대 진지 방향으로 공격할 것으로 판단됨. 장갑차 여러 대가 먼저 나와 직사로 지원할 가능성 높음. 82mm 박격포 1개 반이 당포리 서쪽 일대에서 지원할 것으로 추정.',
    nais: ['팔영리 북쪽 골짜기 — 적 주 접근로로 판단', '당포리 서쪽 일대 — 적 박격포 진지 추정'],
    routes: { A: '서측 접근로', B: '동측 접근로' },
    conf: { high: '높음', medium: '보통', low: '낮음' },
    mission: '관측소를 선정·점령하여 NAI와 접근로를 감시하고, 적 발견 시 화력을 유도한다.',
    caution:
      '파란 점선은 아군 전선(이동 한계선). 그 앞으로도 나갈 수 있지만 적에게 발각되면 관측소가 사격을 받는다. 작전 개시 후 이동은 도보. 다른 곳을 점령하면 기러기에게 위치를 보고해야 함.',
  },
  terrain: { id: 'mungyeong', version: 2 },
  dailyFrom: 20261125,
};
