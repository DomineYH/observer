import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Activity, RadioEvent, Target, Unit, UnitType, Warning } from '@sim';
import { answered, CALL_ADJUST, DESC_AMC, DESC_UNKNOWN, openRadio, send, started, toAdjust, toReady } from '../../tests/acceptance/mission';
import { Composer, type ComposerForm } from './Composer';
import { RadioLog } from './RadioLog';
import { callDraft, descDraft, FIRE, fireKey, locDraft, targetOptions, type DescForm } from './radio/drafts';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const text = (html: string) => html.replace(/<[^>]*>/g, '');
/** The sentence the composer shows at `stage`, starting from `initial`. */
function shown(stage: 'idle' | 'loc' | 'desc', platoons: Parameters<typeof targetOptions>[0], initial: Partial<ComposerForm>) {
  const html = renderToStaticMarkup(
    <Composer stage={stage} live platoons={platoons} names={NAMES} mode="standard" send={() => {}} state={{ missions: [], platoons: [], op: { x: 0, y: 0 }, aim: { az: 0, el: 0 } }} initial={initial} />,
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

test('F-07: F 키', () => {
  expect(fireKey('f')).toBe(FIRE);
  expect(fireKey('F')).toBe(FIRE);
  for (const k of ['g', 'b', 'Enter', ' ', 'ArrowLeft']) expect(fireKey(k)).toBeNull();

  /** The composer at stage ready for a mission sent with `d`: its markup, and the simulation at that point. */
  const atReady = (d: typeof DESC_AMC) => {
    const sim = started();
    openRadio(sim);
    toReady(sim, d, CALL_ADJUST);
    const html = renderToStaticMarkup(
      <Composer stage="ready" live platoons={[]} names={NAMES} mode="standard" send={() => {}} state={sim.state} />,
    );
    return { sim, html };
  };
  const amc = atReady(DESC_AMC);
  expect(amc.html).toMatch(/<button[^>]*>준비 쏴/);
  // The button and the key send the same input, and the simulation takes it: the observer says 준비 쏴.
  const r = send(amc.sim, fireKey('f')!);
  expect(r.ok).toBe(true);
  expect(r.events.map((e) => [e.utterance.speaker, e.utterance.kind])).toEqual([['observer', 'fire']]);
  expect(atReady(DESC_UNKNOWN).html).not.toContain('준비 쏴');
});

test('F-07: 훈련 편의와 제안 — 입력기', () => {
  const sim = started();
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
  toAdjust(sim);
  const form = (mode: 'training' | 'standard') =>
    renderToStaticMarkup(<Composer stage="adjust" live platoons={[]} names={NAMES} mode={mode} send={() => {}} state={sim.state} />);
  const az = String(Math.round(sim.state.aim.az / 10) % 6400);
  // Training: the help line and 방향 filled in from the view; the preview already reads that 방향 (동제원 until changed).
  expect(text(form('training'))).toContain('탄착 부근에 표적 없음');
  expect(form('training')).toContain(`value="${az}"`);
  expect(text(form('training'))).toContain('동제원, 이상.');
  // Standard: no help, 방향 empty, nothing to send yet.
  expect(text(form('standard'))).not.toContain('탄착 부근');
  expect(text(form('standard'))).toContain('방향(밀)을 먼저 입력');
  expect(form('standard')).toMatch(/<button type="button" disabled="">송신/);
});
