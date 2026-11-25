// 랭킹 창 (demo lines 1496–1530, PRD 10.2): four boards and 내 기록, in the browser's own modal dialog.
// Every stored string goes in as React text, so markup in a callsign shows as characters.
import { useRef, useState } from 'react';
import type { Mode } from '@sim';
import type { Board, RankedMode, RankRow, RecordArchive, StoredRun } from '@adapters/index';
import { GUNS } from '@content/guns';
import { clock } from './clock';

const BOARDS: { board: Board; name: string; value: (r: RankRow['record']) => string }[] = [
  { board: 'total', name: '종합', value: (r) => `${r.score}점` },
  { board: 'time', name: '섬멸 시간', value: (r) => (r.clearTick === null ? '—' : clock(r.clearTick)) },
  { board: 'rounds', name: '사용 탄', value: (r) => `${r.roundsTotal}발` },
  {
    board: 'accuracy',
    name: '정확도',
    value: (r) => `${r.firstErrorAvg} m${r.reportAccuracyPct === null ? '' : ` · 보고 ${r.reportAccuracyPct}%`}`,
  },
];
const error = (m: number | null) => (m === null ? '—' : `${m} m`);
/** What the 모드 cell reads of a 배치: its scenario id, its 전장 and its name. */
type Named = { scenario: { id: string }; terrain: { id: string }; briefing: { name: string } };
/** 내 기록's 모드 cell: the 기록 종류, then only what is not the default (ADR 0021). Ids not in the lists are written as they are. */
function modeOf(r: StoredRun, placements: readonly Named[]): string {
  const { mode, seedKind } = r.record;
  const cell = [mode === 'training' ? '훈련' : seedKind === 'practice' ? '연습' : mode === 'combat' ? '실전' : '표준'];
  if (mode === 'combat' && seedKind === 'practice') cell.push('실전');
  const laid = placements.find((p) => p.scenario.id === r.replay.scenario.id);
  if (!laid) cell.push(r.replay.scenario.id);
  else if (placements.find((p) => p.terrain.id === laid.terrain.id) !== laid) cell.push(laid.briefing.name);
  if (r.replay.guns.id !== GUNS[0]!.profile.id) cell.push(GUNS.find((g) => g.profile.id === r.replay.guns.id)?.name ?? r.replay.guns.id);
  return cell.join(' · ');
}
const resultOf = (r: StoredRun) => (r.record.cleared ? '섬멸' : r.record.observerLost ? '관측반 손실' : '미완');
const MODES: { mode: RankedMode; name: string }[] = [
  { mode: 'standard', name: '표준' },
  { mode: 'combat', name: '실전' },
];
const MINE_SHOWN = 10;
/** A stored UTC ISO time as an ISO string in Korea time (UTC+9, no daylight saving), to be sliced for display. */
const kst = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString();

/** The board the dialog opens on: 실전 when the game is 실전, otherwise 표준. */
export const firstMode = (m: Mode): RankedMode => (m === 'combat' ? 'combat' : 'standard');

interface Props {
  board: Board;
  rows: readonly RankRow[];
  mine: readonly StoredRun[];
  callsign: string;
  onBoard: (b: Board) => void;
  placements: readonly Named[]; // 배치 목록: names the 배치 in 내 기록
  mode: RankedMode;
  onMode: (m: RankedMode) => void;
  scenario: string;
  scenarios: readonly Named[]; // today's 일일 후보 on this 전장: buttons only when there are two or more
  onScenario: (id: string) => void;
}

/** The dialog's content: the chosen board, its tabs and this browser's runs. */
export function Ranking({ board, rows, mine, callsign, onBoard, placements, mode, onMode, scenario, scenarios, onScenario }: Props) {
  const shown = BOARDS.find((b) => b.board === board)!;
  return (
    <>
      <h2 id="ranking-title">랭킹</h2>
      <p>{MODES.find((m) => m.mode === mode)!.name} 모드·일일 시드 기록만 집계 · 호출부호당 최고 기록 1개{mode === 'standard' && ' · 목업 표시는 가상의 예시 데이터입니다.'}</p>
      <div>
        {MODES.map((m) => (
          <button key={m.mode} type="button" aria-pressed={m.mode === mode} onClick={() => onMode(m.mode)}>
            {m.name}
          </button>
        ))}
      </div>
      {scenarios.length > 1 && (
        <div>
          {scenarios.map((p) => (
            <button key={p.scenario.id} type="button" aria-pressed={p.scenario.id === scenario} onClick={() => onScenario(p.scenario.id)}>
              {p.briefing.name}
            </button>
          ))}
        </div>
      )}
      <div>
        {BOARDS.map((b) => (
          <button key={b.board} type="button" aria-pressed={b.board === board} onClick={() => onBoard(b.board)}>
            {b.name}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            {['#', '호출부호', shown.name, '탄', '초탄 오차', '일자'].map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.callsign}-${r.createdAt}`} aria-current={!r.fake && r.callsign === callsign ? 'true' : undefined}>
              <td>{i + 1}</td>
              <td>
                {r.callsign}
                {r.fake && <small> 목업</small>}
              </td>
              <td>{shown.value(r.record)}</td>
              <td>{r.record.roundsTotal}</td>
              <td>{error(r.record.firstErrorAvg)}</td>
              <td>{kst(r.createdAt).slice(5, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>아직 기록이 없습니다</p>}
      {board !== 'total' && <p>섬멸 시간·사용 탄은 모든 전투부대를 격멸·제압하고 관측반이 살아남은 기록만 오릅니다. 정확도 = 사격 임무별 초탄 오차 평균 (작을수록 좋음).</p>}
      <h3>내 기록 (이 브라우저에 저장됨 · 훈련 모드와 연습 시드는 랭킹 제외)</h3>
      <table>
        <thead>
          <tr>
            {['일시', '호출부호', '모드', '결과', '시간', '탄', '초탄 오차', '점수'].map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {mine.slice(0, MINE_SHOWN).map((r) => (
            <tr key={r.createdAt}>
              <td>{kst(r.createdAt).slice(5, 16).replace('T', ' ')}</td>
              <td>{r.callsign}</td>
              <td>{modeOf(r, placements)}</td>
              <td>{resultOf(r)}</td>
              <td>{r.record.clearTick === null ? '—' : clock(r.record.clearTick)}</td>
              <td>{r.record.roundsTotal}</td>
              <td>{r.record.firstErrorAvg ?? '—'}</td>
              <td>{r.record.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** The 랭킹 button and its modal dialog; boards load from 기록 보관소 each time one is shown. It opens on the game's mode
 * (`firstMode`), today's 일일 시나리오 and 종합. */
export function RankingDialog(props: {
  archive: RecordArchive;
  callsign: string;
  mode: Mode; // the game's
  today: string; // today's 일일 시나리오 id
  scenarios: readonly Named[]; // today's 일일 후보
  placements: readonly Named[];
}) {
  const { archive, callsign } = props;
  type Pick = { mode: RankedMode; scenario: string; board: Board };
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<(Pick & { rows: RankRow[]; mine: StoredRun[] }) | null>(null);
  const load = async (p: Pick) => setShown({ ...p, rows: await archive.board(p.mode, p.scenario, p.board), mine: await archive.mine() });
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          await load({ mode: firstMode(props.mode), scenario: props.today, board: 'total' });
          dialog.current?.showModal();
        }}
      >
        랭킹
      </button>
      <dialog ref={dialog} aria-labelledby="ranking-title">
        {shown && (
          <Ranking
            {...shown}
            callsign={callsign}
            placements={props.placements}
            scenarios={props.scenarios}
            onBoard={(board) => void load({ ...shown, board })}
            onMode={(mode) => void load({ ...shown, mode })}
            onScenario={(scenario) => void load({ ...shown, scenario })}
          />
        )}
        <form method="dialog">
          <button>닫기</button>
        </form>
      </dialog>
    </>
  );
}
