// 판 정보 카드 (#135, #130 Q1–Q3): on top of 작전 준비, the game's choices in one card. Its head is the 시드 line and its
// 기상 row the weather with 기상 바꾸기 (practice) or the "일일 · 읽기만" tag (daily). Under the head the 시나리오 row (#145);
// the 포 → 모드 rows come between it and 기상 in later slices.
import { useState } from 'react';
import type { SeedKind, Weather } from '@sim';
import { WEATHER_PRESETS, type WeatherPreset } from '@adapters/index';

/** A 배치 of this build's 전장 as the 시나리오 고르기 list shows it. */
export interface ScenarioChoice {
  id: string;
  name: string;
  blurb: string;
}

export interface InfoCardProps {
  seed: number;
  seedKind: SeedKind;
  weather: Weather;
  /** The practice seed's preset in use (null for a daily seed), and choosing another one (F-30). */
  preset: WeatherPreset | null;
  onPreset: (p: WeatherPreset) => void;
  /** The game's 배치 name, and every 배치 on this 전장 to open as a practice game (#124 Q9). */
  scenario: string;
  scenarios: readonly ScenarioChoice[];
}

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

export function InfoCard({ seed, seedKind, weather, preset, onPreset, scenario, scenarios }: InfoCardProps) {
  const daily = seedKind === 'daily';
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="판 정보" className="info-card">
      <p>
        <b>시드</b> {daily ? `일일 ${seed} — 오늘은 모두 같은 배치·기상·편차로 경쟁` : `연습 ${seed} — 랭킹 제외`}
      </p>
      <p>
        <b>시나리오</b> {scenario}{' '}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {daily ? '시나리오 고르기 · 연습' : '시나리오 고르기'}
        </button>
      </p>
      {open && (
        <ul aria-label="시나리오">
          {scenarios.map((s) => (
            <li key={s.id}>
              {/* a new practice game at its first values: the page loads again (#124 Q9); a daily seed is today's number */}
              <a href={`?seed=${seed}&scenario=${encodeURIComponent(s.id)}`}>{s.name}</a> — {s.blurb}
            </li>
          ))}
        </ul>
      )}
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
