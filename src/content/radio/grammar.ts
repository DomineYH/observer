// 교신 문법 데이터 (ADR 0004). Patterns follow #9 table 17 with the spec's corrected wording; sources follow PRD 4.1.
import type { SlotName } from '@sim';
import type { Fragment, Grammar, Pattern, Provenance, Word } from './types';

const w = (text: string, source: Word['source'], needsReview = false, note?: string): Word =>
  note === undefined ? { text, source, needsReview } : { text, source, needsReview, note };
const p = (header: boolean, elements: Fragment[][], source: Provenance['source'], needsReview = false, note?: string): Pattern =>
  note === undefined ? { header, elements, source, needsReview } : { header, elements, source, needsReview, note };

const ROUNDS: Fragment = { slot: 'rounds', read: 'rounds' };
const DIRECTION: Fragment = { slot: 'direction', read: 'digits', pad: 4 };
const TARGET_NUMBER: Fragment[] = ['표적번호 ', { spell: 'AB' }, ' ', { slot: 'targetNumber', read: 'digits', pad: 4 }];
const GRID: Fragment[] = [
  '좌표 ',
  { grid: true },
  ' ',
  { slot: 'easting', read: 'digits', pad: 4 },
  ' ',
  { slot: 'northing', read: 'digits', pad: 4 },
];
const CORRECTIONS: [SlotName, SlotName][] = [
  ['lateralDir', 'lateral'],
  ['rangeDir', 'range'],
];
/** 표적성질: "공격중인 적 보병 1개 소대", "이동중인 적 장갑차 2대", "미상 표적". No 괄호 after the 병종. */
const TARGET: Fragment[] = [
  { if: { slot: 'activity' }, then: [{ slot: 'activity' }, '인 적 '] },
  { slot: 'targetType' },
  { if: { slot: 'unit', not: 'none' }, then: [' ', { if: { slot: 'count' }, then: [{ slot: 'count' }] }, { slot: 'unit' }] },
];
/** 효과 보고의 표적 이름. */
const NAME: Fragment = {
  if: { slot: 'named', is: 1 },
  then: [{ slot: 'targetName', words: 'targetNameNamed' }],
  else: [{ slot: 'targetName' }],
};

export const RADIO_GRAMMAR = {
  battery: w('기러기', 'example'),
  here: w('여기는', 'example'),
  endings: { over: w('이상', 'example'), wait: w('잠깐대기', 'example') },
  digits: { words: ['공', '하나', '둘', '삼', '넷', '오', '여섯', '칠', '팔', '아홉'], source: 'example', needsReview: false },
  phonetic: {
    words: {
      A: '알파', B: '브라보', C: '찰리', D: '델타', E: '에코', F: '폭스트롯', G: '골프', H: '호텔', I: '인디아',
      J: '줄리엣', K: '킬로', L: '리마', M: '마이크', N: '노벰버', O: '오스카', P: '파파', Q: '퀘벡', R: '로미오',
      S: '시에라', T: '탱고', U: '유니폼', V: '빅터', W: '위스키', X: '엑스레이', Y: '양키', Z: '줄루',
    },
    source: 'us',
    needsReview: false,
  },
  tables: {
    warning: { adjust: w('조정', 'example'), ffe: w('효력사', 'example') },
    fuze: { quick: w('순발신관', 'example'), vt: w('접근신관', 'example') },
    lateralDir: { left: w('좌로', 'example'), right: w('우로', 'example') },
    rangeDir: { drop: w('줄이기', 'example'), add: w('늘리기', 'inferred', true, '늘리기') },
    effect: {
      destroyed: w('파괴', 'example'),
      neutralized: w('무력화', 'example'),
      ineffective: w('효과 미흡', 'design', true, '교리 낱말은 제압'),
    },
    activity: {
      attacking: w('공격중', 'example'),
      moving: w('이동중', 'example'),
      halted: w('정지중', 'inferred'),
      firing: w('사격중', 'inferred'),
    },
    targetType: {
      infantry: w('보병', 'example'),
      apc: w('장갑차', 'example'),
      mortar: w('박격포', 'design'),
      unknown: w('미상 표적', 'design'),
    },
    unit: {
      platoon: w('1개 소대', 'example'),
      platoon_minus: w('1개 소대(-)', 'design', true, '교리와 다른 게임 낱말'),
      squad: w('1개 분대', 'inferred'),
      men: w('명', 'design', true, '수는 아라비아 숫자로 적음'),
      vehicles: w('대', 'example', true, '수는 아라비아 숫자로 적음'),
      tubes: w('문', 'design', true, '수는 아라비아 숫자로 적음'),
    },
    targetName: {
      infantry: w('적 보병', 'inferred'),
      recon: w('적 정찰조', 'design'),
      apc: w('적 장갑차', 'inferred'),
      mortar: w('적 박격포', 'inferred'),
      unknown: w('표적', 'design'),
    },
    targetNameNamed: { infantry: w('적 보병소대', 'example'), mortar: w('적 박격포반', 'design') },
  },
  patterns: {
    radio_check: p(true, [['감명 보고']], 'design', true, '통신 점검'),
    radio_check_reply: p(true, [['감명 양호']], 'design', true, '통신 점검'),
    call: p(true, [[{ slot: 'warning' }]], 'example'),
    call_ack: p(true, [[{ slot: 'warning' }], ['좌표 송신바람']], 'example'),
    location: p(
      false,
      [
        [
          {
            if: { slot: 'method', is: 'grid' },
            then: GRID,
            else: ['극좌표, 방위각 ', { slot: 'azimuth', read: 'digits', pad: 4 }, ', 거리 ', { slot: 'distance', read: 'digits' }],
          },
        ],
      ],
      'example',
      false,
      '극좌표는 미군 교범',
    ),
    description: p(
      false,
      [
        TARGET,
        ['포대 ', ROUNDS],
        [{ if: { slot: 'fuzeRequest', not: 'none' }, then: [{ slot: 'fuzeRequest', words: 'fuze' }] }],
        [{ if: { slot: 'control', is: 'amc' }, then: ['지명사'] }],
        [{ if: { slot: 'dangerClose', is: 1 }, then: ['위험근접'] }],
      ],
      'example',
      true,
      '표적성질에 방호 정도 없음(설계), 위험근접 문구',
    ),
    danger_close_applied: p(true, [['표적이 아군 600 m 이내'], ['위험근접 적용']], 'design', true, '위험근접 문구'),
    danger_close_adjust_first: p(true, [['위험근접'], ['조정 후 효력사']], 'design', true, '위험근접 문구'),
    danger_close_resend: p(true, [['위험근접'], ['수정량 100 이하로 재송신']], 'design', true, '위험근접 문구'),
    mto: p(
      false,
      [['사격지휘통보'], ['포대'], [{ slot: 'fuze' }], [ROUNDS], [{ if: { slot: 'control', is: 'amc' }, then: ['지명사'] }], TARGET_NUMBER],
      'example',
      true,
      '사격지휘통보 문형: 표적번호 위치·읽는 법',
    ),
    ready: p(
      false,
      [[{ if: { slot: 'fuze' }, then: [{ slot: 'fuze' }, ' 사격준비 끝'], else: ['포대 사격준비 끝'] }]],
      'example',
    ),
    fire: p(false, [['준비 쏴']], 'example'),
    shot: p(false, [['하나발 떳다']], 'example'),
    rounds_complete: p(false, [['마감탄 떳다']], 'example'),
    correction: p(
      false,
      [
        [{ if: { slot: 'direction' }, then: ['방향 ', DIRECTION] }],
        [{ corrections: CORRECTIONS, empty: '동제원' }],
        [{ if: { slot: 'next', is: 'ffe' }, then: ['효력사'] }],
      ],
      'example',
      true,
      '방향 호창, 십 단위 읽기',
    ),
    repeat: p(false, [[NAME, ' ', { slot: 'effect' }], ['재효력사'], ['동제원'], ['포대 ', ROUNDS]], 'example'),
    repeat_ack: p(false, [['동제원 포대 ', ROUNDS]], 'example'),
    end_of_mission: p(false, [['임무끝'], [NAME, ' ', { slot: 'effect' }]], 'example'),
    shift: p(
      false,
      [
        ['전이'],
        TARGET_NUMBER,
        ['방향 ', DIRECTION],
        [{ corrections: CORRECTIONS }],
        TARGET,
        ['포대 ', ROUNDS],
        [{ if: { slot: 'dangerClose', is: 1 }, then: ['위험근접'] }],
        ['효력사'],
      ],
      'example',
      true,
      '전이사격 문형(예문 + 미군 SHIFT)',
    ),
    move_notice: p(true, [['관측소 이동']], 'design', true, '관측소 이동 통보'),
    position_report: p(true, [['관측소 이동 끝'], ['현 위치 ', ...GRID]], 'design', true, '위치 보고'),
  },
} satisfies Grammar;
