import type { Point } from '@sim';
import type { BaseScenario, Placement } from '../placement';

const line = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }));

/** 배치 `base-mungyeong`: 기본 시나리오 on 문경 지형 2판 (국지 m, 동·북). The 데모 값 (units, 예상 접근로, 신뢰도, 박격포
 * 상자, 작전 시간 한도, names) equal `base`'s and are written out here: `배치: 데모 값은 그대로` holds the two together.
 * The three posts are copied into `terrain/mungyeong/config.json` as 벌채 원: move a post → change that copy, raise the
 * 지형 판 and rebuild (terrain/README.md). Any change in `scenario` raises `version`. */
export const BASE_MUNGYEONG: Placement & { scenario: BaseScenario } = {
  scenario: {
    id: 'base-mungyeong',
    version: 2,
    plannedOp: { x: 6340, y: 660 }, // 1번 고지
    reserveOps: line([5400, 1380], [8010, 870]),
    battery: { x: 5420, y: -5740 },
    fixedPoint: { x: 6220, y: 4360 },
    frontY: 4050,
    friends: line([4580, 3250], [6490, 3410], [7180, 3800]),
    supplyRoad: 28,
    routes: {
      A: line([3710, 5420], [3880, 5080], [4060, 4780], [4040, 4560], [4240, 4450], [4280, 4220], [4320, 3830], [4310, 3670], [4340, 3430], [4560, 3370], [4580, 3250]),
      B: line([5500, 5820], [5410, 5120], [5360, 4760], [5600, 4680], [5640, 4610], [5690, 4330], [5880, 4330], [5960, 4100], [6040, 3940], [6200, 3700], [6220, 3600], [6250, 3510], [6490, 3410]),
      // C's (7185, 4690) lies on its leg past the halt: it keeps C at 12 points, so a seed's jitter draws stay as tested
      C: line([7400, 6300], [7400, 6150], [7450, 5980], [7430, 5730], [7570, 5540], [7508, 5250], [7530, 4990], [7185, 4690], [6840, 4390], [6880, 4160], [6950, 4040], [7180, 3800]),
    },
    nais: [
      { x: 3780, y: 5560, r: 450, conf: 'medium' },
      { x: 5560, y: 5800, r: 250, conf: 'high' },
      { x: 8220, y: 4820, r: 340, conf: 'low' },
    ],
    intelRoutes: [
      { route: 'B', conf: 'high' },
      { route: 'A', conf: 'medium' },
    ],
    timeLimitS: 2400, // 40분
    units: [
      { type: 'recon', route: { first: 'A', second: 'B', p: 0.6 }, t0: 0 }, // 적 정찰조
      { type: 'inf', route: 'B', t0: 90 }, // 적 1소대
      { type: 'inf', route: { first: 'A', second: 'C', p: 0.5 }, t0: 200 }, // 적 2소대
      { type: 'apc', route: { first: 'B', second: 'C', p: 0.5 }, t0: 260 }, // 적 장갑차 2대
      { type: 'mortar', nai: 2, spread: { x: 700, y: 500 }, t0: 0, fireFromS: 210 }, // 적 82mm 박격포반
    ],
  },
  // Only the NAI 세 줄 and the 박격포 구절 differ from `base`'s, named by villages on the map (no 산·고개 이름).
  briefing: {
    name: '보병 중대',
    blurb: '세 접근로. 보병 중대(-)와 장갑차, 박격포. 40분.',
    plannedOp: '1번 고지',
    enemy:
      '적 보병 1개 중대(-) 규모가 아군 1~3소대 진지 방향으로 공격할 것으로 판단됨. 장갑차 일부 동반 가능. 82mm 박격포 1개 반이 당포리 서쪽 일대에서 지원할 것으로 추정.',
    nais: ['지곡리 북쪽 골짜기 머리 — 적 정찰조 활동 첩보', '팔영리 북쪽 골짜기 — 적 주 접근로로 판단', '당포리 서쪽 일대 — 적 박격포 진지 추정'],
    routes: { A: '서측 접근로', B: '중앙 접근로', C: '동측 접근로' },
    conf: { high: '높음', medium: '보통', low: '낮음' },
    mission: '관측소를 선정·점령하여 NAI와 접근로를 감시하고, 적 발견 시 화력을 유도한다.',
    caution:
      '파란 점선은 아군 전선(이동 한계선). 그 앞으로도 나갈 수 있지만 적에게 발각되면 관측소가 사격을 받는다. 작전 개시 후 이동은 도보. 다른 곳을 점령하면 기러기에게 위치를 보고해야 함.',
  },
  terrain: { id: 'mungyeong', version: 2 },
};
