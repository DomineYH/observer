// 입력기 (demo lines 905–1044): the form for the transmission the 교신 단계 takes, and the sentence it will send.
import { useState } from 'react';
import type { Control, Flag, FuzeRequest, Input, Mode, RadioStage, Target, Warning } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { Sentence } from './RadioLog';
import { callDraft, descDraft, locDraft, targetOptions, type Draft } from './radio/drafts';
import type { RadioNames } from './radio/sentence';

const W = RADIO_GRAMMAR.tables;
const FUZE_LABEL: Record<FuzeRequest, string> = { none: '신관 요청 없음', quick: W.fuze.quick.text, vt: W.fuze.vt.text };
const CONTROL_LABEL: Record<Control, string> = { ready: '준비되는 대로', amc: '지명사' };
const ROUNDS = [1, 2, 3, 4, 5];
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];
const GRID_FIELD = /^\d{4}$/;

const targetLabel = (t: Target) =>
  t.targetType === 'unknown'
    ? W.targetType.unknown.text
    : `${W.activity[t.activity].text}인 적 ${W.targetType[t.targetType].text}${t.unit === 'none' ? '' : ` ${'count' in t ? t.count : ''}${W.unit[t.unit].text}`}`;

/** The form's starting values (a sent form keeps its values for the next mission). `target` is an option's JSON. */
export interface ComposerForm {
  warning: Warning;
  grid: { e: string; n: string };
  target: string;
  rounds: number;
  fuzeRequest: FuzeRequest;
  control: Control;
  dangerClose: Flag;
}

interface Props {
  stage: RadioStage;
  live: boolean;
  platoons: Parameters<typeof targetOptions>[0];
  names: RadioNames;
  mode: Mode;
  send: (input: Input) => void;
  initial?: Partial<ComposerForm>;
}

export function Composer({ stage, live, platoons, names, mode, send, initial = {} }: Props) {
  const [warning, setWarning] = useState<Warning>(initial.warning ?? 'adjust');
  const [grid, setGrid] = useState(initial.grid ?? { e: '', n: '' });
  const [target, setTarget] = useState(initial.target ?? '');
  const [rounds, setRounds] = useState(initial.rounds ?? 3);
  const [fuzeRequest, setFuze] = useState<FuzeRequest>(initial.fuzeRequest ?? 'none');
  const [control, setControl] = useState<Control>(initial.control ?? 'ready');
  const [dangerClose, setDangerClose] = useState<Flag>(initial.dangerClose ?? 0);

  const options = targetOptions(platoons);
  const chosen = options.find((t) => JSON.stringify(t) === target) ?? options[0]!;
  let draft: Draft | null = null;
  if (stage === 'idle') draft = callDraft(warning);
  else if (stage === 'loc' && GRID_FIELD.test(grid.e) && GRID_FIELD.test(grid.n)) draft = locDraft(Number(grid.e), Number(grid.n));
  else if (stage === 'desc') draft = descDraft({ rounds, fuzeRequest, control, dangerClose, target: chosen });

  return (
    <section aria-label="입력기">
      {stage === 'off' && live && <p>기러기 통신 점검 대기…</p>}
      {stage === 'wait' && <p>기러기 응답 대기…</p>}
      {stage === 'ready' && <p>사격준비 끝.</p>}
      {stage === 'idle' && (
        <label>
          경고명령{' '}
          <select value={warning} onChange={(e) => setWarning(e.target.value as Warning)}>
            {keys(W.warning).map((w) => (
              <option key={w} value={w}>
                {W.warning[w].text}
              </option>
            ))}
          </select>
        </label>
      )}
      {stage === 'loc' && (
        <>
          표적위치 좌표{' '}
          {(['e', 'n'] as const).map((k) => (
            <label key={k}>
              {k === 'e' ? '동' : '북'}{' '}
              <input inputMode="numeric" maxLength={4} size={4} value={grid[k]} onChange={(ev) => setGrid({ ...grid, [k]: ev.target.value })} />
            </label>
          ))}
        </>
      )}
      {stage === 'desc' && (
        <>
          <label>
            표적성질{' '}
            <select value={JSON.stringify(chosen)} onChange={(e) => setTarget(e.target.value)}>
              {options.map((t) => (
                <option key={JSON.stringify(t)} value={JSON.stringify(t)}>
                  {targetLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            발수{' '}
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {ROUNDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            신관{' '}
            <select value={fuzeRequest} onChange={(e) => setFuze(e.target.value as FuzeRequest)}>
              {keys(FUZE_LABEL).map((f) => (
                <option key={f} value={f}>
                  {FUZE_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label>
            통제{' '}
            <select value={control} onChange={(e) => setControl(e.target.value as Control)}>
              {keys(CONTROL_LABEL).map((c) => (
                <option key={c} value={c}>
                  {CONTROL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={dangerClose === 1} onChange={(e) => setDangerClose(e.target.checked ? 1 : 0)} /> 위험근접
          </label>
        </>
      )}
      {(stage === 'idle' || stage === 'loc' || stage === 'desc') && (
        <>
          <p aria-label="보낼 문장">{draft ? <Sentence utterance={draft.utterance} names={names} mode={mode} /> : '동·북 네 자리씩'}</p>
          <button type="button" disabled={!draft} onClick={() => draft && send(draft.input)}>
            송신
          </button>
        </>
      )}
    </section>
  );
}
