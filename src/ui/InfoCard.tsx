// 판 정보 카드 (#135, #130 Q1–Q3): on top of 작전 준비, the game's choices in one card. Its head is the 시드 line and its
// 기상 row the weather with 기상 바꾸기 (practice) or the "일일 · 읽기만" tag (daily). Above 기상 the 모드 row (#142); the
// 시나리오 → 포 rows come above it in later slices.
import { MODES, type Mode, type SeedKind, type Weather } from '@sim';
import { WEATHER_PRESETS, type WeatherPreset } from '@adapters/index';
import { MODE_NAMES } from './HeadBand';

export interface InfoCardProps {
  seed: number;
  seedKind: SeedKind;
  weather: Weather;
  /** The practice seed's preset in use (null for a daily seed), and choosing another one (F-30). */
  preset: WeatherPreset | null;
  onPreset: (p: WeatherPreset) => void;
  /** The mode in use, and choosing one (#115 Q1, Q10): 실전 in or out makes a new game, 훈련↔표준 is the mode input. */
  mode: Mode;
  onMode: (m: Mode) => void;
}

const COMBAT_INTRO = '실전: 적이 더 오고 적 포병이 쏜다. 보조 정보와 일시정지가 없고 작전 준비에 시간 제한이 있으며, 작전 개시 뒤에는 모드를 바꿀 수 없다.';

const PRESET_NAMES: Record<WeatherPreset, string> = { clear: '맑음', haze: '박무', rain: '비', wind: '강한 북서풍', fog: '안개' };

function weatherText(w: Weather): string {
  const parts = [
    `시정 ${(w.visibilityM / 1000).toFixed(1)} km`,
    `구름 ${w.cloudPct}%`,
    `바람 ${w.windFromDeg}° ${(w.windSpeedTenthMs / 10).toFixed(1)} m/s`,
    `${(w.tempTenthC / 10).toFixed(1)}°C`,
    `습도 ${w.humidityPct}%`,
    `${w.pressureHpa} hPa`,
  ];
  if (w.precipTenthMmH > 0) parts.push(`강수 ${(w.precipTenthMmH / 10).toFixed(1)} mm/h`);
  return parts.join(' · ');
}

export function InfoCard({ seed, seedKind, weather, preset, onPreset, mode, onMode }: InfoCardProps) {
  const daily = seedKind === 'daily';
  return (
    <section aria-label="판 정보" className="info-card">
      <p>
        <b>시드</b> {daily ? `일일 ${seed} — 오늘은 모두 같은 배치·기상·편차로 경쟁` : `연습 ${seed} — 랭킹 제외`}
      </p>
      {/* Radios, not buttons: the 머리띠 메뉴's 훈련·표준·실전 stay the only buttons of those names. */}
      <p role="radiogroup" aria-label="모드">
        <b>모드</b>
        {MODES.map((m) => (
          <label key={m}>
            {' '}
            <input type="radio" name="mode" checked={mode === m} onChange={() => onMode(m)} /> {MODE_NAMES[m]}
          </label>
        ))}
      </p>
      <p>
        <small>{COMBAT_INTRO}</small>
      </p>
      <p>
        <b>기상</b> {weatherText(weather)}
        {daily && (
          <>
            {' '}
            <span className="info-tag">일일 · 읽기만</span>
          </>
        )}
      </p>
      {!daily && preset && (
        <p>
          <label>
            기상 바꾸기{' '}
            <select value={preset} onChange={(e) => onPreset(e.target.value as WeatherPreset)}>
              {WEATHER_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PRESET_NAMES[p]}
                </option>
              ))}
            </select>
          </label>
        </p>
      )}
    </section>
  );
}
