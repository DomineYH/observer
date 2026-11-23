// 음성 입력 설정 (F-18, #178 Q5·Q6): off by default, kept for this page only. Turning it on opens the 음성 입력 (microphone
// permission, 음성 모델); a failure leaves it off with its cause. Typing is never touched.
import { VoiceInputError, type VoiceInput, type VoiceInputFailure } from '@adapters/index';

/** Off (after a failure, with its cause), opening (음성 모델 받는 중) or on. A new object on each change. */
export type VoiceSetting = { state: 'off'; failure: VoiceInputFailure | null } | { state: 'opening' } | { state: 'on' };

export const VOICE_OPENING = '음성 모델 받는 중';
export const VOICE_FAILURE: Record<VoiceInputFailure, string> = {
  unsupported: '이 브라우저에서는 음성 입력을 쓸 수 없습니다',
  denied: '마이크 권한이 없습니다',
  model: '음성 모델을 받지 못했습니다',
};

export function createVoiceSetting(input: VoiceInput, onChange: () => void = () => {}) {
  let setting: VoiceSetting = { state: 'off', failure: null };
  let attempt = 0; // a result of an earlier attempt is dropped
  const set = (next: VoiceSetting) => {
    setting = next;
    onChange();
  };
  return {
    get setting(): VoiceSetting {
      return setting;
    },
    /** The button: off → opening → on; pressed while opening or on, it closes the 음성 입력 and gives the opening up. */
    toggle(): void {
      const mine = ++attempt;
      if (setting.state !== 'off') {
        input.close();
        set({ state: 'off', failure: null });
        return;
      }
      set({ state: 'opening' });
      input.open().then(
        () => mine === attempt && set({ state: 'on' }),
        (e: unknown) => mine === attempt && set({ state: 'off', failure: e instanceof VoiceInputError ? e.reason : 'unsupported' }),
      );
    },
  };
}
