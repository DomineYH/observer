// A 배치 whose names, texts and 예비 관측소 all differ from the mock's, to see what reads the chosen 배치.
import type { Placement } from '@content/placement';
import { BASE_SCENARIO, BRIEFING } from '@content/scenario';

/** On `flatTerrain()`'s grid (CH, 40000, 30000) the reserve posts read 4400 3100 and 4600 3090. */
export const TEST_PLACEMENT: Placement = {
  scenario: { ...BASE_SCENARIO, id: 'test', reserveOps: [{ x: 4000, y: 1000 }, { x: 6000, y: 900 }] },
  briefing: {
    ...BRIEFING,
    plannedOp: '9번 마루',
    enemy: '시험 적정.',
    nais: ['시험 하나', '시험 둘', '시험 셋'],
    routes: { A: '갑 접근로', B: '을 접근로', C: '병 접근로' },
    mission: '시험 임무.',
    caution: '시험 주의.',
  },
  terrain: { id: 'mock', version: 1 },
};
