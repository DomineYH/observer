// The real build's screens before the game: the 받는 중 line and the 오류 화면 (one sentence per cause, one button).
import type { TerrainFailure } from '@adapters/index';

export const LOADING_TEXT = '지형 자료를 받는 중…';

// Starting texts (ticket #83); no automatic retry and no way to play on mock.
export const LOAD_ERROR_TEXT: Record<TerrainFailure, string> = {
  fetch: '지형 자료를 받지 못했습니다. 연결을 확인하고 다시 시도하십시오.',
  mismatch: '지형 자료가 이 판과 맞지 않습니다. 다시 시도하십시오.',
  unsupported: '이 브라우저에서는 지형 자료를 풀 수 없습니다.',
};

export function LoadError({ reason, onRetry }: { reason: TerrainFailure; onRetry: () => void }) {
  return (
    <main role="alert">
      <p>{LOAD_ERROR_TEXT[reason]}</p>
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    </main>
  );
}
