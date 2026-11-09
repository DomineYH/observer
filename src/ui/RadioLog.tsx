import type { Mode, RadioEvent, RadioUtterance } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { clock } from './clock';
import { radioSentence, type RadioNames } from './radio/sentence';

/** 훈련 모드의 숫자 병기 is drawn dim beside the words. */
const GLOSS_STYLE = { opacity: 0.6 } as const;
/** 관측·기러기·시스템 색. */
const COLOUR = { observer: '#2e7d32', fdc: '#1565c0', system: '#757575' } as const;

/** A line of the log: something said on the radio, or a system notice. */
export type LogLine = RadioEvent | { type: 'system'; tick: number; text: string };

interface Props {
  lines: readonly LogLine[];
  callsign: string;
  gridLetters: string;
  mode: Mode;
}

/** One utterance's sentence. Arabic numerals are shown beside the words in training mode only. */
export function Sentence({ utterance, names, mode }: { utterance: RadioUtterance; names: RadioNames; mode: Mode }) {
  return radioSentence(utterance, names).map((p, j) =>
    p.gloss ? (
      mode === 'training' && (
        <span key={j} style={GLOSS_STYLE}>
          ({p.text})
        </span>
      )
    ) : (
      <span key={j}>{p.text}</span>
    ),
  );
}

/** 무전 기록: one line per 교신 한 마디 or notice: time, who said it, the sentence. */
export function RadioLog({ lines, callsign, gridLetters, mode }: Props) {
  return (
    <section aria-label="무전 기록">
      <ol>
        {lines.map((l, i) => {
          const speaker = l.type === 'system' ? 'system' : l.utterance.speaker;
          return (
            <li key={i} data-speaker={speaker} style={{ color: COLOUR[speaker] }}>
              {clock(l.tick)}{' '}
              {l.type === 'system' ? (
                l.text
              ) : (
                <>
                  <b>{speaker === 'observer' ? callsign : RADIO_GRAMMAR.battery.text}</b>{' '}
                  <Sentence utterance={l.utterance} names={{ callsign, gridLetters }} mode={mode} />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
