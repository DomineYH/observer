import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Input, SeedKind } from '@sim';
import { BASE_SCENARIO } from '@content/scenario';
import { pressStart, PrepPanel, type PrepState } from './PrepPanel';

const WEATHER = {
  visibilityM: 24000,
  cloudPct: 15,
  windFromDeg: 285,
  windSpeedTenthMs: 26,
  tempTenthC: 94,
  precipTenthMmH: 0,
  pressureHpa: 1023,
  humidityPct: 48,
};
const PREP: PrepState = { phase: 'prep', op: BASE_SCENARIO.plannedOp, picked: false, reportDue: false };
const text = (seed: number, seedKind: SeedKind, state = PREP) =>
  renderToStaticMarkup(
    <PrepPanel
      state={state}
      scenario={BASE_SCENARIO}
      grid={{ letters: 'CH', e0: 40000, n0: 30000 }}
      seed={seed}
      seedKind={seedKind}
      weather={WEATHER}
      send={() => {}}
      queued={[]}
      live={state}
    />,
  ).replace(/<[^>]*>/g, '');

test('F-30: 시드 종류 표시', () => {
  const practice = text(1234, 'practice');
  expect(practice).toContain('연습 1234');
  expect(practice).toContain('랭킹 제외');
  const daily = text(20261106, 'daily');
  expect(daily).toContain('일일 20261106');
  expect(daily).not.toContain('연습');
  // The weather is shown with the seed.
  expect(daily).toContain('시정 24.0 km');
  expect(daily).toContain('바람 285° 2.6 m/s');
});

test('F-22: 작전 준비 화면', () => {
  const prep = text(20261106, 'daily');
  // 적정 첫보, three NAIs with their 신뢰도, the two expected routes, the planned post and the 이동 한계선.
  expect(prep).toContain('적 보병 1개 중대(-)');
  expect(prep).toContain('NAI 1 서측 고개 — 적 정찰조 활동 첩보 (신뢰도 보통)');
  expect(prep).toContain('NAI 3 북쪽 능선 일대 — 적 박격포 진지 추정 (신뢰도 낮음)');
  expect(prep).toContain('중앙 접근로(가능성 높음), 서측 접근로(가능성 보통)');
  expect(prep).toContain('계획된 관측소 1번 고지 찰리호텔 4512 3180');
  expect(prep).toContain('이동 한계선');
  expect(prep).toContain('지도를 눌러 관측소 후보를 고르십시오');
  expect(text(20261106, 'daily', { ...PREP, op: { x: 3000, y: 2500 }, picked: true })).toContain('관측소 후보: 찰리호텔 4300 3250');

  // Once started: where the post stands, and the 위치 보고 when it is not the planned one.
  const live = { ...PREP, phase: 'live' as const, op: { x: 3000, y: 2500 }, reportDue: true };
  expect(text(20261106, 'daily', live)).toContain('작전 개시 — 찰리호텔 4300 3250 점령. 계획과 다른 위치이므로 기러기에게 위치를 보고하십시오.');
  expect(text(20261106, 'daily', { ...live, reportDue: false })).not.toContain('위치를 보고');
});

test('F-22: 작전 개시 단추는 패널이 그린 상태가 아니라 지금의 관측소를 보낸다', () => {
  // The panel was drawn before the pick was stepped; the simulation has applied it since, and nothing is queued.
  const rendered: PrepState = { ...PREP, op: BASE_SCENARIO.plannedOp, picked: false };
  const live = { op: { x: 3000, y: 2500 } };
  const sent: Input[] = [];
  pressStart({ state: rendered, live, queued: [], send: (i) => void sent.push(i) });
  expect(sent).toEqual([{ a: 'start', v: [3000, 2500] }]);
  // A pick still queued wins over both.
  sent.length = 0;
  pressStart({ state: rendered, live, queued: [{ a: 'pick', v: [3100, 2600] }], send: (i) => void sent.push(i) });
  expect(sent).toEqual([{ a: 'start', v: [3100, 2600] }]);
});

