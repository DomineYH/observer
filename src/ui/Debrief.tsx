// 사후강평 (demo lines 1354–1366, 1531–1550): drawn once the game has ended, from its state and its 판 기록.
import type { GameRecord, GridRef, ReadonlySimState } from '@sim';
import { BRIEFING } from '@content/scenario';
import { gridOf } from '@render/mapView';
import { clock } from './clock';
import { missionRow, unitName, unitRow } from './debrief';
import { gridLabel } from './radio/readings';

const UNIT_HEAD = ['적 부대', '적정', '사상', '결과'];
const MISSION_HEAD = ['표적번호', '경고명령', '수정', '탄', '초탄 오차', '방향 오차', '협차', '보고', '실제', ''];
const MEN = 24; // per position

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table>
      <thead>
        <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function Debrief({ state: s, record: r, grid }: { state: ReadonlySimState; record: GameRecord; grid: GridRef }) {
  const fired = s.missions.filter((m) => m.impacts.length + m.flights.length > 0);
  const where = s.platoons
    .map((p, pid) => `${unitName(s.platoons, pid)} ${p.route ? BRIEFING.routes[p.route] : gridLabel(grid.letters, gridOf(grid, p))}`)
    .join(' · ');
  const positions = s.shelledUntil.map((_, pos) => `아군 ${pos + 1}소대 ${s.friendlies.filter((q) => q.pos === pos && q.alive).length}/${MEN}`);
  const avg = (x: number | null, unit: string) => (x === null ? '—' : `${x}${unit}`);
  const metrics: [string, string][] = [
    ['적 섬멸 시간', r.clearTick === null ? '미섬멸' : clock(r.clearTick)],
    ['사용 포탄', `${r.roundsTotal}발`],
    ['초탄 오차 평균', avg(r.firstErrorAvg, ' m')],
    ['방향 오차 평균', avg(r.directionErrorAvg, ' 밀')],
    ['아군 손실', `${r.friendlyLosses}명`],
    ['조기 격퇴', `${r.earlyDefeats}개 소대`],
    ['전과 보고 정확도', avg(r.reportAccuracyPct, '%')],
    ['부대당 탄', avg(r.roundsPerUnit, '')],
    ['격멸·제압', `${r.neutralized}/${r.combatUnits}`],
  ];
  return (
    <section aria-label="사후강평">
      <h2>사후강평</h2>
      {r.observerLost && <p>관측반 전투 불능으로 임무 종료.</p>}
      <p>
        경과 {clock(r.ticks)} · 사용 탄 {r.roundsTotal}발 · 점수 {r.score} · 시드 {r.seedKind === 'daily' ? '일일' : '연습'} {r.seed}
      </p>
      <h3>적 부대</h3>
      <Table head={UNIT_HEAD} rows={s.platoons.map((_, pid) => unitRow(s.platoons, pid))} />
      <p>실제 배치: {where}</p>
      <h3>사격 임무</h3>
      {fired.length ? <Table head={MISSION_HEAD} rows={fired.map(missionRow)} /> : <p>사격 임무 없음</p>}
      <p>
        {positions.length ? `${positions.join(' · ')} (손실 ${r.friendlyLosses}명)` : '아군 진지 없음'} · 관측소 이동 {r.postMoves}회 · 위험근접 미선언{' '}
        {r.dangerCloseMissed}회 · 아군 근접 탄착 {r.friendlyHits}회
      </p>
      <h3>기록</h3>
      <Table head={['항목', '값']} rows={metrics} />
    </section>
  );
}
