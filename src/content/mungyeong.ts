import type { Point } from '@sim';
import type { Placement } from './placement';
import { BASE_SCENARIO, BRIEFING } from './scenario';

const line = (...xy: [number, number][]): Point[] => xy.map(([x, y]) => ({ x, y }));

/** 문경 배치 on 문경 지형 2판 (국지 m, 동·북). The 데모 값 (units, 예상 접근로, 신뢰도, 박격포 상자, names) are the
 * mock's. The three posts are copied into `terrain/mungyeong/config.json` as 벌채 원: move a post → change that copy,
 * raise the 지형 판 and rebuild (terrain/README.md). Any coordinate change raises `version`. */
export const MUNGYEONG_PLACEMENT: Placement = {
  scenario: {
    ...BASE_SCENARIO,
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
      C: line([7400, 6300], [7400, 6150], [7450, 5980], [7430, 5730], [7570, 5540], [7510, 5250], [7524, 5053], [7500, 4990], [6840, 4390], [6880, 4160], [6950, 4040], [7180, 3800]),
    },
    nais: [
      { x: 3780, y: 5560, r: 450, conf: 'medium' },
      { x: 5560, y: 5800, r: 250, conf: 'high' },
      { x: 8220, y: 4820, r: 340, conf: 'low' },
    ],
  },
  // Only the NAI 세 줄 and the 박격포 구절 differ from the mock's, named by villages on the map (no 산·고개 이름).
  briefing: {
    ...BRIEFING,
    plannedOp: '1번 고지',
    enemy: BRIEFING.enemy.replace('북쪽 능선 일대', '당포리 서쪽 일대'),
    nais: ['지곡리 북쪽 골짜기 머리 — 적 정찰조 활동 첩보', '팔영리 북쪽 골짜기 — 적 주 접근로로 판단', '당포리 서쪽 일대 — 적 박격포 진지 추정'],
  },
  terrain: { id: 'mungyeong', version: 2 },
};
