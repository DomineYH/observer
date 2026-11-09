// 음성 출력의 실제 구현: the browser's speech synthesis in Korean. Speaks and returns; nothing waits for it.
import type { VoiceOutput } from './index';

export const webSpeech: VoiceOutput = {
  speak(_speaker, text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 1.05;
    const korean = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('ko'));
    if (korean) u.voice = korean;
    speechSynthesis.speak(u);
  },
  stop() {
    speechSynthesis.cancel();
  },
};
