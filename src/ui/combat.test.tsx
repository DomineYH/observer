// 실전 화면 (M3-7): the standard screen minus four. Each row of PRD §8's 실전 column, by passing the mode value.
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim, type Input, type Lase, type Mode, type Phase, type RadioEvent, type Sim } from '@sim';
import { terrainColours } from '@render/shade';
import { answered, CALL_ADJUST, CALL_FFE, desc, DESC_UNKNOWN, ended, LOC_NEAR, openRadio, send, started, toAdjust, toReady } from '../../tests/acceptance/mission';
import { angleTo, idAt, mortarAt, oneUnit, run, started as startedWith } from '../../tests/acceptance/enemy';
import { combatInit, START } from '../../tests/acceptance/init';
import { aimedAt, NEAR, toEffect, watch } from '../../tests/acceptance/strike';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { deviation, prefillDirection, suggestion } from './correction';
import { Preview } from './CorrectionForm';
import { HeadBand, nextSpeed, pauseCovers, SPEEDS, type Speed } from './HeadBand';
import { LaseReadout } from './Laser';
import { MapPanel } from './MapPanel';
import { darkInPrep, namesFriends } from './ObservationView';
import { PositionForm } from './PositionForm';
import { reportError } from './post';
import { RadioLog } from './RadioLog';
import { callDraft, descDraft, locDraft, type Draft } from './radio/drafts';
import { TargetList } from './TargetList';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const GRID = flatTerrain().grid;
/** A set-up post 기러기 knows: the composer offers a call at idle. */
const POST = { post: { state: 'ready', move: null, departed: 0, until: 0, moves: 0 }, reportDue: false, tick: 0, knownOp: { x: 0, y: 0 } } as const;
const EMPTY = { missions: [], platoons: [], op: { x: 0, y: 0 }, aim: { az: 0, el: 0 }, ...POST };
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

test('실전: 일시정지 없음 — 작전 중에 일시정지 단추가 눌리지 않고 배속은 넷 그대로', () => {
  const band = (mode: Mode, speed: Speed = 1, phase: Phase = 'live') =>
    renderToStaticMarkup(<HeadBand tick={0} score={0} rounds={0} mode={mode} speed={speed} paused={false} phase={phase} onSpeed={() => {}} onPause={() => {}} />);
  const PAUSE = /<button type="button" aria-pressed="false"( disabled="")?>일시정지<\/button>/;
  // 실전 작전 중: the button is there and cannot be pressed; 훈련·표준 can pause as before; nobody can before 작전 개시.
  expect(band('combat').match(PAUSE)![1]).toBe(' disabled=""');
  for (const m of ['standard', 'training'] as const) expect(band(m).match(PAUSE)![1], m).toBeUndefined();
  for (const m of ['combat', 'standard', 'training'] as const) expect(band(m, 1, 'prep').match(PAUSE)![1], m).toBe(' disabled=""');
  // 배속: the four in a ring, the button pressable in 실전.
  expect(SPEEDS).toEqual([1, 2, 4, 8]);
  expect(SPEEDS.map(nextSpeed)).toEqual([2, 4, 8, 1]);
  for (const s of SPEEDS) expect(band('combat', s)).toContain(`<button type="button" aria-label="배속 ×${s}">×${s}</button>`);
  // Nothing is covered: only 표준's pause hides the view, the map and the 입력기.
  expect(pauseCovers(true, 'combat', 'live')).toBe(false);
  expect(pauseCovers(true, 'standard', 'live')).toBe(true);
  expect(pauseCovers(true, 'training', 'live')).toBe(false);
  expect(pauseCovers(false, 'standard', 'live')).toBe(false);
  expect(band('combat')).toContain('aria-label="모드" class="tag">실전<');
});

test('실전: 레이저 측정점 좌표 자동 계산 — 실전에서도 표준과 같다', () => {
  // The readout: a lase at the crew of a mortar section 700 m north. 실전 shows no grid of the point, as 표준.
  const sim = startedWith(mortarAt({ x: 320, y: 1020 }));
  const man = sim.state.platoons[0]!.members.find((m) => m.kind === 'man' && m.vis)!;
  const at = angleTo(sim, man);
  expect(sim.step([{ a: 'lase', v: [Math.round(at.az), Math.round(at.el)] }]).accepted).toEqual([true]);
  const shown = (mode: Mode) =>
    renderToStaticMarkup(<LaseReadout lases={sim.state.lases} mode={mode} grid={GRID} />)
      .replace(/<\/(li|p)>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();
  expect(shown('combat')).toBe(shown('standard'));
  expect(shown('combat').split('\n')[0]).toMatch(/· 표적 반사$/);
  expect(shown('combat')).not.toContain('CH ');
  expect(shown('training').split('\n')[0]).toMatch(/ · CH \d{4} \d{4}$/);
  // 표적위치: the lase does not fill the grid; the 좌표자 does, or nothing.
  const hit: Lase = { tick: 9, az: 8003, el: -20, range: { dist: 1004, vm: -2, x: 805, y: 805, target: true } };
  const fields = (html: string) => [...html.matchAll(/<input inputMode="numeric" maxLength="4" size="4" value="(\d*)"\/>/g)].map((m) => m[1]);
  expect(fields(composer('combat', 'loc', EMPTY, { lastHit: hit }))).toEqual(['', '']);
  expect(fields(composer('combat', 'loc', EMPTY, { lastHit: hit, pin: { e: 12, n: 3456 } }))).toEqual(['0012', '3456']);
  expect(fields(composer('standard', 'loc', EMPTY, { lastHit: hit }))).toEqual(['', '']);
  expect(fields(composer('training', 'loc', EMPTY, { lastHit: hit }))).toEqual(['4080', '3080']);
});

test('실전: 방향 입력 — 실전에서도 표준과 같다', () => {
  // Aimed at 4720 mils: 훈련 would put it in the 방향 field of the 수정 and the 전이사격 forms.
  const aim = { az: 47204, el: 0 };
  expect(prefillDirection({ mode: 'combat', aim })).toBe('');
  expect(prefillDirection({ mode: 'training', aim })).toBe('4720');
  const direction = (html: string) => [...html.matchAll(/방향 <input[^>]*value="(\d*)"\/> 밀/g)].map((m) => m[1]);
  const adjust = atAdjust();
  const eom = afterEom();
  for (const [stage, sim] of [['adjust', adjust], ['idle', eom]] as const) {
    const at = (mode: Mode) => composer(mode, stage, { ...sim.state, aim });
    expect(direction(at('combat')), stage).toEqual(['']);
    expect(direction(at('training')), stage).toEqual(['4720']);
    expect(forms(at('combat')), stage).toBe(forms(at('standard')));
  }
  // Nothing to send until a 방향 is typed: the 수정, and the 전이사격 beside the call.
  expect(composer('combat', 'adjust', { ...adjust.state, aim })).toMatch(/<button type="button" disabled="">송신/);
  expect([...composer('combat', 'idle', { ...eom.state, aim }).matchAll(/<button type="button"( disabled="")?>송신/g)].map((m) => !m[1])).toEqual([true, false]);
});

test('실전: 탄착 편의와 수정값 제안 — 실전에서도 표준과 같다', () => {
  // The last round 30 m right and 120 m over a platoon 1 km north: 훈련 shows it and fills 좌로 30, 줄이기 100.
  const help = suggestion(deviation({ op: { x: 0, y: 0 }, platoons: [{ x: 0, y: 1000, state: 'approach' }], missions: [{ impacts: [{ x: 500, y: 500 }, { x: 30, y: 1120 }] }] }));
  const sim = atAdjust();
  const at = (mode: Mode) => composer(mode, 'adjust', sim.state, { help });
  const metres = (html: string) => [...html.matchAll(/aria-label="(좌우|사거리) 거리" inputMode="numeric" size="4" value="(\d*)"/g)].map((m) => m[2]);
  expect(at('combat')).not.toContain('탄착 편의');
  expect(metres(at('combat'))).toEqual(['0', '0']);
  expect(forms(at('combat'))).toBe(forms(at('standard')));
  expect(text(at('training'))).toContain('탄착 편의 우 30 m');
  expect(metres(at('training'))).toEqual(['30', '100']);
});

test('실전: 실제 사상자 수 — 실전에서도 표준과 같다', () => {
  // A 효력사 on one platoon, run until 효과 관측: 훈련 shows its real casualties.
  const sim = aimedAt(oneUnit({ type: 'inf', route: 'B', t0: 0 }), 2, 0, CALL_FFE, desc(3, 'quick', 'ready', 0, 'unknown'));
  run(sim, 2000);
  const dead = sim.state.platoons[0]!.members.filter((m) => !m.alive).length;
  expect(dead).toBeGreaterThan(0);
  const at = (mode: Mode) => composer(mode, 'effect', sim.state, { platoons: sim.state.platoons });
  expect(text(at('combat'))).toContain('효과를 관측하십시오.');
  expect(text(at('combat'))).not.toContain('실제 사상');
  expect(forms(at('combat'))).toBe(forms(at('standard')));
  expect(text(at('training'))).toContain(`(훈련) 적 보병 실제 사상 ${dead}/30`);
});

test('실전: 관측소 후보 미리보기·가시권 — 실전에서도 표준과 같다', () => {
  // A combat game in 작전 준비: the view stays dark as in 표준, and the map offers no 가시권.
  const t = flatTerrain();
  const at = combatInit(7, t);
  const sim = createSim(at);
  expect([sim.state.phase, sim.state.mode]).toEqual(['prep', 'combat']);
  expect(darkInPrep(sim.state)).toBe(true);
  expect(darkInPrep({ phase: 'prep', mode: 'standard' })).toBe(true);
  expect(darkInPrep({ phase: 'prep', mode: 'training' })).toBe(false); // 훈련 previews from the 관측소 후보
  const panel = (state: Sim['state']) =>
    renderToStaticMarkup(
      <MapPanel terrain={t} scenario={at.scenario} state={state} send={() => {}} onFrame={() => () => {}} weather={at.weather} colours={terrainColours(t, at.weather)} callsign="갈매기" pin={null} onPin={() => {}} mark={null} onTransfer={() => {}} />,
    );
  expect(panel(sim.state)).not.toContain('가시권');
  expect(panel(sim.state)).toBe(panel({ ...sim.state, mode: 'standard' }));
  expect(panel({ ...sim.state, mode: 'training' })).toContain('가시권 표시');
  sim.step([START]);
  expect(darkInPrep(sim.state)).toBe(false);
  expect(panel(sim.state)).not.toContain('가시권');
});

test('실전: 전투력 — 실전에서도 표준과 같다', () => {
  // A mortar section 1 km north, found and watched until its type is known: 훈련 adds its 전투력.
  const sim = startedWith(mortarAt({ x: 320, y: 1320 }));
  run(sim, 39);
  sim.step([idAt(angleTo(sim, sim.state.platoons[0]!.members[1]!))]);
  sim.step([{ a: 'bino', v: [1] }, { a: 'cam', v: [0, -26] }]);
  run(sim, 110);
  expect(sim.state.platoons[0]!.intel.stage).toBe(2);
  const list = (mode: Mode) => renderToStaticMarkup(<TargetList platoons={sim.state.platoons} mode={mode} op={sim.state.op} />);
  expect(list('combat')).toBe(list('standard'));
  expect(list('combat')).not.toContain('전투력');
  expect(text(list('training'))).toContain('(훈련: 전투력 100%)');
});

test('실전: 훈련 전용 표시 없음 — 기러기가 아는 위치·보고 위치 오차·아군 소대 이름·위치 보고 미리 채움', () => {
  // 기러기가 아는 위치 on the map: in `실전: 지도 — …`, whose combat map is the standard one apart from the four.
  // 보고 위치 오차: 훈련 tells it after every 위치 보고; the warning past 60 m is for every mode.
  expect(reportError({ x: 0, y: 0 }, { x: 40, y: 0 }, 'combat')).toBeNull();
  expect(reportError({ x: 0, y: 0 }, { x: 40, y: 0 }, 'training')).toBe('↳ (훈련) 보고 위치 오차 40 m.');
  expect(reportError({ x: 0, y: 0 }, { x: 100, y: 0 }, 'combat')).toBe(reportError({ x: 0, y: 0 }, { x: 100, y: 0 }, 'standard'));
  expect(reportError({ x: 0, y: 0 }, { x: 100, y: 0 }, 'combat')).toContain('약 100 m 다릅니다');
  // 아군 소대 이름 on the view.
  expect([namesFriends('combat'), namesFriends('standard'), namesFriends('training')]).toEqual([false, false, true]);
  // 위치 보고: not filled in from the post; from the 좌표자 as in 표준.
  const form = (mode: Mode, pin?: { e: number; n: number }) =>
    renderToStaticMarkup(<PositionForm op={{ x: 400, y: 320 }} grid={GRID} names={NAMES} mode={mode} send={() => {}} pin={pin} />);
  expect(form('combat')).not.toContain('value="4040"');
  expect(form('combat', { e: 12, n: 3456 })).toContain('value="0012"');
  expect(form('combat', { e: 12, n: 3456 })).toContain('value="3456"');
  expect(text(form('combat'))).toContain('지도를 눌러 자기 위치를 좌표자로 읽어 넣으십시오');
  expect(forms(form('combat'))).toBe(forms(form('standard')));
  expect(form('training')).toContain('value="4040"');
  expect(form('training')).toContain('value="3032"');
});
