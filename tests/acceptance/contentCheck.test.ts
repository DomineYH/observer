// 내용 검증 (#140): the content rules every 배치, 포 프로파일 and 실전 수치 of the repository keeps, each rule caught on a
// datum broken on purpose; and the JSON round trip of all three.
import { isDeepStrictEqual } from 'node:util';
import { expect, test } from 'vitest';
import { contentCheck, type Finding } from '@content/check';
import { COMBAT } from '@content/combat';
import { BASE_GUNS, type Gun } from '@content/guns';
import { GUNS, PLACEMENTS } from '@content/lookup';
import type { Placement } from '@content/placement';
import { farthestM, inRange } from '@content/range';
import { BASE } from '@content/scenarios/base';
import type { CombatData } from '@sim';

const check = (placements: readonly Placement[], combat: CombatData = COMBAT) => contentCheck({ placements, guns: GUNS, combat });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a broken datum is one the types would refuse
type Raw = any;
/** `base` with one thing changed: a deep copy, so the repository's 배치 stays as it is. */
const broken = (change: (p: Raw) => unknown): Placement => {
  const p: Raw = structuredClone(BASE);
  change(p);
  return p;
};
const at = (rule: string, where: string, id = 'base'): Finding => ({ id, rule, at: where });

test('시나리오: 내용 검증 — 규칙마다 어긴 자료가 걸린다', () => {
  expect(check(PLACEMENTS)).toEqual([]); // the two 배치 of today pass as they are

  const cases: [Placement[], Finding[]][] = [
    // 1. 식별자의 꼴, 겹침, 버전
    [[broken((p) => (p.scenario.id = 'Base'))], [at('시나리오 1', 'id', 'Base')]],
    [[broken((p) => (p.scenario.id = '1base'))], [at('시나리오 1', 'id', '1base')]],
    [[broken((p) => (p.scenario.id = 'base_2'))], [at('시나리오 1', 'id', 'base_2')]],
    [[BASE, broken((p) => (p.terrain = { id: 'other', version: 1 }))], [at('시나리오 1', 'id')]],
    [[broken((p) => (p.scenario.version = 0))], [at('시나리오 1', 'version')]],
    [[broken((p) => (p.scenario.version = 1.5))], [at('시나리오 1', 'version')]],
    // 2. 접근로가 1개 이상, 열쇠는 대문자 한 글자
    [[broken((p) => (Object.assign(p.scenario, { routes: {}, intelRoutes: [], units: [p.scenario.units[4]], reinforcements: [p.scenario.units[4]] }), (p.briefing.routes = {})))], [at('시나리오 2', 'routes')]],
    [[broken((p) => ((p.scenario.routes.d = p.scenario.routes.A), (p.briefing.routes.d = '넷째 접근로')))], [at('시나리오 2', 'routes.d')]],
    // 3. 접근로마다 3점 이상
    [[broken((p) => p.scenario.routes.B.splice(1, 1))], [at('시나리오 3', 'routes.B')]],
    // 4. 아군 진지가 1개 이상, 접근로의 끝점은 아군 진지
    [[broken((p) => (p.scenario.routes.A[2] = { x: 4351, y: 3380 }))], [at('시나리오 4', 'routes.A')]],
    [[broken((p) => (p.scenario.friends = []))], [at('시나리오 4', 'friends'), at('시나리오 4', 'routes.A'), at('시나리오 4', 'routes.B'), at('시나리오 4', 'routes.C')]],
    // 5. 아군 진지는 전선의 남쪽, 접근로의 첫 점은 북쪽
    [[broken((p) => (p.scenario.frontY = 3400))], [at('시나리오 5', 'friends[1]')]],
    [[broken((p) => (p.scenario.routes.C[0] = { x: 6800, y: 3650 }))], [at('시나리오 5', 'routes.C')]],
    // 6. 부대가 가리키는 접근로가 있고 뽑는 확률은 0과 1 사이
    [[broken((p) => (p.scenario.units[1].route = 'D'))], [at('시나리오 6', 'units[1].route')]],
    [[broken((p) => (p.scenario.units[2].route.second = 'D'))], [at('시나리오 6', 'units[2].route')]],
    [[broken((p) => (p.scenario.units[0].route.p = 1))], [at('시나리오 6', 'units[0].route.p')]],
    [[broken((p) => (p.scenario.units[0].route.p = 0))], [at('시나리오 6', 'units[0].route.p')]],
    // 7. 예상 접근로의 열쇠가 있고 겹치지 않는다
    [[broken((p) => (p.scenario.intelRoutes[0].route = 'D'))], [at('시나리오 7', 'intelRoutes[0].route')]],
    [[broken((p) => (p.scenario.intelRoutes[1].route = 'B'))], [at('시나리오 7', 'intelRoutes[1].route')]],
    // 8. 박격포의 NAI가 있고 상자는 양수, NAI의 반경은 양수
    [[broken((p) => (p.scenario.units[4].nai = 3))], [at('시나리오 8', 'units[4].nai')]],
    [[broken((p) => (p.scenario.units[4].nai = 0.5))], [at('시나리오 8', 'units[4].nai')]],
    [[broken((p) => (p.scenario.units[4].spread.y = 0))], [at('시나리오 8', 'units[4].spread')]],
    [[broken((p) => (p.scenario.nais[1].r = 0))], [at('시나리오 8', 'nais[1].r')]],
    // 9. 전투 부대가 1개 이상
    [[broken((p) => (p.scenario.units = [p.scenario.units[0]]))], [at('시나리오 9', 'units')]],
    // 11. 작전 시간 한도는 양의 정수 초, 출발과 사격 개시는 0 이상의 정수 초이고 한도보다 작다
    [[broken((p) => (p.scenario.timeLimitS = 2400.5))], [at('시나리오 11', 'timeLimitS')]],
    [[broken((p) => (p.scenario.units[0].t0 = -1))], [at('시나리오 11', 'units[0].t0')]],
    [[broken((p) => (p.scenario.units[1].t0 = 90.5))], [at('시나리오 11', 'units[1].t0')]],
    [[broken((p) => (p.scenario.units[3].t0 = 2400))], [at('시나리오 11', 'units[3].t0')]],
    [[broken((p) => (p.scenario.units[4].fireFromS = 2400))], [at('시나리오 11', 'units[4].fireFromS')]],
    // 13. 글과 자료의 짝
    [[broken((p) => p.briefing.nais.pop())], [at('시나리오 13', 'briefing.nais')]],
    [[broken((p) => (p.briefing.routes = { B: '중앙 접근로', A: '서측 접근로', C: '동측 접근로' }))], [at('시나리오 13', 'briefing.routes')]],
    // 14. 빈 글이 아니다
    ...(['name', 'blurb', 'enemy', 'mission', 'plannedOp'] as const).map((k): [Placement[], Finding[]] => [[broken((p) => (p.briefing[k] = ' '))], [at('시나리오 14', `briefing.${k}`)]]),
    [[broken((p) => (p.briefing.nais[1] = ''))], [at('시나리오 14', 'briefing.nais[1]')]],
    [[broken((p) => (p.briefing.routes.B = ''))], [at('시나리오 14', 'briefing.routes.B')]],
    // 증원 (M3-16): 6 · 8 · 11 on its side, and 10. 증원 목록에 전투 부대가 1개 이상
    [[broken((p) => (p.scenario.reinforcements[0].route.first = 'D'))], [at('시나리오 6', 'reinforcements[0].route')]],
    [[broken((p) => (p.scenario.reinforcements[1].route = 'E'))], [at('시나리오 6', 'reinforcements[1].route')]],
    [[broken((p) => (p.scenario.reinforcements[1].route.p = 1))], [at('시나리오 6', 'reinforcements[1].route.p')]],
    [[broken((p) => p.scenario.reinforcements.push({ ...p.scenario.units[4], nai: 3, spread: { x: 0, y: 500 } }))], [at('시나리오 8', 'reinforcements[2].nai'), at('시나리오 8', 'reinforcements[2].spread')]],
    [[broken((p) => (p.scenario.reinforcements[0].t0 = 2400))], [at('시나리오 11', 'reinforcements[0].t0')]],
    [[broken((p) => (p.scenario.reinforcements[1].t0 = 479.5))], [at('시나리오 11', 'reinforcements[1].t0')]],
    [[broken((p) => p.scenario.reinforcements.push({ ...p.scenario.units[4], fireFromS: -1 }))], [at('시나리오 11', 'reinforcements[2].fireFromS')]],
    [[broken((p) => (p.scenario.reinforcements = []))], [at('시나리오 10', 'reinforcements')]],
    [[broken((p) => (p.scenario.reinforcements = [p.scenario.units[0]]))], [at('시나리오 10', 'reinforcements')]],
  ];
  cases.forEach(([placements, findings], i) => expect(check(placements), `case ${i}`).toEqual(findings));
});

test('시나리오: 일일 시작일은 실제 날짜이고 기본 시나리오에는 없다', () => {
  // A second 배치 on the mock 전장: not its 기본 시나리오, so it may carry a 일일 시작일.
  const later = (dailyFrom: number) => broken((p) => Object.assign(p, { dailyFrom }) && (p.scenario.id = 'later'));
  for (const good of [20261201, 20280229, 20991231]) expect(check([BASE, later(good)])).toEqual([]);
  for (const bad of [20261332, 20261131, 20270229, 20261200, 2026121, 202612010, 20261201.5])
    expect(check([BASE, later(bad)]), `${bad}`).toEqual([at('시나리오 15', 'dailyFrom', 'later')]);
  // 기본 시나리오 = a 전장's first 배치: each 전장 has its own.
  expect(check([broken((p) => (p.dailyFrom = 20261201))])).toEqual([at('시나리오 16', 'dailyFrom')]);
  expect(check([BASE, later(20261201), broken((p) => ((p.terrain.id = 'other'), (p.scenario.id = 'other'), (p.dailyFrom = 20261201)))])).toEqual([at('시나리오 16', 'dailyFrom', 'other')]);
  expect(PLACEMENTS.slice(0, 2).map((p) => p.dailyFrom)).toEqual([undefined, undefined]); // base@1 and base-mungyeong@2 gain no value
});

/** 일일 시작일 on main, 식별자 → 시작일: a row is never changed or removed, a new 배치 with one adds its row (ADR 0020). */
const DAILY_FROM: Readonly<Record<string, number>> = {};

test('시나리오: main에 들어간 일일 시작일은 그대로다', () => {
  const held = Object.fromEntries(PLACEMENTS.filter((p) => p.dailyFrom !== undefined).map((p) => [p.scenario.id, p.dailyFrom]));
  expect(held).toEqual(DAILY_FROM);
});

test('실전: 실전 수치의 내용 검증', () => {
  expect(contentCheck({ placements: [], guns: GUNS, combat: COMBAT })).toEqual([]); // 실전 자료 판 1 passes as it is
  const combat = (change: (c: Raw) => unknown): CombatData => {
    const c: Raw = structuredClone(COMBAT);
    change(c);
    return c;
  };
  const bad = (rule: string, where: string): Finding => ({ id: 'combat', rule, at: where });
  const cases: [CombatData, Finding[]][] = [
    // 1. 열셋 모두 양수
    ...Object.keys(COMBAT.numbers).filter((k) => k !== 'barrage').map((k): [CombatData, Finding[]] => [combat((c) => (c.numbers[k] = 0)), [bad('실전 1', `numbers.${k}`)]]),
    [combat((c) => (c.numbers.barrage.intervalS = -4)), [bad('실전 1', 'numbers.barrage.intervalS')]],
    [combat((c) => (c.numbers.barrage.rounds = 0)), [bad('실전 1', 'numbers.barrage.rounds')]],
    [combat((c) => (c.numbers.correctionDelayS = NaN)), [bad('실전 1', 'numbers.correctionDelayS')]],
    // 1. 정수여야 하는 다섯: 점수 셋, 본사격 탄수, 레이저 한도. The others may be decimal.
    ...['radioExposure', 'laserExposure', 'exposureLimit', 'laserLimit'].map((k): [CombatData, Finding[]] => [combat((c) => (c.numbers[k] += 0.5)), [bad('실전 1', `numbers.${k}`)]]),
    [combat((c) => (c.numbers.barrage.rounds = 6.5)), [bad('실전 1', 'numbers.barrage.rounds')]],
    [combat((c) => ((c.numbers.samePlaceM = 100.5), (c.numbers.barrage.intervalS = 4.5), (c.numbers.stayLimitS = 600.5))), []],
    // 2. 실전 자료 판은 1 이상의 정수
    [combat((c) => (c.version = 0)), [bad('실전 2', 'version')]],
    [combat((c) => (c.version = 1.5)), [bad('실전 2', 'version')]],
  ];
  cases.forEach(([c, findings], i) => expect(contentCheck({ placements: [], guns: GUNS, combat: c }), `case ${i}`).toEqual(findings));
});

/** JSON으로 옮겼다 되돌려도 같다: `NaN` and the infinities come back as `null`, `undefined` and functions not at all. */
const roundTrips = (x: unknown) => isDeepStrictEqual(JSON.parse(JSON.stringify(x)), x);

test('시나리오: JSON으로 옮겼다 되돌려도 같다', () => {
  expect(PLACEMENTS.filter((p) => !roundTrips(p)).map((p) => p.scenario.id)).toEqual([]);
  expect(GUNS.filter((g) => !roundTrips(g)).map((g) => g.profile.id)).toEqual([]);
  expect(roundTrips(COMBAT)).toBe(true);
  // Numbers that are not finite are caught, in each of the three.
  expect(roundTrips(broken((p) => (p.scenario.nais[0].r = NaN)))).toBe(false);
  expect(roundTrips(broken((p) => (p.scenario.routes.A[1].x = Infinity)))).toBe(false);
  expect(roundTrips({ ...GUNS[0]!.profile, maxRangeM: -Infinity })).toBe(false);
  expect(roundTrips({ ...COMBAT, numbers: { ...COMBAT.numbers, hitRadiusM: NaN } })).toBe(false);
});

test('포 프로파일: 내용 검증', () => {
  const guns = (change: (g: Raw[]) => unknown): Gun[] => {
    const list: Raw = structuredClone(GUNS);
    change(list);
    return list;
  };
  const gunCheck = (list: readonly Gun[]) => contentCheck({ placements: [], guns: list, combat: COMBAT });
  expect(gunCheck(GUNS)).toEqual([]); // the five pass as they are
  const bad = (rule: number, where: string, id = 'kh178'): Finding => ({ id, rule: `포 프로파일 ${rule}`, at: where });
  const k = 1; // kh178
  const cases: [Gun[], Finding[]][] = [
    // 1. 식별자의 꼴과 버전은 시나리오와 같고 겹치지 않는다. 첫 항목이 기본 포 base다
    [guns((l) => (l[k].profile.id = 'KH178')), [bad(1, 'id', 'KH178')]],
    [guns((l) => (l[k].profile.id = '178')), [bad(1, 'id', '178')]],
    [guns((l) => (l[k].profile.id = 'base')), [bad(1, 'id', 'base')]],
    [guns((l) => (l[k].profile.version = 0)), [bad(1, 'version')]],
    [guns((l) => (l[k].profile.version = 1.5)), [bad(1, 'version')]],
    [guns((l) => l.reverse()), [bad(1, 'id', 'k9')]],
    [guns((l) => l.splice(0, 1)), [bad(1, 'id')]],
    // 2. 방렬이 1문 이상
    [guns((l) => (l[k].profile.sheaf = [])), [bad(2, 'sheaf')]],
    // 3. 효력사 간격, 살상 반경 일곱 값, 최대 사거리는 양수
    [guns((l) => (l[k].profile.ffe.intervalS = 0)), [bad(3, 'ffe.intervalS')]],
    [guns((l) => (l[k].profile.maxRangeM = -1)), [bad(3, 'maxRangeM')]],
    ...['man.quick.stand', 'man.quick.prone', 'man.vt.stand', 'man.vt.prone', 'vehicle', 'tube.quick', 'tube.vt'].map((path): [Gun[], Finding[]] => [
      guns((l) => {
        const keys = path.split('.');
        const last = keys.pop()!;
        keys.reduce((o, key) => o[key], l[k].profile.lethalRadiusM)[last] = 0;
      }),
      [bad(3, `lethalRadiusM.${path}`)],
    ]),
    [guns((l) => (l[k].profile.lethalRadiusM.vehicle = NaN)), [bad(3, 'lethalRadiusM.vehicle')]],
    [guns((l) => (l[k].profile.displacementS = 0)), [bad(3, 'displacementS')]], // 진지 변환 시간 (M3-20)
    // 4. 비과시간·공산오차의 계수 여섯과 효력사 흔들림은 0 이상
    ...['tof.baseS', 'tof.sPerKm', 'peRange.baseM', 'peRange.mPerKm', 'peDeflection.baseM', 'peDeflection.mPerKm', 'ffe.jitterS'].map((path): [Gun[], Finding[]] => {
      const [a, b] = path.split('.') as [string, string];
      return [guns((l) => (l[k].profile[a][b] = -0.1)), [bad(4, path)]];
    }),
    [guns((l) => ((l[k].profile.tof.baseS = 0), (l[k].profile.peRange.mPerKm = 0), (l[k].profile.ffe.jitterS = 0))), []], // 0 is allowed
    // 5. 이름과 소개 글이 빈 글이 아니다
    [guns((l) => (l[k].name = ' ')), [bad(5, 'name')]],
    [guns((l) => (l[k].blurb = '')), [bad(5, 'blurb')]],
  ];
  cases.forEach(([list, findings], i) => expect(gunCheck(list), `case ${i}`).toEqual(findings));
});

test('포 프로파일: 사거리 검사 — 모든 시나리오는 기본 포로 통과한다', () => {
  // #119's 사거리 검사로 본 지금의 내용: base 12.80 km (NAI 3's edge), base-mungyeong 12.20 km (route C's first point).
  expect(PLACEMENTS.slice(0, 2).map((p) => Math.round(farthestM(p.scenario) / 10) / 100)).toEqual([12.8, 12.2]);
  for (const p of PLACEMENTS) for (const g of GUNS) expect(inRange(p.scenario, g.profile), `${p.scenario.id} ${g.profile.id}`).toBe(true);
  expect(check(PLACEMENTS)).toEqual([]); // rule 12 holds for every 배치

  // Each kind of point counts: moved out until it alone is 23.6 km from the battery, it fails the base gun's 24 km.
  const { battery } = BASE.scenario;
  const far = { x: battery.x, y: battery.y + 23600 };
  const cases: [string, (p: Raw) => unknown][] = [
    ['route point', (p) => (p.scenario.routes.B[1] = far)],
    ['NAI edge', (p) => (p.scenario.nais[0] = { ...p.scenario.nais[0], x: far.x, y: far.y - 100, r: 100 })],
    ['mortar box corner', (p) => ((p.scenario.nais[2] = { ...p.scenario.nais[2], x: far.x, y: far.y - 1000, r: 10 }), (p.scenario.units[4].spread = { x: 10, y: 2000 }))],
    ['friendly position', (p) => (p.scenario.friends[0] = { x: far.x, y: battery.y - 23600 })],
    ['증원 mortar box corner', (p) => ((p.scenario.nais[2] = { ...p.scenario.nais[2], x: far.x, y: far.y - 1000, r: 10 }), p.scenario.reinforcements.push({ ...p.scenario.units[4], spread: { x: 10, y: 2000 } }))],
  ];
  for (const [what, change] of cases) {
    const p = broken(change);
    expect(farthestM(p.scenario), what).toBeCloseTo(23600, 0); // a box corner is 5 m off the line
    expect(inRange(p.scenario, BASE_GUNS), what).toBe(false);
    expect(check([p]).filter((f) => f.rule === '시나리오 12'), what).toEqual([at('시나리오 12', 'battery')]);
  }
  // The 500 m margin: 23.5 km passes, a metre more fails.
  expect(inRange(broken((p) => (p.scenario.routes.B[1] = { x: battery.x, y: battery.y + 23500 })).scenario, BASE_GUNS)).toBe(true);
  expect(inRange(broken((p) => (p.scenario.routes.B[1] = { x: battery.x, y: battery.y + 23501 })).scenario, BASE_GUNS)).toBe(false);
  // The 105mm's 14.7 km against today's base: 12.80 + 0.5 km is inside.
  expect(inRange(BASE.scenario, { ...BASE_GUNS, maxRangeM: 13290 })).toBe(false);
});
