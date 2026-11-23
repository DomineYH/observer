import { useState } from 'react';
import type { SoundSettings } from './sound';
import { VOICE_FAILURE, VOICE_OPENING, type VoiceSetting } from './voiceSetting';

interface Props {
  sound: { readonly settings: Readonly<SoundSettings>; set(next: Partial<SoundSettings>): void };
  /** 음성 입력 설정; left out where 음성 입력 is not offered (a screen under 768 px). */
  voiceInput?: { setting: VoiceSetting; toggle(): void };
}

/** 소리 (효과음), 음성 (기러기's voice) and 음성 입력 (the player's), each a toggle button. */
export function SoundToggles({ sound, voiceInput }: Props) {
  const [settings, setSettings] = useState(sound.settings);
  const toggle = (key: keyof SoundSettings) => {
    sound.set({ [key]: !settings[key] });
    setSettings({ ...sound.settings });
  };
  const v = voiceInput?.setting;
  const note = v?.state === 'opening' ? VOICE_OPENING : v?.state === 'off' && v.failure ? VOICE_FAILURE[v.failure] : null;
  return (
    <div role="group" aria-label="소리 설정">
      <button type="button" aria-pressed={settings.effects} onClick={() => toggle('effects')}>
        소리
      </button>
      <button type="button" aria-pressed={settings.voice} onClick={() => toggle('voice')}>
        음성
      </button>
      {voiceInput && (
        <>
          {/* pressed while opening too: a second press gives the opening up */}
          <button type="button" aria-pressed={v!.state !== 'off'} onClick={voiceInput.toggle}>
            음성 입력
          </button>
          {note && <output aria-label="음성 입력 상태"> {note}</output>}
        </>
      )}
    </div>
  );
}
