// 랭킹 창 (demo lines 1496–1530, PRD 10.2): four boards and 내 기록, in the browser's own modal dialog.
// Every stored string goes in as React text, so markup in a callsign shows as characters.
import { useRef, useState } from 'react';
import type { Board, RankRow, RecordArchive, StoredRun } from '@adapters/index';
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
const modeOf = (r: StoredRun) => (r.record.mode === 'training' ? '훈련' : r.record.seedKind === 'practice' ? '연습' : '표준');
const resultOf = (r: StoredRun) => (r.record.cleared ? '섬멸' : r.record.observerLost ? '관측반 손실' : '미완');
const MINE_SHOWN = 10;

interface Props {
  board: Board;
  rows: readonly RankRow[];
  mine: readonly StoredRun[];
  callsign: string;
  onBoard: (b: Board) => void;
}

/** The dialog's content: the chosen board, its tabs and this browser's runs. */
export function Ranking({ board, rows, mine, callsign, onBoard }: Props) {
  const shown = BOARDS.find((b) => b.board === board)!;
  return (
    <>
      <h2 id="ranking-title">랭킹</h2>
      <p>표준 모드·일일 시드 기록만 집계 · 호출부호당 최고 기록 1개 · 목업 표시는 가상의 예시 데이터입니다.</p>
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
              <td>{r.createdAt.slice(5, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
              <td>{r.createdAt.slice(5, 16).replace('T', ' ')}</td>
              <td>{r.callsign}</td>
              <td>{modeOf(r)}</td>
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

/** The 랭킹 button and its modal dialog; boards load from 기록 보관소 each time one is shown. */
export function RankingDialog({ archive, callsign }: { archive: RecordArchive; callsign: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<{ board: Board; rows: RankRow[]; mine: StoredRun[] } | null>(null);
  const load = async (board: Board) => setShown({ board, rows: await archive.board(board), mine: await archive.mine() });
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          await load('total');
          dialog.current?.showModal();
        }}
      >
        랭킹
      </button>
      <dialog ref={dialog} aria-labelledby="ranking-title">
        {shown && <Ranking {...shown} callsign={callsign} onBoard={(b) => void load(b)} />}
        <form method="dialog">
          <button>닫기</button>
        </form>
      </dialog>
    </>
  );
}
