// 사건 → 소리: the squelch on every radio line, the 폭음 of a 탄착 heard distance ÷ 음속 later, 기러기's sentences read aloud.
import type { Point, SimEvent } from '@sim';
import type { VoiceOutput } from '@adapters/index';
import { radioSentence, spoken, type RadioNames } from './radio/sentence';

/** 효과음 (in ui, not a seam). */
export interface Effects {
  boom(distance: number): void;
  squelch(): void;
}

export interface SoundSettings {
  voice: boolean;
  effects: boolean;
}

const SOUND_SPEED = 343; // m/s (demo)
/** Ticks (50 ms) from a 탄착 to its 폭음 at `distance` m. */
const boomDelay = (distance: number) => Math.round((distance / SOUND_SPEED) * 20);

export function createSound(voice: VoiceOutput, effects: Effects, names: RadioNames) {
  const settings: SoundSettings = { voice: false, effects: true };
  let booms: { due: number; distance: number }[] = [];
  return {
    settings: settings as Readonly<SoundSettings>,
    set(next: Partial<SoundSettings>): void {
      if (settings.voice && next.voice === false) voice.stop();
      Object.assign(settings, next);
    },
    /** One step's events, read with the state after that step. */
    hear(events: readonly SimEvent[], state: { tick: number; op: Point }): void {
      for (const e of events) {
        if (e.type === 'radio') {
          if (settings.effects) effects.squelch();
          // 기러기 only, and words only: the training-mode 병기 is never read.
          if (settings.voice && e.utterance.speaker === 'fdc') voice.speak('fdc', spoken(radioSentence(e.utterance, names)));
        } else if (e.type === 'impact') {
          const distance = Math.hypot(e.x - state.op.x, e.y - state.op.y);
          booms.push({ due: e.tick + boomDelay(distance), distance });
        }
      }
      // The delay runs on the simulation's clock: a pause holds the 폭음, 배속 brings it sooner.
      const due = booms.filter((b) => b.due <= state.tick);
      booms = booms.filter((b) => b.due > state.tick);
      if (settings.effects) for (const b of due) effects.boom(b.distance);
    },
  };
}
