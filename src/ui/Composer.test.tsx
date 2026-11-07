import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { RadioEvent } from '@sim';
import { openRadio, send, started, until } from '../../tests/acceptance/mission';
import { Composer } from './Composer';
import { RadioLog } from './RadioLog';
import { callDraft, descDraft, locDraft, targetOptions, type Draft } from './radio/drafts';
import { radioSentence, spoken } from './radio/sentence';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const text = (html: string) => html.replace(/<[^>]*>/g, '');
const preview = (d: Draft) => spoken(radioSentence(d.utterance, NAMES));
const logged = (e: RadioEvent) =>
  text(renderToStaticMarkup(<RadioLog lines={[e]} callsign={NAMES.callsign} gridLetters={NAMES.gridLetters} mode="standard" />));
const composer = (stage: 'idle' | 'loc' | 'desc') =>
  text(renderToStaticMarkup(<Composer stage={stage} live platoons={[]} names={NAMES} mode="standard" send={() => {}} />));

const HEAD = { rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } as const;

test('F-07: 미리보기는 송신 문장과 같다', () => {
  const descs = [
    descDraft({ ...HEAD, target: { targetType: 'unknown' } }),
    descDraft({ ...HEAD, rounds: 2, fuzeRequest: 'quick', target: { targetType: 'infantry', activity: 'attacking', unit: 'platoon' } }),
    descDraft({ rounds: 1, fuzeRequest: 'vt', control: 'amc', dangerClose: 1, target: { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 } }),
  ];
  for (const d of descs) {
    const sim = started();
    openRadio(sim);
    const stage = (s: string) => () => sim.state.radio.stage === s;
    for (const [draft, next] of [
      [callDraft('adjust'), 'loc'],
      [locDraft(4720, 315), 'desc'],
      [d, 'ready'],
    ] as const) {
      const r = send(sim, draft.input);
      expect(r.ok).toBe(true);
      const said = r.events.find((e) => e.utterance.speaker === 'observer')!;
      expect(said.utterance).toEqual(draft.utterance);
      expect(logged(said).endsWith(` ${preview(draft)}`)).toBe(true);
      until(sim, stage(next));
    }
  }
  // The composer shows the same sentence before sending (its defaults: 조정, then 미상 표적 3발).
  expect(composer('idle')).toContain(preview(callDraft('adjust')));
  expect(composer('desc')).toContain(preview(descs[0]!));
});

test('표적성질 선택지: 관측된 적정만', () => {
  const seen = (type: 'inf' | 'recon' | 'apc' | 'mortar', stage: number, size: { unit: 'men' | 'platoon' | 'tubes'; n: number } | null = null) => ({
    type,
    activity: 'moving' as const,
    intel: { stage, size },
  });
  expect(targetOptions([])).toEqual([{ targetType: 'unknown' }]);
  expect(targetOptions([seen('apc', 1)])).toEqual([{ targetType: 'unknown' }]);
  expect(
    targetOptions([seen('recon', 2), seen('inf', 2), seen('mortar', 3, { unit: 'tubes', n: 3 }), seen('inf', 3, { unit: 'platoon', n: 1 })]),
  ).toEqual([
    { targetType: 'infantry', activity: 'moving', unit: 'none' },
    { targetType: 'mortar', activity: 'moving', unit: 'tubes', count: 3 },
    { targetType: 'infantry', activity: 'moving', unit: 'platoon' },
    { targetType: 'unknown' },
  ]);
});
