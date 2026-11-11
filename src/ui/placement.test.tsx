import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim } from '@sim';
import { replayOf } from '@app/records';
import { INF_RECON } from '../../tests/acceptance/end';
import { init } from '../../tests/acceptance/init';
import { TEST_PLACEMENT } from '../../tests/acceptance/placement';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Debrief } from './Debrief';
import { PrepPanel } from './PrepPanel';

const strip = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('배치: 패널과 강평은 고른 배치에서 읽는다', () => {
  const { scenario, briefing } = TEST_PLACEMENT;
  const state = { phase: 'prep', op: scenario.plannedOp, picked: false, reportDue: false } as const;
  const panel = strip(
    renderToStaticMarkup(
      <PrepPanel
        state={state}
        scenario={scenario}
        briefing={briefing}
        terrain={flatTerrain()}
        seed={1}
        seedKind="daily"
        weather={init(1).weather}
        send={() => {}}
        queued={[]}
        live={state}
        preset={null}
        onPreset={() => {}}
      />,
    ),
  );
  for (const s of [
    '계획된 관측소 9번 마루 찰리호텔 4512 3180',
    '고르지 않으면 계획된 9번 마루를 점령합니다.',
    '시험 적정.',
    'NAI 1 시험 하나 (신뢰도 보통)',
    '을 접근로(가능성 높음), 갑 접근로(가능성 보통)',
    '시험 임무.',
    '시험 주의.',
  ])
    expect(panel).toContain(s);
  for (const s of ['1번 고지', '서측 고개', '중앙 접근로']) expect(panel).not.toContain(s);

  // INF_RECON's platoon walks route B and its recon team route A: the 실제 배치 line names them from the 배치.
  const sim = createSim({ ...init(2), scenario: INF_RECON });
  const debrief = strip(
    renderToStaticMarkup(
      <Debrief state={sim.state} record={sim.record()} grid={flatTerrain().grid} callsign="참새12" saved="pending" replay={replayOf(init(2), [], 0)} briefing={briefing} />,
    ),
  );
  expect(debrief).toContain('실제 배치: 적 1소대 을 접근로 · 적 정찰조 갑 접근로');
  expect(debrief).not.toContain('중앙 접근로');
});
