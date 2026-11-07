import { expect, test } from 'vitest';
import type { Sim } from '@sim';
import { CALL_FFE, DESC_UNKNOWN, desc, openRadio, send, started, toReady } from '../../tests/acceptance/mission';
import { aimedAt, NEAR, toEffect, watch } from '../../tests/acceptance/strike';
import { eomDraft, repeatDraft } from './radio/drafts';
import { reportName } from './effect';

/** The composer's 임무끝 and 재효력사 drafts, from what the ui reads, against what the simulation says when sent. */
function same(make: () => Sim) {
  for (const draft of [(s: Sim) => eomDraft('destroyed', reportName(s.state)), (s: Sim) => repeatDraft('neutralized', 3, reportName(s.state))]) {
    const sim = make();
    const d = draft(sim);
    const r = send(sim, d.input);
    expect(r.ok, d.input.a).toBe(true);
    expect(r.events.map((e) => e.utterance)).toEqual([d.utterance]);
  }
}

test('F-09: 효과 보고의 표적 이름 — 입력기', () => {
  const struck = (stage: 0 | 2 | 3, off = 0) => () => {
    const sim = aimedAt(NEAR, 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'), { x: off, y: 0 });
    toEffect(sim);
    if (stage > 0) watch(sim, 0, stage);
    expect(sim.state.platoons[0]!.intel.stage).toBe(stage);
    return sim;
  };
  same(struck(0)); // 표적
  same(struck(2)); // 적 보병
  same(struck(3)); // 적 보병소대
  expect(reportName(struck(3)().state)).toEqual({ targetName: 'infantry', named: 1 });
  // 400 m off: no round lands within 220 m of it, so the report is about the unit the grid was sent for.
  const missed = struck(3, 400)();
  expect(missed.state.missions[0]!.kills).toEqual([null]);
  expect(reportName(missed.state)).toEqual({ targetName: 'infantry', named: 1 });
  same(struck(3, 400));
  // No unit near: 표적.
  same(() => {
    const sim = started();
    openRadio(sim);
    toReady(sim, DESC_UNKNOWN, CALL_FFE);
    toEffect(sim);
    return sim;
  });
});
