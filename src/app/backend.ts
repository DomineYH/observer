import { terrainHash, type TerrainData } from '@sim';
import { TerrainLoadError, type TerrainFailure, type TerrainSource, type VoiceInput } from '@adapters/index';
import { mockTerrain } from '@adapters/mock/terrain';
import { fakeRecogniser, heardOf, noVoiceInput } from '@adapters/mock/voiceInput';
import { MUNGYEONG, realTerrain } from '@adapters/realTerrain';
import { browserEnv, VOICE_CREDITS, voskInput } from '@adapters/vosk/voiceInput';
import { PLACEMENTS } from '@content/lookup';
import type { Placement } from '@content/placement';

export type Backend = 'mock' | 'real';

/** Reads VITE_OBSERVER_BACKEND (unset → mock). Any value but mock or real stops startup. */
export function selectBackend(value: string | undefined): Backend {
  if (value === undefined || value === 'mock') return 'mock';
  if (value === 'real') return 'real';
  throw new Error(`VITE_OBSERVER_BACKEND=${JSON.stringify(value)}: mock 또는 real이어야 한다`);
}

// 이음매 표: what each seam is under VITE_OBSERVER_BACKEND. The first two rows and the last differ: the two records and
// voiceInputOf below; the others are wired in main.tsx the same way on both.
//
// | 이음매      | mock                                         | real                                                |
// | ----------- | -------------------------------------------- | --------------------------------------------------- |
// | 지형 원천   | mockTerrain: the seed makes the land         | realTerrain(MUNGYEONG): the 문경 지형 파일, any     |
// |             |                                              | seed, checked by the sim's 지형 해시                |
// | 고른 배치   | placementFor (seed.ts) over the 배치 목록 on | the same on the mungyeong 전장: base-mungyeong@2    |
// |             | the mock 전장: the 일일 시나리오, or a       | and apc-mungyeong@1, a 일일 후보 from 2026-11-25    |
// |             | practice ?scenario=; only base@1 is there    | (its 일일 시작일), the two alternating day by       |
// |             |                                              | day; apc-mungyeong@1 also by ?scenario=             |
// | 고른 포     | BASE_GUNS (base@1); a practice game's 작전 준비 may pick one of GUNS in range of the 배치 (regunned, game.ts) | same |
// | 실전        | 모드 실전 in 작전 준비 makes a new game with the 실전 자료 COMBAT (remade, game.ts) | same              |
// | 기상        | mockWeather                                  | mockWeather                                         |
// | 계정        | mockAccount (this browser's localStorage)    | mockAccount (this browser's localStorage)           |
// | 기록 보관소 | mockArchive (this browser's localStorage)    | mockArchive (this browser's localStorage)           |
// | 음성 출력   | webSpeech, or silentVoice without speechSynthesis in the browser (not chosen by the backend) | same       |
// | 음성 입력   | fakeRecogniser: the 들린 글 a test gives it, | voskInput: vosk small-ko in this browser (ADR 0023),|
// |             | or the address's ?heard=                     | noVoiceInput where the browser cannot run it;       |
// |             |                                              | unlike 음성 출력, chosen by the backend             |
const TERRAIN: Record<Backend, TerrainSource> = { mock: mockTerrain, real: realTerrain(MUNGYEONG, terrainHash) };

export const terrainSourceOf = (backend: Backend): TerrainSource => TERRAIN[backend];

/** 음성 입력 for the page at `search`. */
export function voiceInputOf(backend: Backend, search: string): VoiceInput {
  if (backend === 'mock') return fakeRecogniser(heardOf(search));
  const env = browserEnv();
  return env.capable() ? voskInput(env) : noVoiceInput;
}

/** 자료 출처 lines for the 음성 입력: the model and the library, where the real one is used. */
export const voiceCreditsOf = (backend: Backend): readonly string[] => (backend === 'real' ? VOICE_CREDITS : []);

/** What the page shows before the app's screen: the 받는 중 line, or the 오류 화면 for one cause. */
export interface BootScreen {
  loading(): void;
  error(reason: TerrainFailure): void;
}

/** The game's 지형 자료. On real the 받는 중 line shows first; a refusal shows the 오류 화면 and rethrows, so no game starts. */
export async function loadTerrain(backend: Backend, seed: number, screen: BootScreen, source = terrainSourceOf(backend)): Promise<TerrainData> {
  if (backend === 'real') screen.loading();
  performance.mark('terrain-load');
  try {
    return await source.load(seed);
  } catch (e) {
    if (e instanceof TerrainLoadError) screen.error(e.reason);
    throw e;
  } finally {
    performance.measure('terrain-load', 'terrain-load'); // 받기 + 풀기 + 해시, read by the load-time measurement
  }
}

// 배치, paired with the 지형 원천 by the same key: the 기본 시나리오 of the backend's 전장, the 배치 목록's first 배치 on it.
const BATTLEFIELD: Record<Backend, string> = { mock: 'mock', real: 'mungyeong' };

export const battlefieldOf = (backend: Backend): string => BATTLEFIELD[backend];

export const placementOf = (backend: Backend): Placement => PLACEMENTS.find((p) => p.terrain.id === BATTLEFIELD[backend])!;
