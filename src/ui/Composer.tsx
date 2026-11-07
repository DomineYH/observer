// 입력기 (demo lines 905–1044): the form for the transmission the 교신 단계 takes, and the sentence it will send.
import { useEffect, useState } from 'react';
import type { Control, Flag, FuzeRequest, Input, Mode, RadioStage, ReadonlySimState, Target, Warning } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { Sentence } from './RadioLog';
import { callDraft, descDraft, FIRE, fireKey, locDraft, targetOptions, type Draft } from './radio/drafts';
import type { RadioNames } from './radio/sentence';
import { corrDraft, deviation, prefillDirection, suggestion, type CorrForm } from './correction';
import { casualtyNote } from './effect';

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
  /** The simulation's state, read for the current mission (and in training for the correction help). */
  state: Pick<ReadonlySimState, 'missions' | 'op' | 'aim' | 'platoons'>;
  initial?: Partial<ComposerForm>;
}

export function Composer({ stage, live, platoons, names, mode, send, state, initial = {} }: Props) {
  const [warning, setWarning] = useState<Warning>(initial.warning ?? 'adjust');
  const [grid, setGrid] = useState(initial.grid ?? { e: '', n: '' });
  const [target, setTarget] = useState(initial.target ?? '');
  const [rounds, setRounds] = useState(initial.rounds ?? 3);
  const [fuzeRequest, setFuze] = useState<FuzeRequest>(initial.fuzeRequest ?? 'none');
  const [control, setControl] = useState<Control>(initial.control ?? 'ready');
  const [dangerClose, setDangerClose] = useState<Flag>(initial.dangerClose ?? 0);

  const mission = state.missions.at(-1);
  // 지명사: 기러기 waits for 준비 쏴, for the adjusting round and for 효력사 alike (the simulation's own rule).
  const amc = stage === 'ready' && mission?.mto?.control === 'amc';
  useEffect(() => {
    if (!amc) return;
    const down = (e: KeyboardEvent) => {
      const input = fireKey(e.key);
      if (input && !e.repeat) send(input);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [amc, send]);

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
      {stage === 'ready' && !amc && <p>사격준비 끝.</p>}
      {amc && (
        <button type="button" onClick={() => send(FIRE)}>
          준비 쏴 <kbd>F</kbd>
        </button>
      )}
      {stage === 'flight' && <p>탄착을 관측하십시오.</p>}
      {stage === 'effect' && <p>효과를 관측하십시오.</p>}
      {stage === 'effect' && mode === 'training' && casualtyNote(state) && <p>{casualtyNote(state)}</p>}
      {stage === 'adjust' && mission && (
        <CorrectionForm
          sent={mission.direction}
          help={mode === 'training' ? suggestion(deviation(state)) : null}
          prefill={prefillDirection({ mode, aim: state.aim })}
          names={names}
          mode={mode}
          send={send}
        />
      )}
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
        <Preview draft={draft} empty="동·북 네 자리씩" names={names} mode={mode} send={send} />
      )}
    </section>
  );
}

interface PreviewProps {
  draft: Draft | null;
  empty: string; // shown while there is nothing to send
  names: RadioNames;
  mode: Mode;
  send: (input: Input) => void;
}

function Preview({ draft, empty, names, mode, send }: PreviewProps) {
  return (
    <>
      <p aria-label="보낼 문장">{draft ? <Sentence utterance={draft.utterance} names={names} mode={mode} /> : empty}</p>
      <button type="button" disabled={!draft} onClick={() => draft && send(draft.input)}>
        송신
      </button>
    </>
  );
}

const LATERAL_LABEL = { left: W.lateralDir.left.text, right: W.lateralDir.right.text };
const RANGE_LABEL = { drop: W.rangeDir.drop.text, add: W.rangeDir.add.text };
const NEXT_LABEL = { adjust: W.warning.adjust.text, ffe: W.warning.ffe.text }; // 조정 · 효력사

interface CorrectionProps extends Omit<PreviewProps, 'draft' | 'empty'> {
  sent: number | null; // the mission's 방향, once sent with the first correction
  help: ReturnType<typeof suggestion> | null; // training only
  prefill: string;
}

/** 수정: mounted when the stage opens, so each correction starts from the 방향 and the suggestion of that moment. */
function CorrectionForm({ sent, help, prefill, names, mode, send }: CorrectionProps) {
  const [form, setForm] = useState<CorrForm>(() => ({
    direction: prefill,
    next: 'adjust',
    ...(help?.form ?? { lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0' }),
  }));
  const set = (patch: Partial<CorrForm>) => setForm({ ...form, ...patch });
  const draft = corrDraft(form, { direction: sent });
  return (
    <>
      {help && <p aria-label="탄착 편의">{help.text}</p>}
      {sent === null ? (
        <label>
          방향 <input inputMode="numeric" maxLength={4} size={4} value={form.direction} onChange={(e) => set({ direction: e.target.value })} /> 밀
        </label>
      ) : (
        <p>방향 {String(sent).padStart(4, '0')} 밀 (송신함)</p>
      )}
      <select aria-label="좌우" value={form.lateralDir} onChange={(e) => set({ lateralDir: e.target.value as CorrForm['lateralDir'] })}>
        {keys(LATERAL_LABEL).map((k) => (
          <option key={k} value={k}>
            {LATERAL_LABEL[k]}
          </option>
        ))}
      </select>
      <input aria-label="좌우 거리" inputMode="numeric" size={4} value={form.lateral} onChange={(e) => set({ lateral: e.target.value })} /> m{' '}
      <select aria-label="사거리" value={form.rangeDir} onChange={(e) => set({ rangeDir: e.target.value as CorrForm['rangeDir'] })}>
        {keys(RANGE_LABEL).map((k) => (
          <option key={k} value={k}>
            {RANGE_LABEL[k]}
          </option>
        ))}
      </select>
      <input aria-label="사거리 거리" inputMode="numeric" size={4} value={form.range} onChange={(e) => set({ range: e.target.value })} /> m{' '}
      <select aria-label="다음" value={form.next} onChange={(e) => set({ next: e.target.value as CorrForm['next'] })}>
        {keys(NEXT_LABEL).map((k) => (
          <option key={k} value={k}>
            {NEXT_LABEL[k]}
          </option>
        ))}
      </select>
      <Preview
        draft={draft}
        empty={sent === null ? '방향(밀)을 먼저 입력' : '좌우 0–800 m, 사거리 0–1500 m'}
        names={names}
        mode={mode}
        send={send}
      />
    </>
  );
}
