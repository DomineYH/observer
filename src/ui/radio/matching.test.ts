// 맞추는 규칙 ① (M4-4): the round trip. A sentence the 입력기 can make, given back as 들린 글, fills the form with the
// values it was made from. No DOM, no 인식기.
import { expect, test } from 'vitest';
import type { Effect, Fuze, Input, RadioUtterance, Target } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { HEARD_NAMES, HEARD_OPEN, HEARD_ROWS } from '../../../tests/fixtures/heard';
import { corrDraft, shiftDraft, type CorrForm, type ShiftForm } from '../correction';
import { readbackInput } from '../readback';
import { callDraft, descDraft, eomDraft, FIRE, locDraft, polarDraft, posDraft, repeatDraft, type DescForm } from './drafts';
import { listenWords, matchHeard, sizeSaid, type Fill, type Heard, type OpenForm } from './matching';
import { radioSentence, spoken } from './sentence';

const NAMES = { callsign: '까마귀', gridLetters: 'CH' };
const sentence = (u: RadioUtterance) => spoken(radioSentence(u, NAMES));
const four = (n: number) => String(n).padStart(4, '0');

const NAME = { targetName: 'apc' } as const;
const TN = 1002; // the 전이's 기준: no value of the form
/** What the form reads besides its fields: the mission's 방향 (null: not sent yet) and the 효과 chosen in the 효과 form. */
interface Around {
  direction?: number | null;
  chosen?: Effect;
}
/** The input the form sends for a fill, made as the form makes it from its fields. */
function inputOf(f: Fill, { direction = null, chosen }: Around): Input | null {
  if (f.form === 'call') return callDraft(f.warning).input;
  if (f.form === 'pos') return posDraft(f.e, f.n)?.input ?? null;
  if (f.form === 'readback') return readbackInput('mto', f.entry);
  if (f.form === 'desc') return descDraft(f.values).input;
  if (f.form === 'corr') return corrDraft(f.values, { direction }, f.effect ?? chosen)?.input ?? null;
  if (f.form === 'eom') return eomDraft(f.effect, NAME).input;
  if (f.form === 'repeat') return repeatDraft(f.effect, f.rounds, NAME).input;
  if (f.form === 'shift') return shiftDraft(f.values, TN)?.input ?? null;
  return f.method === 'grid' ? locDraft(Number(f.e), Number(f.n)).input : polarDraft(Number(f.az), Number(f.dist)).input;
}
const sent = (h: Heard, around: Around = {}): Input | null => (h === null ? null : 'send' in h ? h.send : inputOf(h.fill, around));

interface Case extends Around {
  forms: OpenForm[];
  said: string; // the sentence as the 무전 기록 writes it (a 규모's numerals as they are said)
  input: Input; // what the form sends for the values the sentence was made from
}
const GRIDS = [[0, 0], [9999, 9999], [4657, 3115], [90, 7]] as const;
const mto = (fuze: Fuze, rounds: number, amc: boolean, tn: number): Case => ({
  forms: [{ form: 'readback', asked: 'mto' }],
  said: sentence({ speaker: 'observer', ending: 'wait', kind: 'mto', slots: { fuze, rounds, control: amc ? 'amc' : 'ready', targetNumber: tn } }),
  input: { a: 'readback', v: ['mto', fuze, rounds, amc ? 'amc' : 'ready', tn] },
});
const of = (forms: OpenForm[], d: { input: Input; utterance: RadioUtterance }, around: Around = {}): Case => ({ forms, said: sentence(d.utterance), input: d.input, ...around });

// 표적성질 choices: 규모 written in numerals and said in 세는 말; two differ in their count only, one has no 규모.
const INFANTRY: Target = { targetType: 'infantry', activity: 'attacking', unit: 'platoon' };
const APC2: Target = { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 };
const APC3: Target = { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 3 };
const OPTIONS: Target[] = [
  INFANTRY,
  { targetType: 'infantry', activity: 'halted', unit: 'platoon_minus' },
  { targetType: 'infantry', activity: 'halted', unit: 'squad' },
  { targetType: 'infantry', activity: 'moving', unit: 'men', count: 4 },
  APC2,
  APC3,
  { targetType: 'apc', activity: 'halted', unit: 'none' },
  { targetType: 'mortar', activity: 'firing', unit: 'tubes', count: 12 },
  { targetType: 'unknown' },
];
/** A sentence with the target's 규모 as it is said, each way ("2대" → "두 대"; "1개 소대" → 한 개 · 일 개). */
const aloud = (said: string, t: Target): string[] => {
  if (t.targetType === 'unknown' || t.unit === 'none') return [said];
  const written = `${'count' in t ? t.count : ''}${RADIO_GRAMMAR.tables.unit[t.unit].text}`;
  return sizeSaid(t).map((way) => said.replace(written, way));
};
const DESC: OpenForm[] = [{ form: 'desc', options: OPTIONS }];
const desc = (v: DescForm): Case[] => aloud(sentence(descDraft(v).utterance), v.target).map((said) => ({ forms: DESC, said, input: descDraft(v).input }));
const FIRST: OpenForm[] = [{ form: 'corr', needsDirection: true }];
const LATER: OpenForm[] = [{ form: 'corr', needsDirection: false }];
const EFFECT: OpenForm[] = [{ form: 'eom' }, { form: 'repeat' }, { form: 'corr', needsDirection: false, after: true }];
const IDLE: OpenForm[] = [{ form: 'call' }, { form: 'shift', options: OPTIONS }];
const ZERO = { lateralDir: 'left', lateral: '0', rangeDir: 'drop', range: '0' } as const;
const corr = (forms: OpenForm[], v: Partial<CorrForm>, around: Around = {}): Case => {
  const form: CorrForm = { ...ZERO, direction: '', next: 'adjust', ...v };
  return of(forms, corrDraft(form, { direction: around.direction ?? null }, around.chosen)!, around);
};
const shift = (v: Partial<ShiftForm> & { target: Target }): Case[] => {
  const d = shiftDraft({ ...ZERO, direction: '0800', rounds: 3, dangerClose: 0, ...v }, TN)!;
  return aloud(sentence(d.utterance), v.target).map((said) => ({ forms: IDLE, said, input: d.input }));
};
/** Every 교신 한 마디 of this slice's forms, at the ends and the middle of its values. */
const CASES: Case[] = [
  ...(['adjust', 'ffe'] as const).map((w) => of([{ form: 'call' }], callDraft(w))),
  ...GRIDS.map(([e, n]) => of([{ form: 'loc' }], locDraft(e, n))),
  ...([[0, 100], [6399, 15000], [420, 1500], [3200, 990]] as const).map(([az, d]) => of([{ form: 'loc' }], polarDraft(az, d))),
  ...GRIDS.map(([e, n]) => of([{ form: 'pos' }], posDraft(four(e), four(n))!)),
  { forms: [{ form: 'fire' }], said: sentence({ speaker: 'observer', ending: 'none', kind: 'fire' }), input: FIRE },
  ...(['shot', 'rounds_complete'] as const).map((asked) => ({
    forms: [{ form: 'readback', asked }] as OpenForm[],
    said: sentence({ speaker: 'observer', ending: 'wait', kind: asked }),
    input: { a: 'readback', v: [asked] } as Input,
  })),
  mto('quick', 1, false, 0),
  mto('vt', 5, true, 9999),
  mto('quick', 3, true, 1234),
  mto('vt', 2, false, 507),
  // 맞추는 규칙 ② (M4-5)
  ...OPTIONS.flatMap((target, i) => desc({ target, rounds: (i % 5) + 1, fuzeRequest: (['none', 'quick', 'vt'] as const)[i % 3]!, control: i % 2 ? 'amc' : 'ready', dangerClose: i % 4 === 3 ? 1 : 0 })),
  ...desc({ target: APC2, rounds: 5, fuzeRequest: 'vt', control: 'amc', dangerClose: 1 }),
  corr(FIRST, { direction: '1250', lateralDir: 'right', lateral: '120', rangeDir: 'add', range: '400' }),
  corr(FIRST, { direction: '0', lateral: '800', range: '1500', next: 'ffe' }),
  corr(FIRST, { direction: '6399' }), // 동제원
  corr(LATER, { lateral: '50', range: '200' }, { direction: 1250 }),
  corr(LATER, { rangeDir: 'add', range: '100', next: 'ffe' }, { direction: 1250 }),
  corr(LATER, { lateralDir: 'right', lateral: '30', next: 'ffe' }, { direction: 1250 }),
  corr(LATER, { lateral: '250', range: '1050' }, { direction: 1250 }),
  corr(LATER, { lateral: '10', rangeDir: 'add', range: '50' }, { direction: 1250 }),
  corr(LATER, {}, { direction: 1250 }), // 동제원
  // 수정 후 효력사: the 효과 is the one chosen in the form.
  corr(EFFECT, { lateral: '60', next: 'ffe' }, { direction: 1250, chosen: 'neutralized' }),
  corr(EFFECT, { next: 'ffe' }, { direction: 1250, chosen: 'ineffective' }),
  ...(['destroyed', 'neutralized', 'ineffective'] as const).flatMap((effect, i) => [
    of(EFFECT, eomDraft(effect, ([{ targetName: 'apc' }, { targetName: 'infantry', named: 1 }, { targetName: 'unknown' }] as const)[i]!)),
    of(EFFECT, repeatDraft(effect, i + 1, ([{ targetName: 'mortar', named: 1 }, { targetName: 'recon' }, { targetName: 'infantry', named: 0 }] as const)[i]!)),
  ]),
  ...shift({ target: APC2, lateral: '200', rangeDir: 'add', range: '400' }),
  ...shift({ target: INFANTRY, direction: '6399', rounds: 5, dangerClose: 1 }),
  ...shift({ target: { targetType: 'unknown' }, direction: '0', rounds: 1, lateralDir: 'right', lateral: '800' }),
];

/** The sentence cut into 들을 낱말, longest first; null when a part of it is none of them. */
function inWords(said: string, words: readonly string[]): string[] | null {
  const byLength = [...words].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  for (let s = said.replace(/[\s,.]/g, ''); s; ) {
    const w = byLength.find((x) => s.startsWith(x));
    if (!w) return null;
    out.push(w);
    s = s.slice(w.length);
  }
  return out;
}
/** Without the 호출부 and the 끝말. */
const bare = (said: string) => said.replace(/^기러기, 여기는 까마귀, /, '').replace(/(, (이상|잠깐대기))?\.$/, '');

test('F-18: 말한 문장은 제 양식 값으로 돌아온다', () => {
  expect(CASES.map((c) => c.said).slice(0, 3)).toEqual(['기러기, 여기는 까마귀, 조정, 이상.', '기러기, 여기는 까마귀, 효력사, 이상.', '좌표 찰리호텔 공공공공 공공공공, 이상.']);
  for (const c of CASES) {
    const words = inWords(c.said, listenWords(c.forms, NAMES));
    expect(words, c.said).not.toBeNull();
    // As written, with no spacing at all, a space between every word, and without the 호출부 and the 끝말.
    for (const heard of [c.said, c.said.replace(/[\s,.]/g, ''), words!.join(' '), bare(c.said)]) expect(sent(matchHeard([heard], c.forms, NAMES), c), heard).toEqual(c.input);
  }
  expect(CASES).toHaveLength(55);
  expect(desc({ target: INFANTRY, rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 }).map((c) => c.said)).toEqual([
    '공격중인 적 보병 한 개 소대, 포대 삼발, 이상.',
    '공격중인 적 보병 일 개 소대, 포대 삼발, 이상.',
  ]);
  expect(shift({ target: APC2, lateral: '200', rangeDir: 'add', range: '400' })[0]!.said).toBe(
    '전이, 표적번호 알파브라보 하나공공둘, 방향 공팔공공, 좌로 둘백, 늘리기 넷백, 이동중인 적 장갑차 두 대, 포대 삼발, 효력사, 이상.',
  );
  expect(bare(CASES[0]!.said)).toBe('조정');
  expect(bare(mto('quick', 1, false, 0).said)).toBe('사격지휘통보, 포대, 순발신관, 하나발, 표적번호 알파브라보 공공공공');
});

test('F-18: 말한 문장 — 들을 낱말은 그 양식의 문장에 나오는 낱말이고 문장은 남김없이 쪼개진다', () => {
  const words = (form: OpenForm) => listenWords([form], NAMES);
  const HEADER = ['기러기', '여기는', '까마귀', '이상', '잠깐대기'];
  const DIGITS = ['공', '하나', '둘', '삼', '넷', '오', '여섯', '칠', '팔', '아홉'];
  expect(words({ form: 'call' })).toEqual([...HEADER, '조정', '효력사']);
  expect(words({ form: 'fire' })).toEqual([...HEADER, '준비', '쏴']);
  expect(words({ form: 'loc' })).toEqual([...HEADER, '좌표', '찰리', '호텔', ...DIGITS, '극좌표', '방위각', '거리']);
  expect(words({ form: 'pos' })).toEqual([...HEADER, '관측소', '이동', '끝', '현', '위치', '좌표', '찰리', '호텔', ...DIGITS]);
  expect(words({ form: 'readback', asked: 'shot' })).toEqual([...HEADER, '하나발', '떳다']);
  expect(words({ form: 'readback', asked: 'rounds_complete' })).toEqual([...HEADER, '마감탄', '떳다']);
  expect(words({ form: 'readback', asked: 'mto' })).toEqual([...HEADER, '사격지휘통보', '포대', '순발신관', '접근신관', ...DIGITS, '발', '지명사', '표적번호', '알파', '브라보']);
  // Forms open together are heard together, each word once; another 방안 문자 brings its own 음성 문자.
  expect(listenWords([{ form: 'call' }, { form: 'pos' }], { callsign: '갈매기', gridLetters: 'OX' })).toEqual(
    ['기러기', '여기는', '갈매기', '이상', '잠깐대기', '조정', '효력사', '관측소', '이동', '끝', '현', '위치', '좌표', '오스카', '엑스레이', ...DIGITS],
  );
});

test('F-18: 말한 문장 — 자릿수가 틀리거나 꼭 들려야 하는 것이 빠지면 못 알아들음이다', () => {
  const none = (heard: string, ...forms: OpenForm[]) => expect(matchHeard([heard], forms, NAMES), heard).toBeNull();
  const LOC: OpenForm = { form: 'loc' };
  const POS: OpenForm = { form: 'pos' };
  const MTO: OpenForm = { form: 'readback', asked: 'mto' };
  // 좌표: seven or nine digits, a word that is no number among them, numbers read another way.
  none('좌표 찰리호텔 넷여섯오칠 삼하나하나', LOC);
  none('좌표 찰리호텔 넷여섯오칠 삼하나하나오 공', LOC);
  none('좌표 넷여섯오 음 칠 삼하나하나오', LOC);
  none('좌표 사육오칠 삼일일오', LOC);
  none('좌표 4657 3115', LOC);
  none('찰리호텔 넷여섯오칠 삼하나하나오', LOC); // 좌표 not said
  // 극좌표: 방위각 four digits, 거리 three to five; both must be heard, and not a 좌표 with them.
  none('극좌표, 방위각 넷둘공, 거리 하나오공공', LOC);
  none('극좌표, 방위각 공넷둘공공, 거리 하나오공공', LOC);
  none('극좌표, 방위각 공넷둘공, 거리 오공', LOC);
  none('극좌표, 방위각 공넷둘공, 거리 하나오공공공공', LOC);
  none('극좌표, 방위각 공넷둘공', LOC);
  none('극좌표, 거리 하나오공공', LOC);
  none('방위각 공넷둘공, 거리 하나오공공, 좌표 넷여섯오칠 삼하나하나오', LOC);
  // 호출: a 경고명령 낱말, and one only.
  none('기러기, 여기는 까마귀, 이상', { form: 'call' });
  none('조정, 효력사', { form: 'call' });
  // 준비 쏴 and the two short readbacks: the whole words.
  none('준비', { form: 'fire' });
  none('쏴', { form: 'fire' });
  none('하나발', { form: 'readback', asked: 'shot' });
  none('마감탄 떳다', { form: 'readback', asked: 'shot' });
  none('하나발 떳다', { form: 'readback', asked: 'rounds_complete' });
  // 위치 보고: its own words and the eight digits.
  none('좌표 찰리호텔 넷여섯오칠 삼하나하나오', POS);
  none('관측소 이동 끝, 현 위치', POS);
  none('관측소 이동 끝, 현 위치 좌표 찰리호텔 넷여섯오칠 삼하나하나', POS);
  // 사격지휘통보의 복창: 신관, 발수, 표적번호 four digits.
  none('사격지휘통보, 포대, 삼발, 표적번호 알파브라보 공공공하나', MTO);
  none('사격지휘통보, 포대, 순발신관, 접근신관, 삼발, 표적번호 알파브라보 공공공하나', MTO);
  none('사격지휘통보, 포대, 순발신관, 표적번호 알파브라보 공공공하나', MTO);
  none('사격지휘통보, 포대, 순발신관, 삼발', MTO);
  none('사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 공공하나', MTO);
  none('사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 공공공하나둘', MTO);
  none('사격지휘통보, 포대, 순발신관, 삼발, 알파브라보 공공공하나', MTO);
  none('', LOC);
  expect(matchHeard([], [LOC], NAMES)).toBeNull();
});

test('F-18: 말한 문장 — 골라도 되는 것과 순서, 여러 들린 글, 함께 열린 양식', () => {
  const MTO: OpenForm[] = [{ form: 'readback', asked: 'mto' }];
  const entry = (heard: string) => {
    const h = matchHeard([heard], MTO, NAMES);
    return h && 'fill' in h && h.fill.form === 'readback' ? h.fill.entry : null;
  };
  // 지명사 not said is 아님; the order and the words that carry no value do not matter.
  expect(entry('사격지휘통보, 포대, 접근신관, 둘발, 표적번호 알파브라보 공오공칠, 잠깐대기')).toEqual({ fuze: 'vt', rounds: '2', amc: false, tn: '0507' });
  expect(entry('표적번호 공오공칠 지명사 둘발 접근신관')).toEqual({ fuze: 'vt', rounds: '2', amc: true, tn: '0507' });
  // The 발수 is put in as heard: the box, as with typing, sends only 1–5.
  expect(entry('순발신관 아홉발 표적번호 공오공칠')).toEqual({ fuze: 'quick', rounds: '9', amc: false, tn: '0507' });
  expect(readbackInput('mto', entry('순발신관 아홉발 표적번호 공오공칠')!)).toBeNull();
  // 극좌표 need not be said; 방위각 and 거리 in either order.
  expect(matchHeard(['거리 아홉아홉공 방위각 삼둘공공'], [{ form: 'loc' }], NAMES)).toEqual({ fill: { form: 'loc', method: 'polar', az: '3200', dist: '990' } });
  // Several 들린 글: the first that fits.
  expect(matchHeard(['좌표 넷여섯오', '좌표 넷여섯오칠 삼하나하나오', '좌표 공공공공 공공공공'], [{ form: 'loc' }], NAMES)).toEqual({
    fill: { form: 'loc', method: 'grid', e: '4657', n: '3115' },
  });
  // 호출 and 위치 보고 open together: told apart by the 위치 보고's own words.
  const IDLE: OpenForm[] = [{ form: 'call' }, { form: 'pos' }];
  expect(matchHeard(['기러기, 여기는 까마귀, 효력사, 이상'], IDLE, NAMES)).toEqual({ fill: { form: 'call', warning: 'ffe' } });
  expect(matchHeard(['관측소 이동 끝, 현 위치 좌표 찰리호텔 공공구공 공공공칠'], IDLE, NAMES)).toBeNull(); // 구 is no 숫자 낱말
  expect(matchHeard(['현 위치 좌표 공공아홉공 공공공칠'], IDLE, NAMES)).toEqual({ fill: { form: 'pos', e: '0090', n: '0007' } });
  expect(matchHeard(['조정, 현 위치'], IDLE, NAMES)).toBeNull(); // the 위치 보고's word without its 좌표
  // A callsign that is a 교신 낱말 is not the 경고명령.
  const NAMED = { callsign: '조정', gridLetters: 'CH' };
  expect(matchHeard(['기러기, 여기는 조정, 효력사, 이상'], [{ form: 'call' }], NAMED)).toEqual({ fill: { form: 'call', warning: 'ffe' } });
  expect(matchHeard(['기러기, 여기는 조정, 이상'], [{ form: 'call' }], NAMED)).toBeNull();
});

test('F-18: 말한 문장 — 표적성질은 그때 양식의 고를 것만 듣고 수만 다른 둘은 세는 말로 가른다', () => {
  const target = (heard: string, options: Target[] = OPTIONS) => {
    const h = matchHeard([heard], [{ form: 'desc', options }], NAMES);
    return h && 'fill' in h && h.fill.form === 'desc' ? h.fill.values.target : null;
  };
  expect(target('이동중인 적 장갑차 두 대, 포대 삼발')).toEqual(APC2);
  expect(target('이동중인 적 장갑차 세 대, 포대 삼발')).toEqual(APC3);
  // Not among the choices: another 활동, another count, a 규모 not said, numerals read as numbers.
  for (const heard of ['정지중인 적 보병 한 개 소대, 포대 삼발', '이동중인 적 장갑차 네 대, 포대 삼발', '이동중인 적 장갑차, 포대 삼발', '이동중인 적 장갑차 둘 대, 포대 삼발', '이동중인 적 장갑차 2대, 포대 삼발'])
    expect(target(heard), heard).toBeNull();
  // A choice with no 규모 is heard as it is; said with a 규모, the choice that has it.
  expect(target('정지중인 적 장갑차, 포대 삼발')).toEqual({ targetType: 'apc', activity: 'halted', unit: 'none' });
  expect(target('공격중인 적 보병 한 개 소대, 포대 삼발', [{ targetType: 'infantry', activity: 'attacking', unit: 'none' }, INFANTRY])).toEqual(INFANTRY);
  expect(target('정지중인 적 보병 한 개 소대 마이너스, 포대 삼발')).toEqual({ targetType: 'infantry', activity: 'halted', unit: 'platoon_minus' });
  expect(target('사격중인 적 박격포 열두 문, 포대 삼발')).toEqual({ targetType: 'mortar', activity: 'firing', unit: 'tubes', count: 12 });
  // Two choices heard at once is none.
  expect(target('이동중인 적 장갑차 두 대, 이동중인 적 장갑차 세 대, 포대 삼발')).toBeNull();
  // 포대 뒤 발수 within the form's 1–5; the rest is read when said.
  for (const heard of ['미상 표적', '미상 표적, 삼발', '미상 표적, 포대 여섯발', '미상 표적, 포대 공발', '미상 표적, 포대 삼발, 순발신관, 접근신관']) expect(target(heard), heard).toBeNull();
  expect(matchHeard(['위험근접 지명사 포대 둘발 미상 표적'], DESC, NAMES)).toEqual({
    fill: { form: 'desc', values: { target: { targetType: 'unknown' }, rounds: 2, fuzeRequest: 'none', control: 'amc', dangerClose: 1 } },
  });
  // The 들을 낱말 hold the choices' words, not the whole 낱말표.
  const words = listenWords([{ form: 'desc', options: [APC2, { targetType: 'unknown' }] }], NAMES);
  expect(words).toEqual(expect.arrayContaining(['이동중', '인', '적', '장갑차', '두', '대', '미상', '표적', '포대', '발', '순발신관', '접근신관', '지명사', '위험근접']));
  for (const other of ['보병', '공격중', '박격포', '1개', '소대', '세', '2']) expect(words, other).not.toContain(other);
});

test('F-18: 말한 문장 — 수정은 방향이 없는 임무에서 방향을 꼭 듣고 수정량은 백·십 단위로 읽는다', () => {
  const values = (heard: string, forms: OpenForm[]) => {
    const h = matchHeard([heard], forms, NAMES);
    return h && 'fill' in h && h.fill.form === 'corr' ? h.fill.values : null;
  };
  // No 방향 yet: it must be heard, four digits. With one sent, the same words fill the form.
  expect(values('우로 하나백둘십, 늘리기 넷백', FIRST)).toBeNull();
  expect(values('방향 하나둘오, 우로 하나백둘십', FIRST)).toBeNull();
  expect(values('우로 하나백둘십, 늘리기 넷백', LATER)).toEqual({ direction: '', lateralDir: 'right', lateral: '120', rangeDir: 'add', range: '400', next: 'adjust' });
  expect(values('방향 하나둘오공, 우로 하나백둘십, 늘리기 넷백', LATER)?.direction).toBe('1250');
  expect(values('방향 하나둘오, 우로 하나백둘십', LATER)).toBeNull(); // said, and not four digits
  // 백·십 단위: an axis not said stays at its first value.
  expect(values('줄이기 하나오백', LATER)).toEqual({ direction: '', ...ZERO, range: '1500', next: 'adjust' });
  expect(values('좌로 여섯십 효력사', LATER)).toEqual({ direction: '', ...ZERO, lateral: '60', next: 'ffe' });
  expect(values('동제원', LATER)).toEqual({ direction: '', ...ZERO, next: 'adjust' });
  // Nothing to correct by, an axis said twice, no number, a number read another way.
  for (const heard of ['효력사', '이상', '좌로 오십 우로 오십', '좌로', '늘리기 넷', '좌로 오공', '좌로 백', '늘리기 사백']) expect(values(heard, LATER), heard).toBeNull();
  // The form, as with typing, takes only its range: 좌우 to 800 m.
  const far = values('좌로 아홉백', LATER)!;
  expect(far.lateral).toBe('900');
  expect(corrDraft(far, { direction: 1250 })).toBeNull();
});

test('F-18: 말한 문장 — 함께 열린 양식은 제 열쇠 낱말로 가르고 둘이 함께 들리면 못 알아들음이다', () => {
  const heard = (text: string, forms: OpenForm[]) => matchHeard([text], forms, NAMES);
  // 효과 관측: 임무끝 · 재효력사 · 수정 후 효력사.
  expect(heard('임무끝, 적 장갑차 파괴', EFFECT)).toEqual({ fill: { form: 'eom', effect: 'destroyed' } });
  expect(heard('효과 미흡, 재효력사, 동제원, 포대 하나발', EFFECT)).toEqual({ fill: { form: 'repeat', effect: 'ineffective', rounds: 1 } });
  expect(heard('좌로 오십, 효력사', EFFECT)).toEqual({ fill: { form: 'corr', values: { direction: '', ...ZERO, lateral: '50', next: 'ffe' }, effect: null } });
  // The 효과 may be said before 수정 후 효력사; without it the form's own stands.
  expect(heard('적 보병 파괴, 좌로 오십, 효력사', EFFECT)).toEqual({ fill: { form: 'corr', values: { direction: '', ...ZERO, lateral: '50', next: 'ffe' }, effect: 'destroyed' } });
  for (const text of [
    '임무끝, 재효력사, 적 장갑차 파괴, 포대 둘발', // two forms' key words
    '임무끝', // no 효과
    '임무끝, 파괴, 무력화',
    '무력화, 재효력사', // no 발수
    '무력화, 재효력사, 포대 넷발', // 재효력사 is 1–3
    '재효력사, 포대 둘발',
    '좌로 오십', // 수정 후 효력사 without 효력사
    '파괴, 무력화, 좌로 오십, 효력사',
  ])
    expect(heard(text, EFFECT), text).toBeNull();
  // 수정 (탄착 관측 뒤): no 효과 is heard there.
  expect(heard('임무끝, 적 장갑차 파괴', LATER)).toBeNull();
  // 감명 양호 뒤의 대기: 전이 tells the 전이사격 from the 호출.
  expect(heard('기러기, 여기는 까마귀, 효력사, 이상', IDLE)).toEqual({ fill: { form: 'call', warning: 'ffe' } });
  const said = shift({ target: APC2 })[0]!.said;
  expect(heard(said, IDLE)).toMatchObject({ fill: { form: 'shift', values: { direction: '0800', target: APC2, rounds: 3, dangerClose: 0, ...ZERO } } });
  // 전이사격: 방향, the 표적성질 and the 발수 must be heard; the 표적번호 is no value.
  expect(heard(said.replace('표적번호 알파브라보 하나공공둘, ', ''), IDLE)).toEqual(heard(said, IDLE));
  for (const cut of ['방향 공팔공공, ', '이동중인 적 장갑차 두 대, ', '포대 삼발, ']) expect(heard(said.replace(cut, ''), IDLE), cut).toBeNull();
  expect(heard(said.replace('공팔공공', '공팔공'), IDLE)).toBeNull();
  expect(heard(`${said} 현 위치`, [...IDLE, { form: 'pos' }])).toBeNull();
});

test('F-18: 들린 글 고정 자료', () => {
  expect(HEARD_ROWS.length).toBeGreaterThanOrEqual(50);
  expect(new Set(HEARD_ROWS.map((r) => r.id)).size).toBe(HEARD_ROWS.length);
  for (const row of HEARD_ROWS) {
    expect(['합성', '소유자'], row.id).toContain(row.source);
    expect(matchHeard([row.heard], HEARD_OPEN[row.open], HEARD_NAMES), `${row.id}: ${row.heard}`).toEqual(row.expect);
    // 틀리게 들림 marks a value that was filled, never a 못 알아들음.
    if (row.wrong) expect(row.expect, row.id).not.toBeNull();
  }
  // The seed, 합성 50: how many were understood, and how many of those wrongly.
  const seed = HEARD_ROWS.filter((r) => r.source === '합성');
  expect([seed.length, seed.filter((r) => r.expect).length, seed.filter((r) => r.wrong).length]).toEqual([50, 26, 5]);
});
