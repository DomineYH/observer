import { expect, test } from 'vitest';
import { ENDINGS, RADIO_KINDS, SPEAKERS } from '@sim';
import type { RadioUtterance } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { digits, hundreds, phonetic, rounds } from '@ui/radio/readings';
import { radioSentence, spoken } from '@ui/radio/sentence';
import { SNAPSHOT_CASES, slotCases, utterance } from './radio-cases';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const say = (u: RadioUtterance, names = NAMES) => spoken(radioSentence(u, names));

test('F-08: 읽기 규칙', () => {
  // 한 자리씩
  expect(digits(4720, 4)).toBe('넷칠둘공');
  expect(digits(0, 4)).toBe('공공공공');
  expect(digits(2500, 0)).toBe('둘오공공');
  // 백·십 단위
  expect(hundreds(250)).toBe('둘백오십');
  expect(hundreds(60)).toBe('여섯십');
  expect(hundreds(100)).toBe('하나백');
  expect(hundreds(1500)).toBe('하나오백');
  const correction = (slots: Extract<RadioUtterance, { kind: 'correction' }>['slots']): RadioUtterance => ({
    speaker: 'observer',
    ending: 'over',
    kind: 'correction',
    slots,
  });
  expect(say(correction({ rangeDir: 'drop', range: 200, next: 'adjust' }))).toBe('줄이기 둘백, 이상.');
  expect(say(correction({ next: 'adjust' }))).toBe('동제원, 이상.');
  expect(say(correction({ direction: 123, next: 'ffe' }))).toBe('방향 공하나둘삼, 동제원, 효력사, 이상.');
  expect(
    say({
      speaker: 'observer',
      ending: 'over',
      kind: 'shift',
      slots: { targetNumber: 1001, direction: 4720, targetType: 'unknown', rounds: 3, dangerClose: 0 },
    }),
  ).toBe('전이, 표적번호 알파브라보 하나공공하나, 방향 넷칠둘공, 미상 표적, 포대 삼발, 효력사, 이상.');
  // 발수
  expect(rounds(3)).toBe('삼발');
  expect(rounds(1)).toBe('하나발');
  // 음성 문자
  expect(phonetic('CH')).toBe('찰리호텔');
  expect(phonetic('AB')).toBe('알파브라보');
});

test('F-08: 문법 데이터는 값뿐', () => {
  expect(JSON.parse(JSON.stringify(RADIO_GRAMMAR))).toStrictEqual(RADIO_GRAMMAR);
  const strings: string[] = [];
  JSON.stringify(RADIO_GRAMMAR, (_k, v: unknown) => (typeof v === 'string' && strings.push(v), v));
  expect(strings.filter((s) => /<[a-z!/]/i.test(s))).toEqual([]);
});

test('F-08: 출처 표시와 검수 필요', () => {
  const SOURCES = ['example', 'public', 'us', 'inferred', 'design'];
  const marked: (readonly [string, { source: string; needsReview: boolean; note?: string }])[] = [
    ...Object.entries(RADIO_GRAMMAR.patterns).map(([kind, p]) => [`pattern.${kind}`, p] as const),
    ...Object.entries(RADIO_GRAMMAR.tables).flatMap(([table, words]) =>
      Object.entries(words).map(([value, word]) => [`${table}.${value}`, word] as const),
    ),
  ];
  expect(marked.length).toBe(21 + 32);
  for (const [name, m] of marked) {
    expect(SOURCES, name).toContain(m.source);
    expect(typeof m.needsReview, name).toBe('boolean');
  }
  // The spec's list of unreviewed wording and game words that differ from doctrine.
  const mustReview = [
    'pattern.radio_check',
    'pattern.radio_check_reply',
    'pattern.move_notice',
    'pattern.position_report',
    'pattern.mto',
    'pattern.danger_close_applied',
    'pattern.danger_close_adjust_first',
    'pattern.danger_close_resend',
    'pattern.shift',
    'pattern.correction',
    'pattern.description',
    'rangeDir.add',
    'effect.ineffective',
    'unit.platoon_minus',
  ];
  const flagged = new Set(marked.filter(([, m]) => m.needsReview).map(([name]) => name));
  expect(mustReview.filter((name) => !flagged.has(name))).toEqual([]);
  expect(RADIO_GRAMMAR.patterns.correction.note).toMatch(/십 단위 읽기/);
  expect(RADIO_GRAMMAR.patterns.correction.note).toMatch(/방향 호창/);
});

test('F-08: 호출부호와 방안 문자', () => {
  const grid: RadioUtterance = {
    speaker: 'observer',
    ending: 'over',
    kind: 'location',
    slots: { method: 'grid', easting: 4720, northing: 1830 },
  };
  expect(say(grid)).toBe('좌표 찰리호텔 넷칠둘공 하나팔삼공, 이상.');
  expect(say(grid, { callsign: '갈매기', gridLetters: 'AB' })).toBe('좌표 알파브라보 넷칠둘공 하나팔삼공, 이상.');
  const names = { callsign: '참매', gridLetters: 'CH' };
  expect(say({ speaker: 'observer', ending: 'over', kind: 'call', slots: { warning: 'adjust' } }, names)).toBe(
    '기러기, 여기는 참매, 조정, 이상.',
  );
  expect(say({ speaker: 'fdc', ending: 'over', kind: 'call_ack', slots: { warning: 'adjust' } }, names)).toBe(
    '참매, 여기는 기러기, 조정, 좌표 송신바람, 이상.',
  );
  expect(
    say(
      { speaker: 'observer', ending: 'over', kind: 'position_report', slots: { easting: 4720, northing: 1830 } },
      { callsign: '참매', gridLetters: 'DE' },
    ),
  ).toBe('기러기, 여기는 참매, 관측소 이동 끝, 현 위치 좌표 델타에코 넷칠둘공 하나팔삼공, 이상.');
  // Neither is a slot: an utterance cannot carry them.
  // @ts-expect-error callsign is not a slot
  const withCallsign: RadioUtterance = { speaker: 'observer', ending: 'over', kind: 'call', slots: { warning: 'adjust', callsign: '참매' } };
  expect(withCallsign.kind).toBe('call');
  expect(() => say(grid, { callsign: '참매', gridLetters: 'C1' })).toThrow();
});

test('F-08: 문장 유일성', () => {
  let total = 0;
  for (const speaker of SPEAKERS) {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const kind of RADIO_KINDS) {
      for (const slots of slotCases(kind)) {
        const key = `${kind} ${JSON.stringify(slots)}`;
        for (const ending of ENDINGS) {
          const sentence = say(utterance({ speaker, ending }, kind, slots));
          const other = seen.get(sentence);
          if (other === undefined) seen.set(sentence, key);
          else if (other !== key) collisions.push(`${sentence} ← ${other} | ${key}`);
          total++;
        }
      }
    }
    expect(collisions.slice(0, 10), speaker).toEqual([]);
  }
  expect(total).toBeGreaterThan(10_000);
}, 30_000); // about 3 s locally: hundreds of thousands of sentences

test('F-08: 문구 스냅숏', () => {
  const who = (u: RadioUtterance) => (u.speaker === 'observer' ? '관측' : 'FDC');
  // Training display: glosses in parentheses after the word they belong to.
  const lines = SNAPSHOT_CASES.map(
    (u) => `[${who(u)}] ${radioSentence(u, NAMES).map((p) => (p.gloss ? `(${p.text})` : p.text)).join('')}`,
  );
  expect(new Set(SNAPSHOT_CASES.map((u) => u.kind))).toEqual(new Set(RADIO_KINDS));
  // PRD 4.3 with the spec's corrected wording, as spoken.
  expect(SNAPSHOT_CASES.slice(0, 27).map((u) => `[${who(u)}] ${say(u)}`)).toEqual([
    '[FDC] 갈매기, 여기는 기러기, 감명 보고, 이상.',
    '[관측] 기러기, 여기는 갈매기, 감명 양호, 이상.',
    '[관측] 기러기, 여기는 갈매기, 조정, 이상.',
    '[FDC] 갈매기, 여기는 기러기, 조정, 좌표 송신바람, 이상.',
    '[관측] 좌표 찰리호텔 둘삼넷오 여섯칠팔아홉, 이상.',
    '[FDC] 좌표 찰리호텔 둘삼넷오 여섯칠팔아홉, 이상.',
    '[관측] 공격중인 적 보병 1개 소대, 포대 삼발, 지명사, 이상.',
    '[FDC] 공격중인 적 보병 1개 소대, 포대 삼발, 지명사, 잠깐대기.',
    '[FDC] 사격지휘통보, 포대, 접근신관, 하나발, 지명사, 표적번호 알파브라보 하나공공하나, 잠깐대기.',
    '[FDC] 포대 사격준비 끝.',
    '[관측] 준비 쏴.',
    '[FDC] 하나발 떳다, 이상.',
    '[관측] 하나발 떳다, 잠깐대기.',
    '[관측] 방향 넷칠둘공, 우로 여섯십, 줄이기 둘백, 효력사, 이상.',
    '[FDC] 방향 넷칠둘공, 우로 여섯십, 줄이기 둘백, 효력사, 잠깐대기.',
    '[FDC] 접근신관 사격준비 끝.',
    '[FDC] 마감탄 떳다, 이상.',
    '[관측] 마감탄 떳다, 잠깐대기.',
    '[관측] 적 보병소대 무력화, 재효력사, 동제원, 포대 둘발, 이상.',
    '[FDC] 동제원 포대 둘발, 잠깐대기.',
    '[관측] 임무끝, 적 보병소대 파괴.',
    '[관측] 전이, 표적번호 알파브라보 하나공공하나, 방향 넷칠둘공, 우로 둘백, 줄이기 하나백, 이동중인 적 장갑차 2대, 포대 삼발, 효력사, 이상.',
    '[FDC] 사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 하나공공둘, 잠깐대기.',
    '[관측] 공격중인 적 보병 1개 소대, 포대 삼발, 위험근접, 이상.',
    '[FDC] 갈매기, 여기는 기러기, 위험근접, 조정 후 효력사, 이상.',
    '[관측] 방향 넷칠둘공, 좌로 둘백, 줄이기 오십, 효력사, 이상.',
    '[FDC] 갈매기, 여기는 기러기, 위험근접, 수정량 100 이하로 재송신, 이상.',
  ]);
  expect(lines).toMatchSnapshot();
});
