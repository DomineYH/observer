import { useState } from 'react';
import type { SoundSettings } from './sound';

interface Props {
  sound: { readonly settings: Readonly<SoundSettings>; set(next: Partial<SoundSettings>): void };
}

/** 소리 (효과음) and 음성 (기러기's voice), each a toggle button. */
export function SoundToggles({ sound }: Props) {
  const [settings, setSettings] = useState(sound.settings);
  const toggle = (key: keyof SoundSettings) => {
    sound.set({ [key]: !settings[key] });
    setSettings({ ...sound.settings });
  };
  return (
    <div role="group" aria-label="소리 설정">
      <button type="button" aria-pressed={settings.effects} onClick={() => toggle('effects')}>
        소리
      </button>
      <button type="button" aria-pressed={settings.voice} onClick={() => toggle('voice')}>
        음성
      </button>
    </div>
  );
}
