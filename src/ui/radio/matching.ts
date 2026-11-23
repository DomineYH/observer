// 맞추는 규칙 (F-18, #179): 교신 문법 데이터 read backwards. ① an open form → its 들을 낱말 ② the 들린 글 and the open
// forms → the values to fill, a 값 없는 입력 to send at once, or nothing (못 알아들음). Pure: no DOM, no 인식기. The forms
// still make the inputs, so a spoken input is a typed one.
import type { Effect, Fuze, Input, Target, Warning } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import type { Fragment, TableName } from '@content/radio/types';
import type { Amount, CorrForm, ShiftForm } from '../correction';
import type { Entry, Owed } from '../readback';
import { FIRE, type DescForm } from './drafts';
import type { RadioNames } from './sentence';

const G = RADIO_GRAMMAR;
const W = G.tables;
const DIGITS = G.digits.words;
const [HUNDRED, TEN, ROUND] = ['백', '십', '발']; // the 읽기 규칙's own words (readings.ts)

/** A form open for 눌러서 말하기. Those open at the same moment are told apart by their key words. */
export type OpenForm =
  | { form: 'call' }
  | { form: 'loc' }
  | { form: 'fire' }
  | { form: 'pos' }
  | { form: 'readback'; asked: Owed }
  /** 표적성질: only the form's own choices are heard. */
  | { form: 'desc'; options: readonly Target[] }
  /** 수정. `needsDirection`: the mission has no 방향 yet. `after`: 수정 후 효력사, open beside 임무끝 and 재효력사. */
  | { form: 'corr'; needsDirection: boolean; after?: boolean }
  | { form: 'eom' }
  | { form: 'repeat' }
  | { form: 'shift'; options: readonly Target[] };

/** A form's values as the form holds them (typed fields as text). What was not said is the form's first value. */
export type Fill =
  | { form: 'call'; warning: Warning }
  | { form: 'loc'; method: 'grid'; e: string; n: string }
  | { form: 'loc'; method: 'polar'; az: string; dist: string }
  | { form: 'pos'; e: string; n: string }
  | { form: 'readback'; entry: Entry }
  | { form: 'desc'; values: DescForm }
  /** `effect` (수정 후 효력사 only): the 효과 said before it; null leaves the one chosen in the form. */
  | { form: 'corr'; values: CorrForm; effect: Effect | null }
  | { form: 'eom'; effect: Effect }
  | { form: 'repeat'; effect: Effect; rounds: number }
  | { form: 'shift'; values: ShiftForm };

/** 채울 값, or a 값 없는 입력 (sent at once), or null: 못 알아들음, the form is not touched. */
export type Heard = { fill: Fill } | { send: Input } | null;

const squeeze = (text: string) => text.replace(/[\s,.]/g, '');
const letters = (s: string) => [...s].map((c) => (G.phonetic.words as Record<string, string>)[c] ?? '');

/** 듣기 자료 (#179 Q4): how a 규모 written in numerals is said. The one thing heard that 교신 문법 데이터 does not hold. */
const COUNTERS = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
// ponytail: 세는 말 up to 19 (no observed 규모 counts more); a larger count is never heard.
const counter = (n: number) => (n <= 10 ? COUNTERS[n]! : n < 20 ? `열${COUNTERS[n - 10]}` : String(n));
/** The ways a choice's 규모 is said: "2대" → 두 대, "1개 소대" → 한 개 소대 · 일 개 소대, "(-)" → 마이너스. */
export function sizeSaid(t: Target): string[] {
  if (t.targetType === 'unknown' || t.unit === 'none') return [];
  const unit = W.unit[t.unit].text.replace('(-)', ' 마이너스');
  return 'count' in t ? [`${counter(t.count)} ${unit}`] : ['한 개', '일 개'].map((one) => unit.replace('1개', one));
}
/** What must be heard for a 표적성질 choice: every part, each in any of its ways. */
const targetSaid = (t: Target): string[][] =>
  t.targetType === 'unknown' ? [[W.targetType.unknown.text]] : [[W.activity[t.activity].text], [W.targetType[t.targetType].text], ...(t.unit === 'none' ? [] : [sizeSaid(t)])];
/** A 표적성질's own slots: their words come from the form's choices, not from the whole 낱말표. */
const TARGET_SLOTS = ['activity', 'targetType', 'unit', 'count'];

/** Every word group a fragment can put in a sentence: fixed words, a slot's whole table, a reading's number words. */
function said(f: Fragment, names: RadioNames): string[] {
  if (typeof f === 'string') return f.split(',');
  if ('if' in f) return [...f.then, ...(f.else ?? [])].flatMap((g) => said(g, names));
  if ('grid' in f) return letters(names.gridLetters);
  if ('spell' in f) return letters(f.spell);
  if ('corrections' in f) return [...f.corrections.flatMap(([dir]) => tableOf(dir)), ...DIGITS, HUNDRED, TEN, f.empty ?? ''];
  if (f.read) return f.read === 'rounds' ? [...DIGITS, ROUND] : DIGITS;
  return TARGET_SLOTS.includes(f.slot) ? [] : tableOf(f.words ?? f.slot);
}
const tableOf = (name: string) => Object.values(W[name as TableName] ?? {}).map((w) => w.text);

const KIND = { call: 'call', loc: 'location', fire: 'fire', pos: 'position_report', desc: 'description', corr: 'correction', eom: 'end_of_mission', repeat: 'repeat', shift: 'shift' } as const;
const kindOf = (f: OpenForm) => (f.form === 'readback' ? f.asked : KIND[f.form]);

/** The word groups of the forms' sentences, spaces kept ("준비 쏴"): 호출부 and 끝말 too, which need not be heard. */
function groups(forms: readonly OpenForm[], names: RadioNames): string[] {
  const header = [G.battery.text, G.here.text, names.callsign, G.endings.over.text, G.endings.wait.text];
  const body = forms.flatMap((f) => [
    ...G.patterns[kindOf(f)].elements.flat().flatMap((frag) => said(frag, names)),
    ...('options' in f ? f.options.flatMap((o) => targetSaid(o).flat()) : []),
    ...(f.form === 'corr' && f.after ? tableOf('effect') : []), // the 효과 may be said before 수정 후 효력사
  ]);
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
/** More of a number follows at `i`: a 숫자 낱말 or a place word, right there or past one word that was not understood.
 * The number read up to `i` is then not the whole of what was said, and nothing is filled from it. */
const goesOn = (t: readonly string[], i: number): boolean => {
  const part = (w: string | undefined) => w !== undefined && (DIGITS.includes(w) || w === HUNDRED || w === TEN);
  return part(t[i]) || (t[i] === UNKNOWN && part(t[i + 1]));
};
/** The digits said after `key` (음성 문자 between are passed over), when their count is one of `lengths`. */
function digitsAfter(t: readonly string[], key: string, lengths: readonly number[]): string | null {
  let i = t.indexOf(squeeze(key));
  if (i++ < 0) return null;
  while (PHONETIC.has(t[i] ?? '')) i++;
  const d = digitRun(t, i);
  // An 음성 문자 right after the digits, or digits going on past a word not understood: the number was cut there.
  const end = i + d.length;
  return lengths.includes(d.length) && !PHONETIC.has(t[end] ?? '') && !goesOn(t, end) ? d : null;
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

/** 발수 backwards: one 숫자 낱말 and 발 right after `key`, within the form's choices (1 to `max`). */
function roundsAfter(t: readonly string[], key: string, max: number): number | null {
  const i = t.indexOf(squeeze(key));
  const n = DIGITS.indexOf(t[i + 1] ?? '');
  return i >= 0 && t[i + 2] === ROUND && n >= 1 && n <= max ? n : null;
}
/** 백·십 단위 backwards from `i` (둘백오십 → 250, 하나오백 → 1500, 여섯십 → 60); null when no such number starts there, or
 * when one starts and is not finished (하나백둘 with no 십: the tens place was not heard whole). */
function hundredsAt(t: readonly string[], i: number): number | null {
  const head = digitRun(t, i);
  const j = i + head.length;
  if (!head) return null;
  // [the meters, where the number ends]
  let read: [number, number] | null = null;
  if (head.length === 1 && t[j] === TEN) read = [Number(head) * 10, j + 1];
  else if (t[j] === HUNDRED) {
    const tens = digitRun(t, j + 1);
    if (!tens) read = [Number(head) * 100, j + 1];
    else if (tens.length === 1 && Number(tens) > 0 && t[j + 2] === TEN) read = [Number(head) * 100 + Number(tens) * 10, j + 3];
  }
  return read && read[0] > 0 && !goesOn(t, read[1]) ? read[0] : null;
}
/** One axis of a 수정량: its direction word and the meters after it. undefined: not said; null: said, but not readable. */
function axis<K extends string>(t: readonly string[], table: Record<K, { text: string }>): { dir: K; metres: number } | null | undefined {
  if (!has(t, ...Object.values<{ text: string }>(table).map((w) => w.text))) return undefined;
  const dir = oneOf(t, table);
  const metres = dir && hundredsAt(t, t.indexOf(squeeze(table[dir].text)) + 1);
  return dir && metres ? { dir, metres } : null;
}
/** 좌우·사거리 as the form holds them, an axis not said at its first value; null when one was said and not readable. */
function amounts(t: readonly string[]): { amount: Amount; any: boolean } | null {
  const [lat, rng] = [axis(t, W.lateralDir), axis(t, W.rangeDir)];
  if (lat === null || rng === null) return null;
  const amount: Amount = { lateralDir: lat?.dir ?? 'left', lateral: String(lat?.metres ?? 0), rangeDir: rng?.dir ?? 'drop', range: String(rng?.metres ?? 0) };
  return { amount, any: !!(lat || rng) };
}
/** A 수정 was said: 효력사, or a 수정량 axis (readable or not). */
const corrected = (t: readonly string[]) => has(t, '효력사') || amounts(t)?.any !== false;

/** The one choice that was said: every part of it heard, its 규모 right after its 병종 and ending cleanly. A choice
 * with no 규모 is not the one meant when a 규모 follows the 병종, heard or not (a 규모 the form does not list is none of
 * its choices); nor is a choice whose 규모 runs on into words that are not the form's. */
function targetAmong(t: readonly string[], options: readonly Target[]): Target | null {
  const sizes = new Set(options.flatMap((o) => sizeSaid(o).map(squeeze)));
  if (t.filter((w) => sizes.has(w)).length > 1) return null; // two 규모 said: two choices at once
  const said = options.filter((o) => {
    if (!targetSaid(o).every((ways) => has(t, ...ways))) return false;
    if (o.targetType === 'unknown') return true;
    const type = t.indexOf(squeeze(W.targetType[o.targetType].text));
    const sized = o.unit !== 'none';
    if (sized && !sizeSaid(o).map(squeeze).includes(t[type + 1] ?? '')) return false;
    const next = t[type + (sized ? 2 : 1)];
    return next === undefined || (next !== UNKNOWN && !DIGITS.includes(next) && !sizes.has(next));
  });
  return said.length === 1 ? said[0]! : null;
}

interface Rule<F extends OpenForm = OpenForm> {
  /** The words that tell this form from another open with it; none for the form meant when no other's are heard. */
  keys: readonly string[];
  match(t: readonly string[], form: F, names: RadioNames): Heard;
}
const fill = (f: Fill | null | false): Heard => (f ? { fill: f } : null);

// 양식마다 듣는 것 (#179): what must be heard, and what is read when it is.
const RULES: { [K in OpenForm['form']]: Rule<Extract<OpenForm, { form: K }>> } = {
  call: {
    keys: [],
    // A call holds the 호출부, one 경고명령 and the 끝말, no more: with another form's words in it (a 전이사격 whose "전이"
    // was not heard still ends in 효력사) it is not a call.
    match: (t, form, names) => {
      const own = new Set(groups([form], names).map(squeeze));
      const warning = oneOf(t, W.warning);
      return fill(t.every((w) => w === UNKNOWN || own.has(w)) && warning && { form: 'call', warning });
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
  desc: {
    keys: [],
    match: (t, { options }) => {
      const target = targetAmong(t, options);
      const rounds = roundsAfter(t, '포대', 5);
      const fuze = has(t, W.fuze.quick.text, W.fuze.vt.text) ? oneOf(t, W.fuze) : 'none';
      return fill(target && rounds !== null && fuze && { form: 'desc', values: { target, rounds, fuzeRequest: fuze, control: has(t, '지명사') ? 'amc' : 'ready', dangerClose: has(t, '위험근접') ? 1 : 0 } });
    },
  },
  corr: {
    keys: [],
    match: (t, { needsDirection, after }) => {
      const a = amounts(t);
      const direction = digitsAfter(t, '방향', [4]);
      if (!a || (!a.any && !has(t, '동제원')) || ((needsDirection || has(t, '방향')) && direction === null) || (after && !has(t, '효력사'))) return null;
      const effectSaid = !!after && has(t, ...Object.values(W.effect).map((w) => w.text));
      const effect = effectSaid ? oneOf(t, W.effect) : null;
      if (effectSaid && !effect) return null;
      return { fill: { form: 'corr', values: { ...a.amount, direction: direction ?? '', next: has(t, '효력사') ? 'ffe' : 'adjust' }, effect } };
    },
  },
  // 임무끝 and 재효력사 said with a 수정 (효력사, a 수정량) are two 다음 조치 at once: neither.
  eom: {
    keys: ['임무끝'],
    match: (t) => {
      const effect = oneOf(t, W.effect);
      return fill(!corrected(t) && effect && { form: 'eom', effect });
    },
  },
  repeat: {
    keys: ['재효력사'],
    match: (t) => {
      const effect = oneOf(t, W.effect);
      const rounds = roundsAfter(t, '포대', 3);
      return fill(!corrected(t) && effect && rounds !== null && { form: 'repeat', effect, rounds });
    },
  },
  shift: {
    keys: ['전이'],
    match: (t, { options }) => {
      const a = amounts(t);
      const direction = digitsAfter(t, '방향', [4]);
      const target = targetAmong(t, options);
      const rounds = roundsAfter(t, '포대', 5);
      if (!a || direction === null || !target || rounds === null) return null;
      return { fill: { form: 'shift', values: { ...a.amount, direction, target, rounds, dangerClose: has(t, '위험근접') ? 1 : 0 } } };
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
      const m = ruleOf(f).match(t, f, names);
      if (m) return m;
    }
  }
  return null;
}
