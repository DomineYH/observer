// 실전 화면 (M3-7): the standard screen minus four. Each row of PRD §8's 실전 column, by passing the mode value.
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Input, Mode, RadioEvent, Sim } from '@sim';
import { answered, CALL_ADJUST, CALL_FFE, desc, DESC_UNKNOWN, ended, LOC_NEAR, openRadio, send, started, toAdjust, toReady } from '../../tests/acceptance/mission';
import { aimedAt, NEAR, toEffect, watch } from '../../tests/acceptance/strike';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { Preview } from './CorrectionForm';
import { PositionForm } from './PositionForm';
import { RadioLog } from './RadioLog';
import { callDraft, descDraft, locDraft, type Draft } from './radio/drafts';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const GRID = flatTerrain().grid;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
type Stage = Parameters<typeof Composer>[0]['stage'];
type State = Parameters<typeof Composer>[0]['state'];
const composer = (mode: Mode, stage: Stage, state: State, extra: Partial<Parameters<typeof Composer>[0]> = {}) =>
  renderToStaticMarkup(<Composer stage={stage} live platoons={[]} names={NAMES} grid={GRID} mode={mode} send={() => {}} state={state} {...extra} />);
const PREVIEW = /<p role="status" aria-live="off" aria-label="보낼 문장">(.*?)<\/p>/g; // 훈련·표준
const HINT = /<p role="status" aria-live="off">(.*?)<\/p>/g; // 실전
/** The form without its preview or hint. */
const forms = (html: string) => html.replace(PREVIEW, '').replace(HINT, '');

/** A started game, radio open, at the 수정 stage of an adjust mission. */
function atAdjust(): Sim {
  const sim = started();
  openRadio(sim);
  toReady(sim, DESC_UNKNOWN, CALL_ADJUST);
  toAdjust(sim);
  return sim;
}
/** A started game back at idle after a mission's 임무끝: the call form and the 전이사격 form. */
function afterEom(): Sim {
  const sim = started();
  openRadio(sim);
  ended(sim);
  for (let k = 0; k < 400 && sim.state.radio.stage !== 'idle'; k++) sim.step([]);
  expect(sim.state.radio.stage).toBe('idle');
  return sim;
}

test('실전: 교신 문장 미리보기 없음 — 양식은 표준과 같고 보낼 문장이 없다', () => {
  /** Each 송신 button: true when it can send. */
  const buttons = (html: string) => [...html.matchAll(/<button type="button"( disabled="")?>송신<\/button>/g)].map((m) => !m[1]);
  /** The previews that are hints (plain text, nothing to send), not sentences. */
  const hints = (html: string) => [...html.matchAll(PREVIEW)].map((m) => m[1]!).filter((x) => x && !x.includes('<'));

  const idle = started();
  openRadio(idle);
  const loc = started();
  openRadio(loc);
  send(loc, CALL_ADJUST);
  answered(loc, 'call');
  const dsc = started();
  openRadio(dsc);
  send(dsc, CALL_ADJUST);
  answered(dsc, 'call');
  send(dsc, LOC_NEAR);
  answered(dsc, 'loc');
  const effect = aimedAt(NEAR, 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
  toEffect(effect);
  watch(effect, 0, 3);
  const adjust = atAdjust();
  const eom = afterEom();
  const cases: [string, (mode: Mode) => string][] = [
    ['호출', (m) => composer(m, 'idle', idle.state)],
    ['표적위치', (m) => composer(m, 'loc', loc.state)],
    ['표적위치 · 좌표자', (m) => composer(m, 'loc', loc.state, { pin: { e: 4050, n: 3050 } })],
    ['표적성질', (m) => composer(m, 'desc', dsc.state)],
    ['수정', (m) => composer(m, 'adjust', adjust.state)],
    ['효과 관측', (m) => composer(m, 'effect', effect.state, { platoons: effect.state.platoons })],
    ['호출 · 전이사격', (m) => composer(m, 'idle', eom.state)],
    ['위치 보고', (m) => renderToStaticMarkup(<PositionForm op={{ x: 400, y: 320 }} grid={GRID} names={NAMES} mode={m} send={() => {}} />)],
  ];
  for (const [name, at] of cases) {
    const [standard, combat] = [at('standard'), at('combat')];
    expect(combat, name).not.toContain('보낼 문장');
    expect(forms(combat), name).toBe(forms(standard)); // every choice, field, value and button, in order
    expect(buttons(combat), name).toEqual(buttons(standard));
    expect(buttons(combat).length, name).toBeGreaterThan(0);
    expect([...combat.matchAll(HINT)].map((m) => m[1]), name).toEqual(hints(standard)); // the hint stays, the sentence goes
  }
  expect(hints(cases[1]![1]('standard'))).toEqual(['동·북 네 자리씩']); // the cases do hold hints

  /** What pressing 송신 under `draft` sends. */
  const press = (mode: Mode, draft: Draft) => {
    const sent: Input[] = [];
    const el = Preview({ draft, empty: '', names: NAMES, mode, send: (i) => void sent.push(i) }) as ReactElement<{ children: ReactNode }>;
    const button = Children.toArray(el.props.children).find((c) => isValidElement(c) && c.type === 'button') as ReactElement<{ onClick: () => void }>;
    button.props.onClick();
    return sent;
  };
  const log = (mode: Mode, e: RadioEvent) => renderToStaticMarkup(<RadioLog lines={[e]} callsign="갈매기" gridLetters="CH" mode={mode} />);
  const sim = started();
  openRadio(sim);
  const steps = [
    [callDraft('adjust'), 'call'],
    [locDraft(4050, 3050), 'loc'],
    [descDraft({ rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0, target: { targetType: 'unknown' } }), 'desc'],
  ] as const;
  for (const [draft, a] of steps) {
    const input = press('combat', draft);
    expect(input).toEqual(press('standard', draft));
    expect(input).toEqual([draft.input]);
    const r = send(sim, input[0]!);
    expect(r.ok, a).toBe(true);
    const said = r.events.find((e) => e.utterance.speaker === 'observer')!;
    expect(said.utterance).toEqual(draft.utterance);
    // The radio log line: the standard one, without 숫자 병기.
    expect(log('combat', said)).toBe(log('standard', said));
    expect(log('combat', said)).not.toMatch(/opacity|\(\d+\)/);
    if (a === 'loc') expect(text(log('training', said))).toContain('(4050)');
    answered(sim, a);
  }
});
