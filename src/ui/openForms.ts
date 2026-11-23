// What the 입력기 offers at this moment (the simulation's rules): read by its forms, and by 눌러서 말하기 for where a
// spoken 교신 한 마디 goes (#180 Q2, Q7). Pure.
import type { RadioStage, ReadonlySimState } from '@sim';
import { reportOpen } from './post';
import type { OpenForm } from './radio/matching';
import { owedOf } from './readback';

type State = Pick<ReadonlySimState, 'missions' | 'post' | 'reportDue'>;

export function offered(stage: RadioStage, state: State) {
  const mission = state.missions.at(-1);
  const ready = state.post.state === 'ready';
  return {
    ready,
    // At idle: the walk or the setup first, then the 위치 보고 (or its skip), then a call or a 전이.
    reporting: reportOpen(stage, state),
    callable: stage === 'idle' && ready && !state.reportDue,
    // 지명사: 기러기 waits for 준비 쏴, for the adjusting round and for 효력사 alike.
    amc: stage === 'ready' && mission?.mto?.control === 'amc',
    // 실전: an owed readback holds 준비 쏴 · 수정 · 재효력사 · 임무끝; the screen sends none of them (#121 screen rule 1).
    held: owedOf(mission?.readback ?? null).length > 0,
  };
}

/** The forms a 교신 한 마디 said now can go to. None when there is nothing to send: 눌러서 말하기 cannot be pressed. */
export function openForms(stage: RadioStage, state: State): OpenForm[] {
  const o = offered(stage, state);
  if (o.reporting) return [{ form: 'pos' }];
  if (o.callable) return [{ form: 'call' }];
  if (stage === 'loc') return [{ form: 'loc' }];
  if (o.amc && !o.held) return [{ form: 'fire' }];
  return [];
}
