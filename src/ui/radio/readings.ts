// 읽기 규칙 넷 (ADR 0004): the rules are code, the words come from 교신 문법 데이터.
import { RADIO_GRAMMAR } from '@content/radio/grammar';

const DIGITS = RADIO_GRAMMAR.digits.words;

/** 한 자리씩: 4720 → 넷칠둘공. `pad` fixes the width with leading zeros (좌표·방향·표적번호). */
export function digits(n: number, pad: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`읽을 수 없는 수: ${n}`);
  return [...String(n).padStart(pad, '0')].map((c) => DIGITS[Number(c)]).join('');
}

/** 백·십 단위 (수정 거리): 250 → 둘백오십, 60 → 여섯십, 1500 → 하나오백. 0 reads as nothing. */
export function hundreds(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`읽을 수 없는 수: ${n}`);
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  return (h ? digits(h, 0) + '백' : '') + (t ? digits(t, 0) + '십' : '');
}

/** 발수: 3 → 삼발. */
export const rounds = (n: number): string => digits(n, 0) + '발';

/** 음성 문자: CH → 찰리호텔. */
export function phonetic(letters: string): string {
  const words: Record<string, string> = RADIO_GRAMMAR.phonetic.words;
  return [...letters]
    .map((c) => {
      const word = words[c];
      if (word === undefined) throw new Error(`음성 문자가 없는 글자: ${c}`);
      return word;
    })
    .join('');
}

/** 좌표 표기 (화면용): CH, 4512·3180 → 찰리호텔 4512 3180. */
export const gridLabel = (letters: string, g: { e: number; n: number }): string =>
  `${phonetic(letters)} ${String(g.e).padStart(4, '0')} ${String(g.n).padStart(4, '0')}`;
