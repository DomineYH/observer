// 다섯 이음매(지형 원천·기상 원천·계정·기록 보관소·음성 출력)의 인터페이스와 mock 구현 자리. 각 슬라이스가 더한다.
import type { Speaker, TerrainData } from '@sim';

/** 지형 원천: one 지형 자료 per seed, finished. */
export interface TerrainSource {
  load(seed: number): Promise<TerrainData>;
}

/** 음성 출력: reads a sentence aloud, or stops. Never waits for the result. */
export interface VoiceOutput {
  speak(speaker: Speaker, text: string): void;
  stop(): void;
}
