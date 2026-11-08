import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Activity, Lase, Mode, RadioEvent, Target, Unit, UnitType, Warning } from '@sim';
import { answered, CALL_ADJUST, CALL_FFE, desc, DESC_AMC, DESC_UNKNOWN, openRadio, send, started, toAdjust, toReady } from '../../tests/acceptance/mission';
import { oneUnit } from '../../tests/acceptance/enemy';
import { aimedAt, isImpact, NEAR, toEffect, watch } from '../../tests/acceptance/strike';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { deviation, suggestion } from './correction';
import { Preview } from './CorrectionForm';
import { RadioLog } from './RadioLog';
import { callDraft, descDraft, FIRE, fireKey, locDraft, targetOptions, defaultTarget, type DescForm, type Draft } from './radio/drafts';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
/** A set-up post 기러기 knows: the composer offers a call at idle. */
const POST = { post: { state: 'ready', move: null, departed: 0, until: 0, moves: 0 }, reportDue: false, tick: 0, knownOp: { x: 0, y: 0 } } as const;
const GRID = flatTerrain().grid;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
const previewOf = (html: string) => text(html.match(/<p role="status" aria-live="off" aria-label="보낼 문장">(.*?)<\/p>/)![1]!);
/** The sentence the composer's preview shows for `draft` (the composer previews its draft with `Preview`). */
const shown = (draft: Draft) => previewOf(renderToStaticMarkup(<Preview draft={draft} empty="" names={NAMES} mode="standard" send={() => {}} />));
/** The sentence a fresh composer shows at `stage`, from its own starting values. */
const fresh = (stage: 'idle' | 'desc') =>
  previewOf(
    renderToStaticMarkup(
      <Composer stage={stage} live platoons={[]} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={{ missions: [], platoons: [], op: { x: 0, y: 0 }, aim: { az: 0, el: 0 }, lases: [], ...POST }} />,
    ),
  );
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
      ['idle', callDraft(m.warning), 'call'],
      ['loc', locDraft(Number(m.grid.e), Number(m.grid.n)), 'loc'],
      ['desc', descDraft({ ...m.head, target: m.target }), 'desc'],
    ] as const;
    for (const [stage, draft, a] of steps) {
      const preview = shown(draft);
      // A fresh composer starts on the defaults: 조정, then 미상 표적 포대 삼발. Filling the form in is the smokes' part.
      if (m.defaults && stage !== 'loc') expect(fresh(stage)).toBe(preview);
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

test('F-07: 표적성질 기본값 — 경계', () => {
  // Demo 967–972, nearestPlatoon 708: the nearest platoon on the field strictly within 600 m, if identified.
  const at = (x: number, type: UnitType, stage: number, state = 'approach') => ({ ...seen(type, 'moving', stage, null), x, y: 0, state });
  const UNKNOWN = { targetType: 'unknown' };
  const MORTAR = { targetType: 'mortar', activity: 'moving', unit: 'none' };
  const APC = { targetType: 'apc', activity: 'moving', unit: 'none' };
  expect(defaultTarget([], { x: 0, y: 0 })).toEqual(UNKNOWN);
  expect(defaultTarget([at(599, 'mortar', 2)], { x: 0, y: 0 })).toEqual(MORTAR);
  expect(defaultTarget([at(600, 'mortar', 2)], { x: 0, y: 0 })).toEqual(UNKNOWN);
  // The nearest counts, identified or not: an identified one farther off does not stand in for it.
  expect(defaultTarget([at(500, 'mortar', 2), at(100, 'apc', 2)], { x: 0, y: 0 })).toEqual(APC);
  expect(defaultTarget([at(500, 'mortar', 2), at(100, 'apc', 1)], { x: 0, y: 0 })).toEqual(UNKNOWN);
  // Not yet on the field: passed over.
  expect(defaultTarget([at(100, 'apc', 2, 'wait'), at(500, 'mortar', 2)], { x: 0, y: 0 })).toEqual(MORTAR);
  // No mission's location: 미상 표적.
  expect(defaultTarget([at(1, 'mortar', 2)], null)).toEqual(UNKNOWN);
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
      <Composer stage="ready" live platoons={[]} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={sim.state} />,
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
    renderToStaticMarkup(<Composer stage="adjust" live platoons={[]} names={NAMES} grid={GRID} mode={mode} send={() => {}} state={sim.state} help={suggestion(deviation(sim.state))} />);
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

test('F-07: 효력사 — 입력기', () => {
  // The correction form offers 다음: 조정 or 효력사.
  const sim = started();
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
  toAdjust(sim);
  const adjust = renderToStaticMarkup(<Composer stage="adjust" live platoons={[]} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={sim.state} />);
  expect(adjust).toMatch(/<select aria-label="다음">.*<option value="adjust" selected="">조정<\/option><option value="ffe">효력사<\/option><\/select>/);

  // 지명사 효력사 waits for 준비 쏴 too: the button is there at 사격준비 끝.
  const ffe = started();
  openRadio(ffe);
  toReady(ffe, DESC_AMC, CALL_FFE);
  const ready = renderToStaticMarkup(<Composer stage="ready" live platoons={[]} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={ffe.state} />);
  expect(ready).toMatch(/<button[^>]*>준비 쏴/);
  expect(send(ffe, FIRE).ok).toBe(true);
});

// Static render; through the real UI: e2e `F-12: 훈련 모드의 실제 사상 — 화면`.
test('F-12: 훈련 모드의 실제 사상', () => {
  // A 효력사 on one platoon, run until 효과 관측: training shows the real casualties of the unit it hit most.
  const sim = aimedAt(oneUnit({ type: 'inf', route: 'B', t0: 0 }), 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
  for (let k = 0; k < 2000; k++) sim.step([]);
  const p = sim.state.platoons[0]!;
  const dead = p.members.filter((m) => !m.alive).length;
  expect(dead).toBeGreaterThan(0);
  const at = (mode: 'training' | 'standard') =>
    text(renderToStaticMarkup(<Composer stage="effect" live platoons={sim.state.platoons} names={NAMES} grid={GRID} mode={mode} send={() => {}} state={sim.state} />));
  expect(at('training')).toContain(`(훈련) 적 보병 실제 사상 ${dead}/30 (${Math.round((dead / 30) * 100)}%)`);
  expect(at('standard')).not.toContain('실제 사상');
  expect(at('standard')).toContain('효과를 관측하십시오.');
});

test('F-12: 훈련 모드의 실제 사상 — 빗나가도 220 m 안이면 0명으로 보인다', () => {
  /** A one-round 효력사 landing `off` m east of the platoon, run until 효과 관측: the training line, and the impacts'
   * nearest distance to the platoon's centre and its dead. */
  const run = (off: number) => {
    const sim = aimedAt(oneUnit({ type: 'inf', route: 'B', t0: 0 }), 2, 0, CALL_FFE, desc(1, 'quick', 'ready', 0, 'unknown'), { x: off, y: 0 });
    const p = sim.state.platoons[0]!;
    let nearest = Infinity;
    for (let k = 0; k < 2000; k++)
      for (const i of sim.step([]).events.filter(isImpact)) nearest = Math.min(nearest, Math.hypot(i.x - p.x, i.y - p.y));
    const html = renderToStaticMarkup(<Composer stage="effect" live platoons={sim.state.platoons} names={NAMES} grid={GRID} mode="training" send={() => {}} state={sim.state} />);
    return { nearest, dead: p.members.filter((m) => !m.alive).length, line: text(html) };
  };
  const near = run(190);
  expect(near.nearest).toBeLessThanOrEqual(220);
  expect(near.dead).toBe(0);
  expect(near.line).toContain('(훈련) 적 보병 실제 사상 0/30 (0%)');
  // Every round farther than 220 m: the mission struck no unit, so there is nothing to show.
  const far = run(400);
  expect(far.nearest).toBeGreaterThan(220);
  expect(far.line).not.toContain('실제 사상');
});

test('F-07: 임무끝 — 입력기', () => {
  // At the 효과 관측 the composer offers 효과 and 다음 조치, and starts on 임무끝 · 무력화 (demo); what it shows is what
  // the log shows once it is sent.
  const sim = aimedAt(NEAR, 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
  toEffect(sim);
  watch(sim, 0, 3);
  const html = renderToStaticMarkup(<Composer stage="effect" live platoons={sim.state.platoons} names={NAMES} grid={GRID} mode="standard" send={() => {}} state={sim.state} />);
  expect(html).toMatch(/<select aria-label="효과">.*<option value="neutralized" selected="">무력화<\/option>/);
  expect(html).toMatch(/<select aria-label="다음 조치">.*<option value="eom" selected="">임무끝<\/option><option value="repeat">재효력사<\/option><option value="corr">수정 후 효력사<\/option><\/select>/);
  const preview = text(html.match(/<p role="status" aria-live="off" aria-label="보낼 문장">(.*?)<\/p>/)![1]!);
  expect(preview).toBe('임무끝, 적 보병소대 무력화.');
  const r = send(sim, { a: 'eom', v: ['neutralized'] });
  expect(r.ok).toBe(true);
  expect(logged(r.events[0]!)).toBe(preview);
});

// Static render of the training fill; the polar path itself is the e2e `F-07: 극좌표 위치법 — 입력기`.
test('F-05: 훈련 모드는 레이저 측정점의 좌표를 넣어 둔다', () => {
  // At 표적위치 the newest lase that met something fills the grid in training (demo lines 958–966), not in standard.
  const hit: Lase = { tick: 9, az: 8003, el: -20, range: { dist: 1004, vm: -2, x: 805, y: 805, target: true } };
  const miss: Lase = { tick: 10, az: 100, el: 50, range: null };
  const at = (mode: Mode) =>
    renderToStaticMarkup(
      <Composer stage="loc" live platoons={[]} names={NAMES} grid={GRID} mode={mode} send={() => {}} state={{ missions: [], platoons: [], op: { x: 0, y: 0 }, aim: { az: 0, el: 0 }, lases: [miss, hit], ...POST }} />,
    );
  const preview = (html: string) => text(html.match(/<p role="status" aria-live="off" aria-label="보낼 문장">(.*?)<\/p>/)![1]!);
  expect(preview(at('training'))).toBe('좌표 찰리호텔 넷공팔공(4080) 삼공팔공(3080), 이상.'); // training adds the numerals
  expect(preview(at('standard'))).toBe('동·북 네 자리씩');
});
