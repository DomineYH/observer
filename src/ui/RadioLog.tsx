import type { Mode, RadioUtterance } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { radioSentence } from './radio/sentence';

/** 훈련 모드의 숫자 병기 is drawn dim beside the words. */
const GLOSS_STYLE = { opacity: 0.6 } as const;

interface Props {
  utterances: readonly RadioUtterance[];
  callsign: string;
  gridLetters: string;
  mode: Mode;
}

/** 무전 기록: one line per 교신 한 마디. Arabic numerals are shown beside the words in training mode only. */
export function RadioLog({ utterances, callsign, gridLetters, mode }: Props) {
  return (
    <section aria-label="무전 기록">
      <ol>
        {utterances.map((u, i) => (
          <li key={i}>
            <b>{u.speaker === 'observer' ? callsign : RADIO_GRAMMAR.battery.text}</b>{' '}
            {radioSentence(u, { callsign, gridLetters }).map((p, j) =>
              p.gloss ? (
                mode === 'training' && (
                  <span key={j} style={GLOSS_STYLE}>
                    ({p.text})
                  </span>
                )
              ) : (
                <span key={j}>{p.text}</span>
              ),
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
