// 무음 어댑터: says nothing and remembers what it was asked. For tests, and for browsers without speech synthesis.
import type { Speaker } from '@sim';
import type { VoiceOutput } from '../index';

export function silentVoice(): VoiceOutput & { said: { speaker: Speaker; text: string }[]; stops: number } {
  const voice = {
    said: [] as { speaker: Speaker; text: string }[],
    stops: 0,
    speak: (speaker: Speaker, text: string) => void voice.said.push({ speaker, text }),
    stop: () => void voice.stops++,
  };
  return voice;
}
