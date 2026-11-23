// 눌러서 말하기 (F-18, #180): while held, the 음성 입력 hears the open forms' 들을 낱말; let go, the 들린 글 goes through
// 맞추는 규칙 to the form that was open at the press. A 값 없는 한 마디 is sent at once; values only fill the form.
import { useEffect, useRef } from 'react';
import type { Input } from '@sim';
import type { Listening, VoiceInput } from '@adapters/index';
import { listenWords, matchHeard, type Fill, type OpenForm } from './radio/matching';
import type { RadioNames } from './radio/sentence';
import { ignoreShortcut } from './shortcut';

/** The one line beside the button. A new object on each change. */
export type TalkLine = { state: 'listening' | 'working' } | { state: 'heard' | 'missed'; text: string } | null;

export function talkText(line: TalkLine): string {
  if (!line) return '';
  if (!('text' in line)) return line.state === 'listening' ? '듣는 중' : '알아듣는 중';
  if (line.state === 'heard') return `들린 글: ${line.text}`;
  return line.text ? `알아듣지 못했습니다 · 들린 글: ${line.text}` : '알아듣지 못했습니다';
}

/** Where the words go: the forms open at the press. */
export interface TalkTarget {
  forms: readonly OpenForm[];
  names: RadioNames;
  /** Asked when the 들린 글 comes: is the form that was open at the press still the open one? */
  open(): boolean;
  fill(fill: Fill): void;
  send(input: Input): void;
}

/** `hush`: 기러기's 음성 출력 stops at the press and stays silent while held (#180 Q9). */
export function createTalk(input: VoiceInput, hush: (on: boolean) => void, onChange: () => void = () => {}) {
  let line: TalkLine = null;
  let attempt = 0; // a 들린 글 of an earlier press is dropped
  let held: { listening: Listening; target: TalkTarget } | null = null;
  const set = (next: TalkLine) => {
    line = next;
    onChange();
  };
  return {
    get line(): TalkLine {
      return line;
    },
    /** Pressed: nothing with no form open. Pressed again while a 들린 글 is still being worked out, that one is dropped. */
    press(target: TalkTarget): void {
      if (held || !target.forms.length) return;
      attempt++;
      hush(true);
      try {
        held = { listening: input.listen(listenWords(target.forms, target.names)), target };
      } catch {
        hush(false); // the 인식기 could not start: nothing is held, and 기러기 is heard again
        return set(null);
      }
      set({ state: 'listening' });
    },
    async release(): Promise<void> {
      if (!held) return;
      const { listening, target } = held;
      const mine = attempt;
      held = null;
      hush(false);
      set({ state: 'working' });
      const texts = await listening.stop().catch((): string[] => []);
      if (mine !== attempt) return;
      if (!target.open()) return set(null);
      for (const text of texts) {
        const heard = matchHeard([text], target.forms, target.names);
        if (!heard) continue;
        if ('send' in heard) target.send(heard.send);
        else target.fill(heard.fill);
        return set({ state: 'heard', text });
      }
      set({ state: 'missed', text: texts[0] ?? '' });
    },
    /** 음성 입력 was turned off, the button went away, or the window lost the keys: whatever is held or being worked out is
     * dropped, and 기러기 is heard again. */
    reset(): void {
      attempt++;
      if (held) {
        held.listening.cancel();
        hush(false);
      }
      held = null;
      set(null);
    },
  };
}
export type Talk = ReturnType<typeof createTalk>;

type Key = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>;
/** `V`, also by its place on the keyboard: with a Korean input method on, the key is ㅍ. */
export const isTalkKey = (e: Pick<KeyboardEvent, 'key' | 'code'>) => e.key === 'v' || e.key === 'V' || e.code === 'KeyV';
/** The two keys of 눌러서 말하기 (#180 Q6), under the 단축키 무시 조건: `V` held talks, `Enter` sends the spoken form. A
 * focused button keeps its own Enter. */
export function talkKey(e: Key): 'talk' | 'send' | null {
  if (ignoreShortcut(e)) return null;
  if (isTalkKey(e)) return 'talk';
  return e.key === 'Enter' && (e.target as { tagName?: string } | null)?.tagName !== 'BUTTON' ? 'send' : null;
}

/** A form filled by speech (`spoken`: the fill, a new object each time): the focus goes to its 송신 button, so `Enter`
 * is that button's; with the focus elsewhere (not in a field, not on another button) `Enter` does what 송신 does.
 * Returns the ref for the 송신 button. */
export function useSpokenSend(spoken: object | null, send: () => void) {
  const button = useRef<HTMLButtonElement>(null);
  const latest = useRef(send);
  useEffect(() => {
    latest.current = send;
  });
  useEffect(() => {
    if (spoken) button.current?.focus();
  }, [spoken]);
  const active = spoken !== null;
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (talkKey(e) === 'send' && !e.repeat) latest.current();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [active]);
  return button;
}
