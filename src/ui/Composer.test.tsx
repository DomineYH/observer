import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Activity, RadioEvent, Target, Unit, UnitType, Warning } from '@sim';
import { answered, openRadio, send, started } from '../../tests/acceptance/mission';
import { Composer, type ComposerForm } from './Composer';
import { RadioLog } from './RadioLog';
import { callDraft, descDraft, locDraft, targetOptions, type DescForm } from './radio/drafts';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const text = (html: string) => html.replace(/<[^>]*>/g, '');
/** The sentence the composer shows at `stage`, starting from `initial`. */
function shown(stage: 'idle' | 'loc' | 'desc', platoons: Parameters<typeof targetOptions>[0], initial: Partial<ComposerForm>) {
  const html = renderToStaticMarkup(
    <Composer stage={stage} live platoons={platoons} names={NAMES} mode="standard" send={() => {}} initial={initial} />,
  );
  return text(html.match(/<p aria-label="보낼 문장">(.*?)<\/p>/)![1]!);
}
/** The sentence of a log line, without its time and speaker. */
const logged = (e: RadioEvent) =>
  text(renderToStaticMarkup(<RadioLog lines={[e]} callsign={NAMES.callsign} gridLetters={NAMES.gridLetters} mode="standard" />)).replace(
    /^\d\d:\d\d 갈매기 /,
    '',
  );
const seen = (type: UnitType, activity: Activity, stage: number, size: { unit: Unit; n: number } | null) => ({ type, activity, intel: { stage, size } });

const HEAD = { rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } as const;
const MISSIONS: {
  defaults?: true;
  warning: Warning;
  grid: { e: string; n: string };
  platoons: ReturnType<typeof seen>[];
  head: Omit<DescForm, 'target'>;
  target: Target;
}[] = [
  // The composer's own defaults: 조정, then 미상 표적 포대 3발.
  { defaults: true, warning: 'adjust', grid: { e: '4720', n: '0315' }, platoons: [], head: HEAD, target: { targetType: 'unknown' } },
  {
    warning: 'ffe',
    grid: { e: '0100', n: '9999' },
    platoons: [seen('inf', 'attacking', 3, { unit: 'platoon', n: 1 })],
    head: { ...HEAD, rounds: 2, fuzeRequest: 'quick' },
    target: { targetType: 'infantry', activity: 'attacking', unit: 'platoon' },
  },
  {
    warning: 'adjust',
    grid: { e: '5512', n: '3256' },
    platoons: [seen('mortar', 'halted', 2, null), seen('apc', 'moving', 3, { unit: 'vehicles', n: 2 })],
    head: { rounds: 1, fuzeRequest: 'vt', control: 'amc', dangerClose: 1 },
    target: { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 },
  },
];

test('F-07: 미리보기는 송신 문장과 같다', () => {
  for (const m of MISSIONS) {
    const sim = started();
    openRadio(sim);
    const key = JSON.stringify(m.target);
    expect(targetOptions(m.platoons).map((t) => JSON.stringify(t))).toContain(key);
    const steps = [
      ['idle', m.defaults ? {} : { warning: m.warning }, callDraft(m.warning), 'call'],
      ['loc', { grid: m.grid }, locDraft(Number(m.grid.e), Number(m.grid.n)), 'loc'],
      ['desc', m.defaults ? {} : { ...m.head, target: key }, descDraft({ ...m.head, target: m.target }), 'desc'],
    ] as const;
    for (const [stage, initial, draft, a] of steps) {
      const preview = shown(stage, m.platoons, initial);
      const r = send(sim, draft.input);
      expect(r.ok).toBe(true);
      const said = r.events.find((e) => e.utterance.speaker === 'observer')!;
      expect(said.utterance).toEqual(draft.utterance);
      expect(logged(said)).toBe(preview);
      answered(sim, a);
    }
  }
});

test('표적성질 선택지: 관측된 적정만', () => {
  const at = (type: UnitType, stage: number, size: { unit: Unit; n: number } | null = null) => seen(type, 'moving', stage, size);
  expect(targetOptions([])).toEqual([{ targetType: 'unknown' }]);
  expect(targetOptions([at('apc', 1)])).toEqual([{ targetType: 'unknown' }]);
  expect(
    targetOptions([at('recon', 2), at('inf', 2), at('mortar', 3, { unit: 'tubes', n: 3 }), at('inf', 3, { unit: 'platoon', n: 1 })]),
  ).toEqual([
    { targetType: 'infantry', activity: 'moving', unit: 'none' },
    { targetType: 'mortar', activity: 'moving', unit: 'tubes', count: 3 },
    { targetType: 'infantry', activity: 'moving', unit: 'platoon' },
    { targetType: 'unknown' },
  ]);
});
