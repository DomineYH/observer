// 눌러서 말하기 단추와 한 줄 (F-18, #180 Q5·Q6): shown only while 음성 입력 is on. Held (the button, or `V`), it listens.
import { useEffect, useRef } from 'react';
import type { Input } from '@sim';
import type { Fill, OpenForm } from './radio/matching';
import type { RadioNames } from './radio/sentence';
import { isTalkKey, talkKey, talkText, type Talk, type TalkLine } from './talk';

interface Props {
  talk: Pick<Talk, 'press' | 'release'>;
  line: TalkLine;
  /** The forms open now; with none the button cannot be pressed. */
  forms: readonly OpenForm[];
  names: RadioNames;
  /** Changes whenever the open form is built again: a 들린 글 that comes after that is dropped. */
  formKey: string;
  onFill: (fill: Fill) => void;
  send: (input: Input) => void;
}

export function TalkBar({ talk, line, forms, names, formKey, onFill, send }: Props) {
  const key = useRef(formKey);
  const press = () => {
    const at = formKey;
    talk.press({ forms, names, open: () => key.current === at, fill: onFill, send });
  };
  const latest = useRef(press);
  useEffect(() => {
    key.current = formKey;
    latest.current = press;
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (talkKey(e) === 'talk' && !e.repeat) latest.current();
    };
    const up = (e: KeyboardEvent) => {
      if (isTalkKey(e)) void talk.release();
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, [talk]);
  const release = () => void talk.release();
  /** The focused button held by Space or Enter talks too. */
  const held = (e: { key: string; repeat?: boolean }) => (e.key === ' ' || e.key === 'Enter') && !e.repeat;
  return (
    <p>
      <button
        type="button"
        disabled={!forms.length}
        aria-pressed={line?.state === 'listening'}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => held(e) && press()}
        onKeyUp={(e) => held(e) && release()}
      >
        눌러서 말하기 <kbd>V</kbd>
      </button>{' '}
      <output aria-label="들린 글">{talkText(line)}</output>
    </p>
  );
}
