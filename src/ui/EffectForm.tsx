// 효과 관측 (demo lines 994–999, 1023): report the 효과 seen and end the mission, fire it again with the same data, or
// correct and fire for effect again. One preview, one 송신, like the other forms.
import { useState } from 'react';
import type { Effect, Input, Mission, Mode, ReadonlySimState } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { CorrectionForm, Preview } from './CorrectionForm';
import { reportName } from './effect';
import { eomDraft, repeatDraft } from './radio/drafts';
import type { RadioNames } from './radio/sentence';

const W = RADIO_GRAMMAR.tables;
const EFFECTS: readonly Effect[] = ['destroyed', 'neutralized', 'ineffective'];
const ACTIONS = { eom: '임무끝', repeat: '재효력사', corr: '수정 후 효력사' } as const;
type Action = keyof typeof ACTIONS;
const ROUNDS = [1, 2, 3]; // 재효력사 포대 1–3발 (demo)

interface Props {
  state: Pick<ReadonlySimState, 'missions' | 'platoons'>;
  mission: Pick<Mission, 'direction'>;
  prefill: string; // 방향 field's start, for a mission that has not sent one
  names: RadioNames;
  mode: Mode;
  send: (input: Input) => void;
}

export function EffectForm({ state, mission, prefill, names, mode, send }: Props) {
  const [effect, setEffect] = useState<Effect>('neutralized');
  const [action, setAction] = useState<Action>('eom');
  const [rounds, setRounds] = useState(2);
  const name = reportName(state);
  return (
    <>
      <select aria-label="효과" value={effect} onChange={(e) => setEffect(e.target.value as Effect)}>
        {EFFECTS.map((k) => (
          <option key={k} value={k}>
            {W.effect[k].text}
          </option>
        ))}
      </select>
      <select aria-label="다음 조치" value={action} onChange={(e) => setAction(e.target.value as Action)}>
        {(Object.keys(ACTIONS) as Action[]).map((k) => (
          <option key={k} value={k}>
            {ACTIONS[k]}
          </option>
        ))}
      </select>
      {action === 'repeat' && (
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
      )}
      {action === 'corr' ? (
        // B1: a mission that never sent 방향 (바로 효력사) gets the 방향 field here.
        <CorrectionForm sent={mission.direction} help={null} prefill={prefill} effect={effect} names={names} mode={mode} send={send} />
      ) : (
        <Preview
          draft={action === 'eom' ? eomDraft(effect, name) : repeatDraft(effect, rounds, name)}
          empty=""
          names={names}
          mode={mode}
          send={send}
        />
      )}
    </>
  );
}
