// 입력기 (demo lines 905–1044): the form for the transmission the 교신 단계 takes, and the sentence it will send; after
// 임무끝 the 전이사격 form beside it.
import { useEffect, useState } from 'react';
import type { Control, Flag, FuzeRequest, GridRef, Input, Lase, Mode, RadioStage, ReadonlySimState, Warning } from '@sim';
import { gridOf } from '@render/mapView';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { callDraft, descDraft, FIRE, fireKey, locDraft, polarDraft, targetLabel, targetOptions, type Draft } from './radio/drafts';
import type { RadioNames } from './radio/sentence';
import { deviation, prefillDirection, suggestion } from './correction';
import { CorrectionForm, Preview } from './CorrectionForm';
import { casualtyNote } from './effect';
import { EffectForm } from './EffectForm';
import { ShiftForm } from './ShiftForm';

const W = RADIO_GRAMMAR.tables;
const FUZE_LABEL: Record<FuzeRequest, string> = { none: '신관 요청 없음', quick: W.fuze.quick.text, vt: W.fuze.vt.text };
const CONTROL_LABEL: Record<Control, string> = { ready: '준비되는 대로', amc: '지명사' };
const ROUNDS = [1, 2, 3, 4, 5];
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];
const GRID_FIELD = /^\d{4}$/;
const AZ_FIELD = /^\d{1,4}$/;
const DIST_FIELD = /^\d{3,5}$/;
const four = (n: number) => String(n).padStart(4, '0');

type Hit = Lase & { range: NonNullable<Lase['range']> };
/** What a lase fills in: 방위각 · 거리 for 극좌표, and the measured point's grid (used in training). */
const filled = (l: Hit, g: GridRef) => {
  const at = gridOf(g, l.range);
  return { polar: { az: four(Math.round(l.az / 10) % 6400), dist: String(l.range.dist) }, grid: { e: four(at.e), n: four(at.n) } };
};

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
  grid: GridRef;
  mode: Mode;
  send: (input: Input) => void;
  /** The simulation's state, read for the current mission (and in training for the correction help). */
  state: Pick<ReadonlySimState, 'missions' | 'op' | 'aim' | 'platoons' | 'lases'>;
  initial?: Partial<ComposerForm>;
}

export function Composer({ stage, live, platoons, names, grid: gridRef, mode, send, state, initial = {} }: Props) {
  const [warning, setWarning] = useState<Warning>(initial.warning ?? 'adjust');
  // The newest lase that met something fills 극좌표, and in training the grid too (demo lines 958–966); typing keeps
  // its values until the next such lase.
  const hit = state.lases.find((l): l is Hit => l.range !== null);
  const fill = hit && filled(hit, gridRef);
  const [method, setMethod] = useState<'grid' | 'polar'>('grid');
  const [grid, setGrid] = useState(initial.grid ?? (fill && mode === 'training' ? fill.grid : { e: '', n: '' }));
  const [polar, setPolar] = useState(fill?.polar ?? { az: '', dist: '' });
  const [lastHit, setLastHit] = useState(hit);
  if (hit !== lastHit) {
    setLastHit(hit);
    if (fill) {
      setPolar(fill.polar);
      if (mode === 'training') setGrid(fill.grid);
    }
  }
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
  else if (stage === 'loc' && method === 'grid' && GRID_FIELD.test(grid.e) && GRID_FIELD.test(grid.n)) draft = locDraft(Number(grid.e), Number(grid.n));
  else if (stage === 'loc' && method === 'polar' && AZ_FIELD.test(polar.az) && Number(polar.az) < 6400 && DIST_FIELD.test(polar.dist)) {
    const d = Number(polar.dist);
    if (d >= 100 && d <= 15000) draft = polarDraft(Number(polar.az), d);
  }
  else if (stage === 'desc') draft = descDraft({ rounds, fuzeRequest, control, dangerClose, target: chosen });

  return (
    <>
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
        {stage === 'effect' && mission && (
          <EffectForm state={state} mission={mission} prefill={prefillDirection({ mode, aim: state.aim })} names={names} mode={mode} send={send} />
        )}
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
            표적위치{' '}
            {(['grid', 'polar'] as const).map((m) => (
              <label key={m}>
                <input type="radio" name="loc-method" checked={method === m} onChange={() => setMethod(m)} /> {m === 'grid' ? '좌표' : '극좌표'}
              </label>
            ))}{' '}
            {method === 'grid'
              ? (['e', 'n'] as const).map((k) => (
                  <label key={k}>
                    {k === 'e' ? '동' : '북'}{' '}
                    <input inputMode="numeric" maxLength={4} size={4} value={grid[k]} onChange={(ev) => setGrid({ ...grid, [k]: ev.target.value })} />
                  </label>
                ))
              : (
                  <>
                    <label>
                      방위각{' '}
                      <input aria-label="방위각" inputMode="numeric" maxLength={4} size={4} value={polar.az} onChange={(ev) => setPolar({ ...polar, az: ev.target.value })} />
                    </label>{' '}
                    <label>
                      거리(m){' '}
                      <input aria-label="거리" inputMode="numeric" maxLength={5} size={5} value={polar.dist} onChange={(ev) => setPolar({ ...polar, dist: ev.target.value })} />
                    </label>
                  </>
                )}
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
          <Preview draft={draft} empty={stage === 'loc' && method === 'polar' ? '방위각(밀)과 거리(m)를 입력' : '동·북 네 자리씩'} names={names} mode={mode} send={send} />
        )}
      </section>
      {stage === 'idle' && mission?.mto && (
        <ShiftForm targetNumber={mission.mto.targetNumber} options={options} prefill={prefillDirection({ mode, aim: state.aim })} names={names} mode={mode} send={send} />
      )}
    </>
  );
}
