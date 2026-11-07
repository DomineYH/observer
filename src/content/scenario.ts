import type { Confidence, RouteKey, Scenario } from '@sim';

/** 기본 시나리오 (demo lines 207–209, 406–433). Keep `plannedOp` and `friends` equal to the mock terrain's `OP_HILL` and
 * `FRIEND_HILLS`. */
export const BASE_SCENARIO: Scenario = {
  id: 'base',
  version: 1,
  plannedOp: { x: 5120, y: 1800 }, // 1번 고지
  battery: { x: 4200, y: -4600 },
  frontY: 3650,
  friends: [
    { x: 4350, y: 3380 },
    { x: 5150, y: 3460 },
    { x: 5950, y: 3380 },
  ],
  supplyRoad: 1, // 청계읍 → 고개 → 새터 (demo ROADS[1]): keep equal to the mock terrain's road order
  routes: {
    A: [{ x: 3300, y: 6900 }, { x: 3550, y: 5300 }, { x: 4350, y: 3380 }],
    B: [{ x: 5050, y: 6600 }, { x: 5000, y: 5000 }, { x: 5150, y: 3460 }],
    C: [{ x: 6800, y: 6700 }, { x: 6450, y: 5100 }, { x: 5950, y: 3380 }],
  },
  nais: [
    { x: 3450, y: 6300, r: 450, conf: 'medium' },
    { x: 5050, y: 6150, r: 450, conf: 'high' },
    { x: 5800, y: 7550, r: 550, conf: 'low' },
  ],
  intelRoutes: [
    { route: 'B', conf: 'high' },
    { route: 'A', conf: 'medium' },
  ],
  units: [
    { type: 'recon', route: { first: 'A', second: 'B', p: 0.6 }, t0: 0 }, // 적 정찰조
    { type: 'inf', route: 'B', t0: 90 }, // 적 1소대
    { type: 'inf', route: { first: 'A', second: 'C', p: 0.5 }, t0: 200 }, // 적 2소대
    { type: 'apc', route: { first: 'B', second: 'C', p: 0.5 }, t0: 260 }, // 적 장갑차 2대
    { type: 'mortar', nai: 2, spread: { x: 700, y: 500 }, t0: 0 }, // 적 82mm 박격포반
  ],
};

/** 작전 준비 화면의 글 (demo lines 925–933), in the scenario's order. */
export const BRIEFING = {
  enemy:
    '적 보병 1개 중대(-) 규모가 아군 1~3소대 진지 방향으로 공격할 것으로 판단됨. 장갑차 일부 동반 가능. 82mm 박격포 1개 반이 북쪽 능선 일대에서 지원할 것으로 추정.',
  nais: ['서측 고개 — 적 정찰조 활동 첩보', '중앙 안부 — 적 주 접근로로 판단', '북쪽 능선 일대 — 적 박격포 진지 추정'],
  routes: { A: '서측 접근로', B: '중앙 접근로', C: '동측 접근로' } satisfies Record<RouteKey, string>,
  conf: { high: '높음', medium: '보통', low: '낮음' } satisfies Record<Confidence, string>,
  mission: '관측소를 선정·점령하여 NAI와 접근로를 감시하고, 적 발견 시 화력을 유도한다.',
  caution:
    '파란 점선은 아군 전선(이동 한계선). 그 앞으로도 나갈 수 있지만 적에게 발각되면 관측소가 사격을 받는다. 작전 개시 후 이동은 도보. 다른 곳을 점령하면 기러기에게 위치를 보고해야 함.',
};
