// 맞추는 규칙 ① (M4-4): the round trip. A sentence the 입력기 can make, given back as 들린 글, fills the form with the
// values it was made from. No DOM, no 인식기.
import { expect, test } from 'vitest';
import type { Fuze, Input, RadioUtterance } from '@sim';
import { readbackInput } from '../readback';
import { callDraft, FIRE, locDraft, polarDraft, posDraft } from './drafts';
import { listenWords, matchHeard, type Fill, type Heard, type OpenForm } from './matching';
import { radioSentence, spoken } from './sentence';

const NAMES = { callsign: '까마귀', gridLetters: 'CH' };
const sentence = (u: RadioUtterance) => spoken(radioSentence(u, NAMES));
const four = (n: number) => String(n).padStart(4, '0');

/** The input the form sends for a fill, made as the form makes it from its fields. */
function inputOf(f: Fill): Input | null {
  if (f.form === 'call') return callDraft(f.warning).input;
  if (f.form === 'pos') return posDraft(f.e, f.n)?.input ?? null;
  if (f.form === 'readback') return readbackInput('mto', f.entry);
  return f.method === 'grid' ? locDraft(Number(f.e), Number(f.n)).input : polarDraft(Number(f.az), Number(f.dist)).input;
}
const sent = (h: Heard): Input | null => (h === null ? null : 'send' in h ? h.send : inputOf(h.fill));

interface Case {
  forms: OpenForm[];
  said: string; // the sentence as the 무전 기록 writes it
  input: Input; // what the form sends for the values the sentence was made from
}
const GRIDS = [[0, 0], [9999, 9999], [4657, 3115], [90, 7]] as const;
const mto = (fuze: Fuze, rounds: number, amc: boolean, tn: number): Case => ({
  forms: [{ form: 'readback', asked: 'mto' }],
  said: sentence({ speaker: 'observer', ending: 'wait', kind: 'mto', slots: { fuze, rounds, control: amc ? 'amc' : 'ready', targetNumber: tn } }),
  input: { a: 'readback', v: ['mto', fuze, rounds, amc ? 'amc' : 'ready', tn] },
});
const of = (forms: OpenForm[], d: { input: Input; utterance: RadioUtterance }): Case => ({ forms, said: sentence(d.utterance), input: d.input });
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
    for (const heard of [c.said, c.said.replace(/[\s,.]/g, ''), words!.join(' '), bare(c.said)]) expect(sent(matchHeard([heard], c.forms, NAMES)), heard).toEqual(c.input);
  }
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
