// What the 입력기 offers at this moment (the simulation's rules): read by its forms, and by 눌러서 말하기 for where a
// spoken 교신 한 마디 goes (#180 Q2, Q7). Pure.
import type { RadioStage, ReadonlySimState, Target } from '@sim';
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

/** The 표적성질 choices the forms were built with: the 표적성질 form's, and the 전이사격 form's (drafts.ts). */
export interface TargetLists {
  desc: readonly Target[];
  shift: readonly Target[];
}

/** The forms a 교신 한 마디 said now can go to. None when there is nothing to send: 눌러서 말하기 cannot be pressed.
 * A form that is open but held (an owed readback, the post walking) is still filled: its 송신 is what is held. */
export function openForms(stage: RadioStage, state: State, lists: TargetLists): OpenForm[] {
  const o = offered(stage, state);
  const mission = state.missions.at(-1);
  const needsDirection = mission?.direction === null;
  if (o.reporting) return [{ form: 'pos' }];
  if (o.callable) return [{ form: 'call' }, ...(mission?.mto ? [{ form: 'shift' as const, options: lists.shift }] : [])];
  if (stage === 'loc') return [{ form: 'loc' }];
  if (stage === 'desc') return [{ form: 'desc', options: lists.desc }];
  if (o.amc && !o.held) return [{ form: 'fire' }];
  if (stage === 'adjust' && mission) return [{ form: 'corr', needsDirection }];
  if (stage === 'effect' && mission) return [{ form: 'eom' }, { form: 'repeat' }, { form: 'corr', needsDirection, after: true }];
  return [];
}
