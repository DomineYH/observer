// 문장 만들기: one 교신 한 마디 + the observer's callsign + the 방안 문자 → sentence pieces (ADR 0004, 0006).
import type { RadioUtterance } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import type { Cond, Fragment, TableName } from '@content/radio/types';
import { digits, hundreds, phonetic, rounds } from './readings';

/** A word piece, or a training-mode gloss (arabic numerals) for the word piece before it. */
export interface Piece {
  text: string;
  gloss?: true;
}

export interface RadioNames {
  callsign: string;
  gridLetters: string;
}

type Values = Readonly<Record<string, string | number | undefined>>;

/** The words only: what is spoken, and what must be unique. */
export const spoken = (pieces: readonly Piece[]): string =>
  pieces
    .filter((p) => !p.gloss)
    .map((p) => p.text)
    .join('');

export function radioSentence(u: RadioUtterance, names: RadioNames): Piece[] {
  const pattern = RADIO_GRAMMAR.patterns[u.kind];
  const values: Values = 'slots' in u ? u.slots : {};
  const elements: Piece[][] = [];
  if (pattern.header) {
    const [to, from] = u.speaker === 'observer' ? [RADIO_GRAMMAR.battery.text, names.callsign] : [names.callsign, RADIO_GRAMMAR.battery.text];
    elements.push([{ text: `${to}, ${RADIO_GRAMMAR.here.text} ${from}` }]);
  }
  for (const element of pattern.elements) {
    const pieces = element.flatMap((f) => render(f, values, names));
    if (pieces.length) elements.push(pieces);
  }
  if (u.ending !== 'none') elements.push([{ text: RADIO_GRAMMAR.endings[u.ending].text }]);
  return [...elements.flatMap((e, i) => (i ? [{ text: ', ' }, ...e] : e)), { text: '.' }];
}

function render(f: Fragment, v: Values, names: RadioNames): Piece[] {
  if (typeof f === 'string') return [{ text: f }];
  if ('if' in f) return (holds(f.if, v) ? f.then : (f.else ?? [])).flatMap((g) => render(g, v, names));
  if ('grid' in f) return [{ text: phonetic(names.gridLetters) }];
  if ('spell' in f) return [{ text: phonetic(f.spell) }];
  if ('corrections' in f) {
    const parts: Piece[][] = [];
    for (const [dirSlot, valueSlot] of f.corrections) {
      const n = v[valueSlot];
      if (n === undefined) continue;
      parts.push([{ text: `${word(dirSlot, v[dirSlot])} ${hundreds(num(n))}` }, { text: String(n), gloss: true }]);
    }
    if (!parts.length) return f.empty === undefined ? [] : [{ text: f.empty }];
    return parts.flatMap((p, i) => (i ? [{ text: ', ' }, ...p] : p));
  }
  const value = v[f.slot];
  if (value === undefined) throw new Error(`슬롯 값이 없다: ${f.slot}`);
  if (f.read === 'digits') return [{ text: digits(num(value), f.pad ?? 0) }, { text: String(value).padStart(f.pad ?? 0, '0'), gloss: true }];
  if (f.read === 'rounds') return [{ text: rounds(num(value)) }, { text: String(value), gloss: true }];
  if (typeof value === 'number') return [{ text: String(value) }];
  return [{ text: word(f.words ?? f.slot, value) }];
}

function holds(c: Cond, v: Values): boolean {
  const value = v[c.slot];
  return value !== undefined && (c.is === undefined || value === c.is) && (c.not === undefined || value !== c.not);
}

function word(table: string, value: string | number | undefined): string {
  const words: Readonly<Record<string, { text: string }>> | undefined = RADIO_GRAMMAR.tables[table as TableName];
  const found = value === undefined ? undefined : words?.[String(value)];
  if (found === undefined) throw new Error(`낱말이 없다: ${table}.${String(value)}`);
  return found.text;
}

function num(value: string | number): number {
  if (typeof value !== 'number') throw new Error(`수가 아닌 슬롯 값: ${value}`);
  return value;
}
