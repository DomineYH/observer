// 복창 상자 (실전, #120 Q1 "숫자만 받아 적기", #121): the fixed words are written; the player taps the 신관 and types the
// numbers. It asks the first owed readback, and keeps what was put in until the mission ends.
import { useState } from 'react';
import type { Fuze, Input, Mission, MtoSlots } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { Sentence } from './RadioLog';
import { owedOf, readbackInput, wrongFields, type Entry } from './readback';

const W = RADIO_GRAMMAR.tables;
const AB = RADIO_GRAMMAR.phonetic.words.A + RADIO_GRAMMAR.phonetic.words.B;
const ASKED = { mto: '사격지휘통보', shot: '하나발 떳다', rounds_complete: '마감탄 떳다' } as const;
const WRONG = { outline: '2px solid #e53935' } as const;
const NAMES = { callsign: '', gridLetters: '' }; // the readbacks' sentences name no callsign or grid

interface Props {
  /** The current mission (its 밀린 복창 and 사격지휘통보); nothing is shown outside 실전 or with nothing owed. */
  mission: Pick<Mission, 'readback' | 'mto'> | undefined;
  send: (input: Input) => void;
}

/** Mounted per mission (keyed by the mission count), so a new mission starts empty. */
export function ReadbackBox({ mission, send }: Props) {
  const [entry, setEntry] = useState<Entry>({ fuze: null, rounds: '', amc: false, tn: '' });
  const [sent, setSent] = useState<MtoSlots | null>(null); // the last 사격지휘통보 readback sent
  const onSend = (input: Input) => {
    send(input);
    if (input.v![0] === 'mto') setSent(readbackSlots(input));
  };
  return <ReadbackForm mission={mission} entry={entry} sent={sent} onEntry={setEntry} onSend={onSend} />;
}

interface FormProps extends Omit<Props, 'send'> {
  entry: Entry; // what is put in: kept after sending, so a wrong readback is mended field by field
  sent: MtoSlots | null;
  onEntry: (e: Entry) => void;
  onSend: (input: Input) => void;
}

export function ReadbackForm({ mission, entry, sent, onEntry, onSend }: FormProps) {
  const r = mission?.readback;
  const owed = owedOf(r ?? null);
  if (!r || !owed.length) return null;
  const asked = owed[0]!;
  const input = readbackInput(asked, entry);
  // 틀린 칸: shown once 기러기's 정정 is in, from what was sent against the right values (#121 rule 3).
  const wrong = asked === 'mto' && sent && !r.correcting ? wrongFields(sent, mission!.mto!) : [];
  const mark = (name: string) => (wrong.includes(name) ? WRONG : undefined);
  const set = (patch: Partial<Entry>) => onEntry({ ...entry, ...patch });
  return (
    <section aria-label="복창">
      <p>
        복창: {ASKED[asked]} · 밀린 복창 {owed.length}
      </p>
      {asked === 'mto' ? (
        <p>
          사격지휘통보, 포대,{' '}
          <span role="group" aria-label="신관" style={mark('신관')}>
            {(['quick', 'vt'] as Fuze[]).map((f) => (
              <button key={f} type="button" aria-pressed={entry.fuze === f} onClick={() => set({ fuze: f })}>
                {W.fuze[f].text}
              </button>
            ))}
          </span>
          , <input aria-label="발수" inputMode="numeric" maxLength={1} size={1} value={entry.rounds} style={mark('발수')} onChange={(e) => set({ rounds: e.target.value })} />
          발,{' '}
          <label style={mark('지명사')}>
            <input type="checkbox" checked={entry.amc} onChange={(e) => set({ amc: e.target.checked })} /> 지명사
          </label>
          , 표적번호 {AB}{' '}
          <input aria-label="표적번호" inputMode="numeric" maxLength={4} size={4} value={entry.tn} style={mark('표적번호')} onChange={(e) => set({ tn: e.target.value })} />, {RADIO_GRAMMAR.endings.wait.text}.
        </p>
      ) : (
        <p>
          <Sentence utterance={{ speaker: 'observer', ending: 'wait', kind: asked }} names={NAMES} mode="combat" />
        </p>
      )}
      {wrong.length > 0 && <p role="alert">틀린 칸: {wrong.join(' · ')}</p>}
      <button
        type="button"
        disabled={!input || r.correcting} // 정정 is on its way: the simulation takes no readback of it until then
        onClick={() => {
          if (input && !r.correcting) onSend(input);
        }}
      >
        복창 송신
      </button>
    </section>
  );
}

const readbackSlots = (input: Input): MtoSlots => {
  const [, fuze, rounds, control, targetNumber] = input.v as [string, MtoSlots['fuze'], number, MtoSlots['control'], number];
  return { fuze, rounds, control, targetNumber };
};
