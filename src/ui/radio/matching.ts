// 맞추는 규칙 (F-18, #179): 교신 문법 데이터 read backwards. ① an open form → its 들을 낱말 ② the 들린 글 and the open
// forms → the values to fill, a 값 없는 입력 to send at once, or nothing (못 알아들음). Pure: no DOM, no 인식기. The forms
// still make the inputs, so a spoken input is a typed one.
import type { Fuze, Input, Warning } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import type { Fragment, TableName } from '@content/radio/types';
import type { Entry, Owed } from '../readback';
import { FIRE } from './drafts';
import type { RadioNames } from './sentence';

const G = RADIO_GRAMMAR;
const W = G.tables;
const DIGITS = G.digits.words;
const [HUNDRED, TEN, ROUND] = ['백', '십', '발']; // the 읽기 규칙's own words (readings.ts)

/** A form open for 눌러서 말하기. Those open at the same moment are told apart by their key words. */
export type OpenForm = { form: 'call' } | { form: 'loc' } | { form: 'fire' } | { form: 'pos' } | { form: 'readback'; asked: Owed };

/** A form's values as the form holds them (typed fields as text). What was not said is the form's first value. */
export type Fill =
  | { form: 'call'; warning: Warning }
  | { form: 'loc'; method: 'grid'; e: string; n: string }
  | { form: 'loc'; method: 'polar'; az: string; dist: string }
  | { form: 'pos'; e: string; n: string }
  | { form: 'readback'; entry: Entry };

/** 채울 값, or a 값 없는 입력 (sent at once), or null: 못 알아들음, the form is not touched. */
export type Heard = { fill: Fill } | { send: Input } | null;

const squeeze = (text: string) => text.replace(/[\s,.]/g, '');
const letters = (s: string) => [...s].map((c) => (G.phonetic.words as Record<string, string>)[c] ?? '');

/** Every word group a fragment can put in a sentence: fixed words, a slot's whole table, a reading's number words. */
function said(f: Fragment, names: RadioNames): string[] {
  if (typeof f === 'string') return f.split(',');
  if ('if' in f) return [...f.then, ...(f.else ?? [])].flatMap((g) => said(g, names));
  if ('grid' in f) return letters(names.gridLetters);
  if ('spell' in f) return letters(f.spell);
  if ('corrections' in f) return [...f.corrections.flatMap(([dir]) => tableOf(dir)), ...DIGITS, HUNDRED, TEN, f.empty ?? ''];
  if (f.read) return f.read === 'rounds' ? [...DIGITS, ROUND] : DIGITS;
  return tableOf(f.words ?? f.slot);
}
const tableOf = (name: string) => Object.values(W[name as TableName] ?? {}).map((w) => w.text);

const KIND = { call: 'call', loc: 'location', fire: 'fire', pos: 'position_report' } as const;
const kindOf = (f: OpenForm) => (f.form === 'readback' ? f.asked : KIND[f.form]);

/** The word groups of the forms' sentences, spaces kept ("준비 쏴"): 호출부 and 끝말 too, which need not be heard. */
function groups(forms: readonly OpenForm[], names: RadioNames): string[] {
  const header = [G.battery.text, G.here.text, names.callsign, G.endings.over.text, G.endings.wait.text];
  const body = forms.flatMap((f) => G.patterns[kindOf(f)].elements.flat().flatMap((frag) => said(frag, names)));
  return [...new Set([...header, ...body].map((g) => g.trim()).filter(Boolean))];
}

/** ① 들을 낱말: every word the open forms' sentences can hold. Only these may come back as 들린 글. */
export const listenWords = (forms: readonly OpenForm[], names: RadioNames): string[] => [...new Set(groups(forms, names).flatMap((g) => g.split(/\s+/)))];

const UNKNOWN = '?';
/** The 들린 글 as the forms' word groups, spacing and commas dropped; a stretch that is none of them is one UNKNOWN. */
function tokens(text: string, forms: readonly OpenForm[], names: RadioNames): string[] {
  const vocab = groups(forms, names).map(squeeze).sort((a, b) => b.length - a.length);
  // "여기는 <호출부호>" goes first: a callsign may be a 교신 낱말.
  const s = squeeze(text).replace(squeeze(G.here.text + names.callsign), '');
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    const word = vocab.find((w) => s.startsWith(w, i));
    if (word) out.push(word);
    else if (out.at(-1) !== UNKNOWN) out.push(UNKNOWN);
    i += word?.length ?? 1;
  }
  return out;
}

const PHONETIC = new Set(Object.values(G.phonetic.words));
/** 한 자리씩 backwards: the run of 숫자 낱말 from `i`, as digits. */
function digitRun(t: readonly string[], i: number): string {
  let out = '';
  for (let d; (d = DIGITS.indexOf(t[i++] ?? '')) >= 0; ) out += d;
  return out;
}
/** The digits said after `key` (음성 문자 between are passed over), when their count is one of `lengths`. */
function digitsAfter(t: readonly string[], key: string, lengths: readonly number[]): string | null {
  let i = t.indexOf(squeeze(key));
  if (i++ < 0) return null;
  while (PHONETIC.has(t[i] ?? '')) i++;
  const d = digitRun(t, i);
  return lengths.includes(d.length) ? d : null;
}
const gridAfter = (t: readonly string[]) => {
  const d = digitsAfter(t, '좌표', [8]);
  return d === null ? null : { e: d.slice(0, 4), n: d.slice(4) };
};
/** The one key of a 낱말표 that was said; null when none or more than one was. */
function oneOf<K extends string>(t: readonly string[], table: Record<K, { text: string }>): K | null {
  const hit = (Object.keys(table) as K[]).filter((k) => t.includes(squeeze(table[k].text)));
  return hit.length === 1 ? hit[0]! : null;
}
const has = (t: readonly string[], ...phrases: string[]) => phrases.some((p) => t.includes(squeeze(p)));

interface Rule<F extends OpenForm = OpenForm> {
  /** The words that tell this form from another open with it; none for the form meant when no other's are heard. */
  keys: readonly string[];
  match(t: readonly string[], form: F): Heard;
}
const fill = (f: Fill | null | false): Heard => (f ? { fill: f } : null);

// 양식마다 듣는 것 (#179): what must be heard, and what is read when it is.
const RULES: { [K in OpenForm['form']]: Rule<Extract<OpenForm, { form: K }>> } = {
  call: {
    keys: [],
    match: (t) => {
      const warning = oneOf(t, W.warning);
      return fill(warning && { form: 'call', warning });
    },
  },
  loc: {
    keys: [],
    match: (t) => {
      const grid = gridAfter(t);
      if (!has(t, '극좌표', '방위각')) return fill(grid && { form: 'loc', method: 'grid', ...grid });
      const az = digitsAfter(t, '방위각', [4]);
      const dist = digitsAfter(t, '거리', [3, 4, 5]);
      return fill(!has(t, '좌표') && az !== null && dist !== null && { form: 'loc', method: 'polar', az, dist });
    },
  },
  fire: { keys: ['준비 쏴'], match: (t) => (has(t, '준비 쏴') ? { send: FIRE } : null) },
  pos: {
    keys: ['관측소 이동 끝', '현 위치'],
    match: (t) => {
      const grid = gridAfter(t);
      return fill(has(t, '관측소 이동 끝', '현 위치') && grid && { form: 'pos', ...grid });
    },
  },
  readback: {
    keys: [],
    match: (t, { asked }) => {
      if (asked !== 'mto') return has(t, G.patterns[asked].elements[0]![0] as string) ? { send: { a: 'readback', v: [asked] } } : null;
      const fuze: Fuze | null = oneOf(t, W.fuze);
      // 발수: one 숫자 낱말 right before 발.
      const at = t.indexOf(ROUND);
      const rounds = at > 0 && DIGITS.includes(t[at - 1]!) && !DIGITS.includes(t[at - 2] ?? '') ? digitRun(t, at - 1) : null;
      const tn = digitsAfter(t, '표적번호', [4]);
      return fill(fuze && rounds !== null && tn !== null && { form: 'readback', entry: { fuze, rounds, amc: has(t, '지명사'), tn } });
    },
  },
};
const ruleOf = (f: OpenForm) => RULES[f.form] as Rule;

/** ② The first 들린 글 (likeliest first) that one open form takes. Two forms' key words heard together is 못 알아들음. */
export function matchHeard(heard: readonly string[], forms: readonly OpenForm[], names: RadioNames): Heard {
  for (const text of heard) {
    const t = tokens(text, forms, names);
    const keyed = forms.filter((f) => has(t, ...ruleOf(f).keys));
    if (keyed.length > 1) continue;
    for (const f of keyed.length ? keyed : forms.filter((f) => !ruleOf(f).keys.length)) {
      const m = ruleOf(f).match(t, f);
      if (m) return m;
    }
  }
  return null;
}
