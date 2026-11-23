// 가짜 인식기 (the mock 음성 입력) and the empty one for a browser that cannot run 음성 입력. Neither touches a microphone.
import { VoiceInputError, type VoiceInput } from '../index';

/** 가짜 인식기: each time the player stops talking, the next of `heard` is the 들린 글; nothing is heard once they are used up. */
export function fakeRecogniser(heard: readonly string[]): VoiceInput {
  let next = 0;
  return {
    open: () => Promise.resolve(),
    listen: () => ({
      stop: () => Promise.resolve(next < heard.length ? [heard[next++]!] : []),
      cancel: () => {},
    }),
    close: () => {},
  };
}

/** What a built app's 가짜 인식기 hears: the address's `?heard=`, split at `|`. Without it, nothing. */
export const heardOf = (search: string): string[] => new URLSearchParams(search).get('heard')?.split('|') ?? [];

/** For a browser that cannot run 음성 입력: `open` refuses, so the setting stays off and nothing ever listens. */
export const noVoiceInput: VoiceInput = {
  open: () => Promise.reject(new VoiceInputError('unsupported')),
  listen: () => ({ stop: () => Promise.resolve([]), cancel: () => {} }),
  close: () => {},
};
