import { clock } from './clock';

/** 머리띠: 경과 · 점수 · 사용 탄, always in sight. */
export function HeadBand({ tick, score, rounds }: { tick: number; score: number; rounds: number }) {
  return (
    <p>
      경과 <output aria-label="경과">{clock(tick)}</output> · 점수 <output aria-label="점수">{score}</output> · 사용 탄{' '}
      <output aria-label="사용 탄">{rounds}발</output>
    </p>
  );
}
