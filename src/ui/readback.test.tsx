// 실전의 복창 화면 (M3-17, #120 Q1·Q2·Q4·Q7, #121 ⑤): the clock is turned by hand. The box, the log, the forms and the tabs read
// the simulation's read-only state, driven through its public interface.
import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { createSim, type Input, type Mode, type MtoSlots, type RadioEvent, type RadioStage, type Sim } from '@sim';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { combatInit, init, START } from '../../tests/acceptance/init';
import { corr, DESC_AMC, openRadio, radioEvents, send, toReady, untilImpact } from '../../tests/acceptance/mission';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { Composer } from './Composer';
import { LowerTabs, type Tab } from './LowerTabs';
import { RadioLog, type LogLine } from './RadioLog';
import { readbackInput, type Entry } from './readback';
import { ReadbackBox, ReadbackForm } from './ReadbackBox';

const SCENARIO = { ...BASE_SCENARIO, units: [] };
/** A started game with no enemy, radio open, in the given mode. */
function game(mode: Mode): Sim {
  const sim = createSim({ ...(mode === 'combat' ? combatInit(7) : { ...init(7), mode }), scenario: SCENARIO });
  sim.step([START]);
  return sim;
}
const text = (html: string) => html.replace(/<[^>]*>/g, '');
/** The 무전 기록 as the app keeps it: each line with the real time it came in, here at ×1 (50 ms a tick). */
const timed = (events: readonly RadioEvent[]): LogLine[] => events.map((e) => ({ ...e, at: e.tick * 50 }));
/** The log's lines as text at real time `now`. */
const shown = (lines: readonly LogLine[], now: number, mode: Mode = 'combat') =>
  [...renderToStaticMarkup(<RadioLog lines={lines} callsign="갈매기" gridLetters="CH" mode={mode} now={now} />).matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => text(m[1]!));
const at = (lines: readonly LogLine[], speaker: string, kind: string) =>
  lines.findIndex((l) => l.type === 'radio' && l.utterance.speaker === speaker && l.utterance.kind === kind);
const MTO = /^\d\d:\d\d 기러기 사격지휘통보, 포대, /;
const HELD = '복창을 먼저 보내십시오';
const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const composer = (s: Sim, stage: RadioStage) =>
  renderToStaticMarkup(<Composer stage={stage} live platoons={s.state.platoons} names={NAMES} grid={flatTerrain().grid} mode={s.state.mode} send={() => {}} state={s.state} />);
/** Each 송신 button: true when it can be pressed. */
const sendable = (html: string) => [...html.matchAll(/<button type="button"( disabled="")?>송신<\/button>/g)].map((m) => !m[1]);

test('실전: 복창 상자 — 복창할 교신은 4초 보이고 가려지며 맞게 복창하면 무전 기록에 돌아오고, 밀린 복창이 있으면 송신 단추가 눌리지 않는다', () => {
  const sim = game('combat');
  const twin = game('standard');
  const log: LogLine[] = [];
  const std: LogLine[] = [];
  for (const [s, l] of [[sim, log], [twin, std]] as const) l.push(...timed(openRadio(s)), ...timed(toReady(s)));
  // 사격지휘통보: shown for 4 s of real time, then covered; 표준 never covers it.
  const i = at(log, 'fdc', 'mto');
  const came = (log[i] as { at: number }).at;
  expect(shown(log, came + 3999)[i]).toMatch(MTO);
  expect(shown(log, came + 4000)[i]).toBe(`${shown(log, came)[i]!.slice(0, 5)} 기러기 (가려짐)`);
  for (const m of ['standard', 'training'] as const) expect(shown(std, came + 60_000, m)[at(std, 'fdc', 'mto')], m).toMatch(MTO);
  expect(shown(log, came + 4000).filter((x) => x.endsWith('(가려짐)'))).toHaveLength(1); // nothing else is covered

  // The adjusting round: 하나발 떳다 is owed too. The box asks the first that came, and shows how many are owed.
  for (const [s, l] of [[sim, log], [twin, std]] as const) l.push(...timed(untilImpact(s).said), ...timed(radioEvents(s, 30)));
  const box = (s: Sim) => text(renderToStaticMarkup(<ReadbackBox mission={s.state.missions.at(-1)} queued={[]} send={() => {}} />)).replace(/\s+/g, ' ');
  expect(box(sim)).toBe('복창: 사격지휘통보 · 밀린 복창 2사격지휘통보, 포대, 순발신관접근신관, 발, 지명사, 표적번호 알파브라보 , 잠깐대기.복창 송신');
  expect(box(twin)).toBe('');
  // The 입력 tab shows the count while another tab is open; it never switches by itself.
  const tabs = (tab: Tab, owed?: number) => text(renderToStaticMarkup(<LowerTabs tab={tab} onTab={() => {}} owed={owed} />));
  expect(tabs('log', 2)).toBe('입력 2지도표적무전');
  expect(tabs('input', 2)).toBe('입력지도표적무전');
  expect(renderToStaticMarkup(<LowerTabs tab="log" onTab={() => {}} owed={0} />)).toBe(renderToStaticMarkup(<LowerTabs tab="log" onTab={() => {}} />));

  // Owed readbacks hold the mission forms: the hint stands and nothing is sent (here at 수정, before the readbacks).
  expect(text(composer(sim, 'adjust'))).toContain(HELD);
  expect(text(composer(twin, 'adjust'))).not.toContain(HELD);
  const mto = { ...sim.state.missions.at(-1)!.mto! };
  const right: Entry = { fuze: mto.fuze, rounds: String(mto.rounds), amc: mto.control === 'amc', tn: String(mto.targetNumber).padStart(4, '0') };
  // A wrong 사격지휘통보 readback goes out as put in; 복창 송신 cannot be pressed until 기러기's 정정 is in (2.5 s).
  const wrong: Entry = { ...right, rounds: mto.rounds === 1 ? '2' : '1' };
  const form = (e: Entry, sent: MtoSlots | null) =>
    renderToStaticMarkup(<ReadbackForm mission={sim.state.missions.at(-1)} entry={e} sent={sent} queued={[]} onEntry={() => {}} onSend={() => {}} />);
  const RB_SEND = /<button type="button"( disabled="")?>복창 송신<\/button>/;
  expect(form(wrong, null).match(RB_SEND)![1]).toBeUndefined();
  const sentWrong = { ...mto, rounds: Number(wrong.rounds) };
  log.push(...timed(send(sim, readbackInput('mto', wrong)!).events));
  const said = log.length - 1;
  expect(form(wrong, sentWrong).match(RB_SEND)![1]).toBe(' disabled=""');
  expect(text(form(wrong, sentWrong))).not.toContain('틀린 칸');
  log.push(...timed(radioEvents(sim, 50)));
  const c = at(log, 'fdc', 'mto_correction');
  expect(c).toBeGreaterThan(said);
  const fixed = (log[c] as { at: number }).at;
  expect(shown(log, fixed + 3999)[c]).toMatch(/기러기 정정, 사격지휘통보, 포대, /);
  expect(shown(log, fixed + 4000)[c]).toMatch(/기러기 \(가려짐\)$/);
  expect(shown(log, fixed + 4000)[i]).toMatch(/기러기 \(가려짐\)$/);
  expect(shown(log, fixed + 60_000)[said]).toMatch(/갈매기 사격지휘통보, 포대, /); // the player's own readback stays
  // The 정정 is in: the wrong field is named and outlined, what was put in stays, and it can be sent again.
  const after = form(wrong, sentWrong);
  expect(after.match(RB_SEND)![1]).toBeUndefined();
  expect(text(after)).toContain('틀린 칸: 발수');
  expect(after).toContain(`aria-label="발수" inputMode="numeric" maxLength="1" size="1" style="outline:2px solid #e53935" value="${wrong.rounds}"/>`);
  expect(after).toContain(`value="${right.tn}"/>`); // 표적번호: kept, not outlined
  expect(after.match(/outline/g)).toHaveLength(1);
  // The right readback brings both lines back.
  for (const input of [readbackInput('mto', right)!, readbackInput('shot', right)!]) log.push(...timed(send(sim, input).events));
  expect(shown(log, fixed + 60_000)[i]).toMatch(MTO);
  expect(shown(log, fixed + 60_000)[c]).toMatch(/기러기 정정, 사격지휘통보, /);
  expect(shown(log, fixed + 60_000).filter((x) => x.endsWith('(가려짐)'))).toEqual([]);
  expect(box(sim)).toBe('');
  expect(text(composer(sim, 'adjust'))).not.toContain(HELD);
  // 효력사: 하나발 떳다 and 마감탄 떳다 owed; 임무끝 · 재효력사 cannot be sent until both are read back.
  for (const s of [sim, twin]) {
    expect(send(s, corr(4720, 'right', 60, 'drop', 200, 'ffe')).ok).toBe(true);
    for (let k = 0; k < 4000 && s.state.radio.stage !== 'effect'; k++) s.step([]);
    radioEvents(s, 400);
  }
  expect(box(sim)).toBe('복창: 하나발 떳다 · 밀린 복창 2하나발 떳다, 잠깐대기.복창 송신');
  expect(sendable(composer(sim, 'effect'))).toEqual([false]);
  expect(text(composer(sim, 'effect'))).toContain(HELD);
  expect(sendable(composer(twin, 'effect'))).toEqual([true]);
  expect(text(composer(twin, 'effect'))).not.toContain(HELD);
  send(sim, readbackInput('shot', right)!);
  expect(sendable(composer(sim, 'effect'))).toEqual([false]);
  send(sim, readbackInput('rounds_complete', right)!);
  expect(sendable(composer(sim, 'effect'))).toEqual([true]);
  expect(text(composer(sim, 'effect'))).not.toContain(HELD);
  // 지명사: 준비 쏴 waits for the 사격지휘통보 readback.
  const amc = game('combat');
  const amcStd = game('standard');
  for (const s of [amc, amcStd]) {
    openRadio(s);
    toReady(s, DESC_AMC);
  }
  const FIRE_BUTTON = /<button type="button"( disabled="")?>준비 쏴/;
  expect(composer(amc, 'ready').match(FIRE_BUTTON)![1]).toBe(' disabled=""');
  expect(text(composer(amc, 'ready'))).toContain(HELD);
  expect(composer(amcStd, 'ready').match(FIRE_BUTTON)![1]).toBeUndefined();
});

type FormProps = Parameters<typeof ReadbackForm>[0];
/** 복창 송신 pressed: its click handler called as the button would (the tests have no DOM). */
function press(p: FormProps): void {
  const find = (n: unknown): ReactElement | undefined => {
    if (Array.isArray(n)) return n.map(find).find(Boolean);
    if (!isValidElement(n)) return undefined;
    const { children, onClick } = n.props as { children?: unknown; onClick?: () => void };
    return n.type === 'button' && children === '복창 송신' && onClick ? n : find(children);
  };
  (find(ReadbackForm(p))!.props as { onClick: () => void }).onClick();
}

test('실전: 복창 상자 — 틀린 복창은 보낸 때부터 정정이 올 때까지 다시 보낼 수 없고 틀린 칸은 정정이 온 뒤에야 선다', () => {
  const sim = game('combat');
  openRadio(sim);
  toReady(sim);
  // The app's session: an input sent waits for the next tick (50 ms) of the hand-turned clock.
  const queued: Input[] = [];
  const tick = () => sim.step(queued.splice(0));
  const mission = sim.state.missions.at(-1)!;
  const mto = { ...mission.mto! };
  const wrong: Entry = { fuze: mto.fuze, rounds: mto.rounds === 1 ? '2' : '1', amc: mto.control === 'amc', tn: String(mto.targetNumber).padStart(4, '0') };
  let sent: MtoSlots | null = null; // what ReadbackBox keeps once it has sent
  const sends: Input[] = [];
  const props = (): FormProps => ({
    mission, entry: wrong, sent, queued, onEntry: () => {},
    onSend: (input) => {
      sends.push(input);
      queued.push(input);
      sent = { ...mto, rounds: Number(wrong.rounds) };
    },
  });
  /** The box as drawn now: can 복창 송신 be pressed, the 틀린 칸 line, how many fields are outlined. */
  const look = () => {
    const html = renderToStaticMarkup(<ReadbackForm {...props()} />);
    return { sendable: !/<button type="button" disabled="">복창 송신/.test(html), wrong: text(html).match(/틀린 칸: [^<]*?(?=복창 송신)/)?.[0] ?? '', outlined: html.match(/outline/g)?.length ?? 0 };
  };
  const quiet = { sendable: false, wrong: '', outlined: 0 };

  expect(look()).toEqual({ sendable: true, wrong: '', outlined: 0 });
  press(props());
  // Sent, not yet stepped: nothing is judged yet, and it cannot go out twice.
  expect(queued).toHaveLength(1);
  expect(look()).toEqual(quiet);
  press(props());
  expect(sends).toHaveLength(1);
  // The next tick takes it: 기러기's 정정 is on its way (2.5 s); still quiet and still held.
  tick();
  expect(mission.readback!.correcting).toBe(true);
  expect(look()).toEqual(quiet);
  let ticks = 1;
  for (; mission.readback!.correcting; ticks++) {
    expect(look(), `tick ${ticks}`).toEqual(quiet);
    press(props());
    tick();
  }
  expect(ticks).toBe(50); // ticks stepped from the readback's own: 2.5 s
  expect(sends).toHaveLength(1);
  // The 정정 is in: the wrong field is named and outlined, what was put in stays, and it can be sent again.
  expect(look()).toEqual({ sendable: true, wrong: '틀린 칸: 발수', outlined: 1 });
  expect(renderToStaticMarkup(<ReadbackForm {...props()} />)).toContain(`value="${wrong.rounds}"`);
  press(props());
  expect(sends).toHaveLength(2);
  expect(look()).toEqual(quiet); // the second readback waits for its tick in turn
});
