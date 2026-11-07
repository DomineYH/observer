// 수정 form and the send preview shared by the composer's forms (demo lines 986–993).
import { useState } from 'react';
import type { Effect, Input, Mode } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { Sentence } from './RadioLog';
import type { Draft } from './radio/drafts';
import type { RadioNames } from './radio/sentence';
import { corrDraft, suggestion, type CorrForm } from './correction';

const W = RADIO_GRAMMAR.tables;
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];

export interface PreviewProps {
  draft: Draft | null;
  empty: string; // shown while there is nothing to send
  names: RadioNames;
  mode: Mode;
  send: (input: Input) => void;
}

export function Preview({ draft, empty, names, mode, send }: PreviewProps) {
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
  /** 수정 후 효력사: the 효과 seen, sent with the correction; 다음 is then 효력사. */
  effect?: Effect;
}

/** 수정: mounted when the stage opens, so each correction starts from the 방향 and the suggestion of that moment. */
export function CorrectionForm({ sent, help, prefill, effect, names, mode, send }: CorrectionProps) {
  const [form, setForm] = useState<CorrForm>(() => ({
    direction: prefill,
    next: effect ? 'ffe' : 'adjust',
    ...(help?.form ?? { lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0' }),
  }));
  const set = (patch: Partial<CorrForm>) => setForm({ ...form, ...patch });
  const draft = corrDraft(form, { direction: sent }, effect);
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
{!effect && (
              <select aria-label="다음" value={form.next} onChange={(e) => set({ next: e.target.value as CorrForm['next'] })}>
        {keys(NEXT_LABEL).map((k) => (
          <option key={k} value={k}>
            {NEXT_LABEL[k]}
          </option>
        ))}
      </select>
      )}
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
