// 전이사격 (demo lines 952–956, 1026–1030): after 임무끝, the next target from the last 표적번호 in one transmission —
// 방향, 좌우·사거리, 표적성질, 발수, 위험근접 — with its preview and 송신.
import { useState } from 'react';
import type { Input, Mode, Target } from '@sim';
import { Amounts, Preview } from './CorrectionForm';
import { shiftDraft, type ShiftForm as Form } from './correction';
import { targetLabel } from './radio/drafts';
import type { Fill } from './radio/matching';
import type { RadioNames } from './radio/sentence';
import { useSpokenSend } from './talk';

const ROUNDS = [1, 2, 3, 4, 5];

interface Props {
  targetNumber: number; // the last mission's 표적번호: the 전이's 기준
  options: readonly Target[]; // 표적성질 choices (targetOptions)
  prefill: string; // 방향 field's start (prefillDirection)
  names: RadioNames;
  mode: Mode;
  send: (input: Input) => void;
  /** What was just said: a 전이사격 fill replaces every field. */
  spoken?: Fill | null;
}

export function ShiftForm({ targetNumber, options, prefill, names, mode, send, spoken = null }: Props) {
  const [form, setForm] = useState<Omit<Form, 'target'>>(() => ({
    direction: prefill,
    lateralDir: 'left',
    lateral: '0',
    rangeDir: 'drop',
    range: '0',
    rounds: 3,
    dangerClose: 0,
  }));
  const [target, setTarget] = useState('');
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const [lastSpoken, setLastSpoken] = useState<Fill | null>(null);
  if (spoken !== lastSpoken) {
    setLastSpoken(spoken);
    if (spoken?.form === 'shift') {
      const { target: said, ...fields } = spoken.values;
      setForm(fields);
      setTarget(JSON.stringify(said)); // one the form does not list falls back to its first choice, as below
    }
  }
  const chosen = options.find((t) => JSON.stringify(t) === target) ?? options[0]!;
  const draft = shiftDraft({ ...form, target: chosen }, targetNumber);
  const sendRef = useSpokenSend(spoken?.form === 'shift' ? spoken : null, () => draft && send(draft.input));
  return (
    <section aria-label="전이사격">
      <p>
        또는 전이사격 · 기준: AB{String(targetNumber).padStart(4, '0')}
      </p>
      <label>
        방향 <input inputMode="numeric" maxLength={4} size={4} value={form.direction} onChange={(e) => set({ direction: e.target.value })} /> 밀
      </label>
      <Amounts form={form} set={set} />
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
        <select value={form.rounds} onChange={(e) => set({ rounds: Number(e.target.value) })}>
          {ROUNDS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={form.dangerClose === 1} onChange={(e) => set({ dangerClose: e.target.checked ? 1 : 0 })} /> 위험근접
      </label>
      <Preview draft={draft} empty="방향(밀)을 먼저 입력" names={names} mode={mode} send={send} sendRef={sendRef} />
    </section>
  );
}
