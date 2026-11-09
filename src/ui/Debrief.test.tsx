import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { expect, test } from 'vitest';
import { replay, validateReplay, type ReplayData, type Sim } from '@sim';
import type { StoredRun } from '@adapters/index';
import { replayOf, submissionOf } from '@app/records';
import { INF_RECON, FFE5, playOut } from '../../tests/acceptance/end';
import { CALL_ADJUST, corr, EOM, started, untilTaken } from '../../tests/acceptance/mission';
import { aimedAt, untilLanded } from '../../tests/acceptance/strike';
import { NO_ENEMY, oneMission } from '../../tests/acceptance/session';
import { init } from '../../tests/acceptance/init';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { clock } from './clock';
import { Debrief } from './Debrief';
import { bracket } from './debrief';
import { HeadBand } from './HeadBand';

/** The markup as text: a line per row or heading, cells split by ' | '. */
const text = (el: ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<\/t[dh]>/g, ' | ')
    .replace(/<\/(tr|h2|h3|p|div)>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x27;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
/** The debrief as the app draws it: no saved run yet, the 재생 자료 of a game played without the session. */
const view = (sim: Sim, saved: StoredRun | 'pending' | 'failed' = 'pending', data: ReplayData = replayOf(init(0), [], sim.state.tick)) => (
  <Debrief state={sim.state} record={sim.record()} grid={flatTerrain().grid} callsign="참새12" saved={saved} replay={data} />
);
const debrief = (sim: Sim) => text(view(sim));
const ENTITIES: Record<string, string> = { '&quot;': '"', '&#x27;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const mils = (p: { x: number; y: number }) => (Math.round((Math.atan2(p.x - 320, p.y - 320) * 3200) / Math.PI) + 6400) % 6400;

test('F-13: 사후강평 화면', () => {
  // INF_RECON's platoon: one adjusting round 100 m off, 좌로 100 with 방향 and 효력사, reported as it is; the game ends.
  const sim = aimedAt(INF_RECON, 2, 0, CALL_ADJUST, FFE5, { x: 100, y: 0 });
  untilLanded(sim);
  untilTaken(sim, corr(mils(sim.state.platoons[0]!), 'left', 100, 'add', 0, 'ffe'));
  untilTaken(sim, EOM('neutralized'), 3000); // at the 효과 관측's first tick: the game ends 8 s after it opens
  playOut(sim);
  const p = sim.state.platoons[0]!;
  const cas = Math.round((100 * p.members.filter((m) => !m.alive).length) / p.members.length);
  expect(sim.state.phase).toBe('ended');
  expect(p.state).toBe('broken'); // seed 2: 30–60 % down
  const m = sim.state.missions[0]!;
  const r = sim.record();
  const lines = debrief(sim);
  expect(lines[0]).toBe('사후강평');
  expect(lines).toContain(`경과 ${clock(sim.state.tick)} · 사용 탄 ${r.roundsTotal}발 · 점수 ${sim.state.score} · 시드 일일 2`);
  // 적 부대: what was found of each, its losses and its fate; and where the enemy really came.
  expect(lines).toContain('적 부대 | 적정 | 사상 | 결과 |');
  expect(lines).toContain(`적 1소대 | 미탐지 | ${cas}% | 무력화 · 조기 |`);
  expect(lines).toContain('적 정찰조 | 미탐지 | 0% | 공격 계속 |');
  expect(lines).toContain('실제 배치: 적 1소대 중앙 접근로 · 적 정찰조 서측 접근로');
  // 사격 임무: one row a mission that fired.
  expect(lines).toContain('표적번호 | 경고명령 | 수정 | 탄 | 초탄 오차 | 방향 오차 | 협차 | 보고 | 실제 |  |');
  expect(lines).toContain(`AB1001 | 조정 | 1 | ${r.roundsTotal} | ${m.firstError} m | ${m.directionError} 밀 | — | 무력화 | 무력화 (${cas}%) | 일치 |`);
  expect(lines).toContain('아군 진지 없음 · 관측소 이동 0회 · 위험근접 미선언 0회 · 아군 근접 탄착 0회');
  // 기록
  expect(lines).toContain(`적 섬멸 시간 | ${clock(r.clearTick!)} |`);
  expect(lines).toContain(`사용 포탄 | ${r.roundsTotal}발 |`);
  expect(lines).toContain(`초탄 오차 평균 | ${m.firstError} m |`);
  expect(lines).toContain(`방향 오차 평균 | ${m.directionError} 밀 |`);
  expect(lines).toContain('아군 손실 | 0명 |');
  expect(lines).toContain('조기 격퇴 | 1개 소대 |');
  expect(lines).toContain('전과 보고 정확도 | 100% |');
  expect(lines).toContain(`부대당 탄 | ${r.roundsTotal} |`);
  expect(lines).toContain('격멸·제압 | 1/1 |');
  expect(lines.join('\n')).not.toContain('관측반 전투 불능');
});

test('F-13: 사후강평 화면 — 사격 없이 시간 한도까지', () => {
  // The base scenario's positions with no enemy: the game runs to the 40분 한도 and nobody fires.
  const sim = started();
  while (sim.state.phase === 'live') sim.step([]);
  const lines = debrief(sim);
  expect(lines).toContain(`경과 40:00 · 사용 탄 0발 · 점수 ${sim.state.score} · 시드 일일 7`);
  expect(lines).toContain('사격 임무 없음');
  expect(lines).toContain('아군 1소대 24/24 · 아군 2소대 24/24 · 아군 3소대 24/24 (손실 0명) · 관측소 이동 0회 · 위험근접 미선언 0회 · 아군 근접 탄착 0회');
  expect(lines).toContain('적 섬멸 시간 | 미섬멸 |');
  expect(lines).toContain('초탄 오차 평균 | — |');
  expect(lines).toContain('전과 보고 정확도 | — |');
  expect(lines).toContain('부대당 탄 | — |');
  expect(lines).toContain('격멸·제압 | 0/0 |');
}, 30000);

test('F-13: 머리띠의 경과·점수·사용 탄', () => {
  const band = (sim: Sim) =>
    text(
      <HeadBand tick={sim.state.tick} score={sim.state.score} rounds={sim.record().roundsTotal} mode="standard" speed={1} paused={false} phase={sim.state.phase} onSpeed={() => {}} onPause={() => {}} />,
    );
  const sim = aimedAt(INF_RECON, 2, 0, CALL_ADJUST, FFE5, { x: 100, y: 0 });
  expect(band(sim)).toEqual([`OBSERVER 포병 관측·목업경과 ${clock(sim.state.tick)}점수 0사용 탄 0발일시정지표준×1메뉴`]);
  untilLanded(sim);
  expect(band(sim)).toEqual([`OBSERVER 포병 관측·목업경과 ${clock(sim.state.tick)}점수 ${sim.state.score}사용 탄 1발일시정지표준×1메뉴`]);
});

test('F-13: 사후강평 화면 — 협차 준수', () => {
  // Each 사거리 수정 at most half the one before (+1 m): the bracket was kept (demo brk).
  expect(bracket([400, 200, 100, 50])).toBe('400→200→100→50 ✓');
  expect(bracket([400, 201])).toBe('400→201 ✓');
  expect(bracket([400, 202])).toBe('400→202 ✗');
  expect(bracket([200, 100, 100])).toBe('200→100→100 ✗');
  expect(bracket([200])).toBe('200');
  expect(bracket([])).toBe('—');
});

test('F-31: 미리보기는 재생 자료 형식 그대로', () => {
  // A game through the session to the 40분 한도, with one mission and the ignored presses on the way.
  const at = { ...init(20261106), scenario: NO_ENEMY };
  const g = oneMission(at);
  while (g.sim.state.phase === 'live') g.step();
  const data = replayOf(at, g.session.log, g.sim.state.tick);
  const html = renderToStaticMarkup(view(g.sim, 'pending', data));
  expect(html).toMatch(/<details><summary>전송 데이터 미리보기<\/summary><pre role="group" aria-label="전송 데이터">/);
  const shown = html.match(/<pre role="group" aria-label="전송 데이터">([^<]*)<\/pre>/)![1]!.replace(/&(quot|#x27|lt|gt|amp);/g, (e) => ENTITIES[e]!);
  const parsed: unknown = JSON.parse(shown);
  const checked = validateReplay(parsed);
  expect(checked.ok).toBe(true);
  expect(parsed).toEqual(data); // the replay data itself, no wrapper
  const again = replay(checked.ok ? checked.data : data, at.terrain, at.scenario);
  expect(again.ignored).toBe(0);
  expect(again.record).toEqual(g.sim.record());
  expect(again.record.missions).toBe(1);
}, 30000);

test('F-30: 랭킹 자격 — 사후강평의 저장 알림', () => {
  const g = oneMission();
  const stored = (over: Partial<StoredRun['record']>, ranked: boolean): StoredRun => {
    const s = submissionOf('참새12', g.sim, { ...init(20261106), scenario: NO_ENEMY }, g.session.log);
    return { ...s, record: { ...s.record, ...over }, createdAt: '2026-11-07T00:00:00.000Z', ranked };
  };
  const said = (saved: StoredRun | 'pending' | 'failed') => text(view(g.sim, saved));
  expect(said('pending')).toContain('기록 — 참새12');
  expect(said('pending')).toContain('저장 중…');
  expect(said(stored({}, true))).toContain('저장했습니다 · 표준 모드 · 일일 시드: 랭킹 집계');
  expect(said(stored({ mode: 'training' }, false))).toContain('저장했습니다 · 훈련 모드를 썼으므로 랭킹에서는 제외');
  expect(said(stored({ seedKind: 'practice' }, false))).toContain('저장했습니다 · 연습 시드: 랭킹에서는 제외');
  expect(said('failed')).toContain('이 브라우저에 기록을 저장하지 못했습니다.');
});
