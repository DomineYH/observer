// 들린 글 고정 자료 (F-18, #179 테스트 셋 2): 말한 것 → 들린 글 → 기대. What a 인식기 really gave for a spoken sentence, and
// what 맞추는 규칙 makes of it in the form that was open. A rule change that moves a row shows here.
//
// 출처 합성: the #177 prototype's measured/synth-vosk-pieces.json (branch prototype/m4-voice-recognition, 9c31493): a
// synthesized voice (Microsoft Heami) at two rates (r0, r3), vosk small-ko hearing all 83 교신 낱말 at once, not one
// form's 들을 낱말. A row from the owner's recording is added with 출처 소유자; nothing else changes.
import type { Target } from '@sim';
import type { Heard, OpenForm } from '@ui/radio/matching';

export const HEARD_NAMES = { callsign: '까마귀', gridLetters: 'CH' };
/** The 표적성질 choices the 표적성질 and 전이사격 forms had. */
const OPTIONS: Target[] = [
  { targetType: 'infantry', activity: 'attacking', unit: 'platoon' },
  { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 },
  { targetType: 'mortar', activity: 'firing', unit: 'tubes', count: 3 },
  { targetType: 'unknown' },
];
/** The forms open when the sentence was said. */
export const HEARD_OPEN = {
  call: [{ form: 'call' }],
  loc: [{ form: 'loc' }],
  desc: [{ form: 'desc', options: OPTIONS }],
  fire: [{ form: 'fire' }],
  corrFirst: [{ form: 'corr', needsDirection: true }],
  corr: [{ form: 'corr', needsDirection: false }],
  effect: [{ form: 'eom' }, { form: 'repeat' }, { form: 'corr', needsDirection: false, after: true }],
  idleShift: [{ form: 'call' }, { form: 'shift', options: OPTIONS }],
  pos: [{ form: 'pos' }],
  mto: [{ form: 'readback', asked: 'mto' }],
  shot: [{ form: 'readback', asked: 'shot' }],
  roundsComplete: [{ form: 'readback', asked: 'rounds_complete' }],
} satisfies Record<string, OpenForm[]>;

export interface HeardRow {
  id: string;
  source: '합성' | '소유자';
  open: keyof typeof HEARD_OPEN;
  said: string;
  heard: string;
  /** null: 못 알아들음, the form is not touched. */
  expect: Heard;
  /** 틀리게 들림: heard wrong, and the rules fill a value that was not said. Kept so a rule change shows. The seed had
   * five such rows; since the review of PR #204 the rules take none of them (a 전이사격 without its "전이" is no call, and a
   * number with more of it left over is no number), at the price of one row that had been heard right (r0-pos-report,
   * whose 끝말 came out as "이 삼"). */
  wrong?: true;
}

export const HEARD_ROWS: HeardRow[] = [
  { id: 'r0-call-adjust', source: '합성', open: 'call', said: '기러기, 여기는 까마귀, 조정, 이상.', heard: '기러기 여기 는 까마귀 조정 미상', expect: { fill: { form: 'call', warning: 'adjust' } } },
  { id: 'r0-call-ffe', source: '합성', open: 'call', said: '기러기, 여기는 까마귀, 효력사, 이상.', heard: '기러기 여기 는 까마귀 효력 사 미상', expect: { fill: { form: 'call', warning: 'ffe' } } },
  { id: 'r0-loc-grid', source: '합성', open: 'loc', said: '좌표 찰리호텔 넷여섯오칠 삼하나하나오, 이상.', heard: '좌표 찰리 호텔 넷 여섯 두 칠 삼 하나 하나 오 이상', expect: null },
  { id: 'r0-loc-grid-zeros', source: '합성', open: 'loc', said: '좌표 찰리호텔 넷공오공 삼공공아홉, 이상.', heard: '좌표 찰리 호텔 넷 통보 공 삼 공 공 아홉 이상', expect: null },
  { id: 'r0-loc-polar', source: '합성', open: 'loc', said: '극좌표, 방위각 공여섯둘공, 거리 삼팔공공, 이상.', heard: '극좌표 방위각 공 이상 아홉 거리 삼 팔 공 공 이상', expect: null },
  { id: 'r0-loc-polar-2', source: '합성', open: 'loc', said: '극좌표, 방위각 오팔아홉공, 거리 둘넷오공, 이상.', heard: '극좌표 방위각 오 팔 아홉 공 거리 둘 넷 오 공 이상', expect: { fill: { form: 'loc', method: 'polar', az: '5890', dist: '2450' } } },
  { id: 'r0-desc-infantry', source: '합성', open: 'desc', said: '공격중인 적 보병 1개 소대, 포대 삼발, 이상.', heard: '공격 중인 적 보병 한 개 소대 포대 삼 발 미상', expect: { fill: { form: 'desc', values: { target: { targetType: 'infantry', activity: 'attacking', unit: 'platoon' }, rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } } } },
  { id: 'r0-desc-apc-vt-amc', source: '합성', open: 'desc', said: '이동중인 적 장갑차 2대, 포대 둘발, 접근신관, 지명사, 이상.', heard: '이동 중인 적 재 장갑차 두 대 포대 둘 발 접근 신관 지명 사 이상', expect: { fill: { form: 'desc', values: { target: { targetType: 'apc', activity: 'moving', unit: 'vehicles', count: 2 }, rounds: 2, fuzeRequest: 'vt', control: 'amc', dangerClose: 0 } } } },
  { id: 'r0-desc-unknown-dc', source: '합성', open: 'desc', said: '미상 표적, 포대 하나발, 순발신관, 위험근접, 이상.', heard: '미상 표적 포대 하나 발 순발 신관 위험 근접 이 삼', expect: { fill: { form: 'desc', values: { target: { targetType: 'unknown' }, rounds: 1, fuzeRequest: 'quick', control: 'ready', dangerClose: 1 } } } },
  { id: 'r0-desc-mortar', source: '합성', open: 'desc', said: '사격중인 적 박격포 3문, 포대 넷발, 이상.', heard: '사격 중인 적 박격포 삼 문 포대 넷 발 이 세 한', expect: null },
  { id: 'r0-fire', source: '합성', open: 'fire', said: '준비 쏴.', heard: '준비 사', expect: null },
  { id: 'r0-corr-direction', source: '합성', open: 'corrFirst', said: '방향 하나둘오공, 우로 하나백둘십, 늘리기 넷백, 이상.', heard: '방향 현 한 로 공 우 로 하나 백 둘 쏴 늘리기 넷 백 이 한', expect: null },
  { id: 'r0-corr-left-drop', source: '합성', open: 'corr', said: '좌로 오십, 줄이기 둘백, 이상.', heard: '잠깐 오 십 줄이기 둘 백 이 삼', expect: null },
  { id: 'r0-corr-add-ffe', source: '합성', open: 'corr', said: '늘리기 하나백, 효력사, 이상.', heard: '늘리기 하나 백 효력 사 이 삼', expect: { fill: { form: 'corr', values: { lateralDir: 'left', lateral: '0', rangeDir: 'add', range: '100', direction: '', next: 'ffe' }, effect: null } } },
  { id: 'r0-corr-right-ffe', source: '합성', open: 'corr', said: '우로 삼십, 효력사, 이상.', heard: '로 삼 십 효력 사 이 한', expect: null },
  { id: 'r0-corr-big', source: '합성', open: 'corr', said: '좌로 둘백오십, 줄이기 하나오백, 이상.', heard: '좌 로 둘 백 우 십 줄이기 하나 오 백 이상', expect: null },
  { id: 'r0-repeat', source: '합성', open: 'effect', said: '적 보병소대 무력화, 재효력사, 동제원, 포대 둘발, 이상.', heard: '적 보병 소대 무력화 재 효력 사 동 제원 포대 둘 발 이상', expect: { fill: { form: 'repeat', effect: 'neutralized', rounds: 2 } } },
  { id: 'r0-eom-destroyed', source: '합성', open: 'effect', said: '임무끝, 적 장갑차 파괴.', heard: '임무 끝 적 재 장갑차 파괴', expect: { fill: { form: 'eom', effect: 'destroyed' } } },
  { id: 'r0-eom-ineffective', source: '합성', open: 'effect', said: '임무끝, 적 보병 효과 미흡.', heard: '임무 끝 적 보병 효과 미흡', expect: { fill: { form: 'eom', effect: 'ineffective' } } },
  { id: 'r0-shift', source: '합성', open: 'idleShift', said: '전이, 표적번호 알파브라보 하나공공둘, 방향 공팔공공, 좌로 둘백, 늘리기 넷백, 이동중인 적 장갑차 2대, 포대 삼발, 효력사, 이상.', heard: '찰리 표적 번호 알파 브라보 하나 공 공 둘 방향 공 팔 공 공 좌 로 둘 백 늘리기 넷 백 이동 중인 적 장갑차 두 대 포대 삼 발 효력 사 이상', expect: null },
  { id: 'r0-pos-report', source: '합성', open: 'pos', said: '기러기, 여기는 까마귀, 관측소 이동 끝, 현 위치 좌표 찰리호텔 넷오아홉아홉 삼오공둘, 이상.', heard: '기러기 여기 는 까마귀 관측소 이동 끝 현 위치 좌표 찰리 호텔 넷 오 아홉 아홉 삼 오 공 둘 이 삼', expect: null },
  { id: 'r0-readback-mto', source: '합성', open: 'mto', said: '사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 하나공공하나, 잠깐대기.', heard: '사격지휘 통보 포대 순발 신관 삼 발 표적 번호 알파 브라보 하나 공 공 하나 잠깐 대기', expect: { fill: { form: 'readback', entry: { fuze: 'quick', rounds: '3', amc: false, tn: '1001' } } } },
  { id: 'r0-readback-mto-vt-amc', source: '합성', open: 'mto', said: '사격지휘통보, 포대, 접근신관, 둘발, 지명사, 표적번호 알파브라보 하나공하나둘, 잠깐대기.', heard: '사격지휘 통보 포대 접근 신관 팔 지명 사 표적 번호 알파 브라보 하나 공 하나 둘 잠깐 대기', expect: null },
  { id: 'r0-readback-shot', source: '합성', open: 'shot', said: '하나발 떳다, 잠깐대기.', heard: '하나 발 떳다 잠깐 대기', expect: { send: { a: 'readback', v: ['shot'] } } },
  { id: 'r0-readback-rounds-complete', source: '합성', open: 'roundsComplete', said: '마감탄 떳다, 잠깐대기.', heard: '마감 탄 떳다 잠깐 대기', expect: { send: { a: 'readback', v: ['rounds_complete'] } } },
  { id: 'r3-call-adjust', source: '합성', open: 'call', said: '기러기, 여기는 까마귀, 조정, 이상.', heard: '기러기 여기 는 까마귀 조정 이상', expect: { fill: { form: 'call', warning: 'adjust' } } },
  { id: 'r3-call-ffe', source: '합성', open: 'call', said: '기러기, 여기는 까마귀, 효력사, 이상.', heard: '기러기 여기 는 까마귀 효력 사 이 삼', expect: { fill: { form: 'call', warning: 'ffe' } } },
  { id: 'r3-loc-grid', source: '합성', open: 'loc', said: '좌표 찰리호텔 넷여섯오칠 삼하나하나오, 이상.', heard: '좌표 찰리 호텔 넷 여섯 칠 삼 하나 하나 오 이 삼', expect: null },
  { id: 'r3-loc-grid-zeros', source: '합성', open: 'loc', said: '좌표 찰리호텔 넷공오공 삼공공아홉, 이상.', heard: '좌표 찰리 호텔 넷 공 보병 삼 공격 아홉 이 삼', expect: null },
  { id: 'r3-loc-polar', source: '합성', open: 'loc', said: '극좌표, 방위각 공여섯둘공, 거리 삼팔공공, 이상.', heard: '극좌표 방위각 공 여섯 이동 거리 삼 팔 공격 이상', expect: null },
  { id: 'r3-loc-polar-2', source: '합성', open: 'loc', said: '극좌표, 방위각 오팔아홉공, 거리 둘넷오공, 이상.', heard: '극좌표 방위각 팔 아홉 공 거리 브라보 이 삼', expect: null },
  { id: 'r3-desc-infantry', source: '합성', open: 'desc', said: '공격중인 적 보병 1개 소대, 포대 삼발, 이상.', heard: '공격 중인 재 보병 한 개 소대 포대 삼 발 미상', expect: { fill: { form: 'desc', values: { target: { targetType: 'infantry', activity: 'attacking', unit: 'platoon' }, rounds: 3, fuzeRequest: 'none', control: 'ready', dangerClose: 0 } } } },
  { id: 'r3-desc-apc-vt-amc', source: '합성', open: 'desc', said: '이동중인 적 장갑차 2대, 포대 둘발, 접근신관, 지명사, 이상.', heard: '이동 중인 찰리 장갑차 소대 포대 발 접근 신관 지명 사 이상', expect: null },
  { id: 'r3-desc-unknown-dc', source: '합성', open: 'desc', said: '미상 표적, 포대 하나발, 순발신관, 위험근접, 이상.', heard: '미상 표적 포대 하나 발 순발 신관 위험 근접 이 삼', expect: { fill: { form: 'desc', values: { target: { targetType: 'unknown' }, rounds: 1, fuzeRequest: 'quick', control: 'ready', dangerClose: 1 } } } },
  { id: 'r3-desc-mortar', source: '합성', open: 'desc', said: '사격중인 적 박격포 3문, 포대 넷발, 이상.', heard: '사격 중인 적 박격포 삼 문 포대 넷 발 이상', expect: null },
  { id: 'r3-fire', source: '합성', open: 'fire', said: '준비 쏴.', heard: '준비 삼', expect: null },
  { id: 'r3-corr-direction', source: '합성', open: 'corrFirst', said: '방향 하나둘오공, 우로 하나백둘십, 늘리기 넷백, 이상.', heard: '방향 탄 아홉 우 로 하나 백 둘 십 늘리기 넷 백 이상', expect: null },
  { id: 'r3-corr-left-drop', source: '합성', open: 'corr', said: '좌로 오십, 줄이기 둘백, 이상.', heard: '잠깐 줄이기 둘 백 이 삼', expect: null },
  { id: 'r3-corr-add-ffe', source: '합성', open: 'corr', said: '늘리기 하나백, 효력사, 이상.', heard: '늘리기 하나 백 효력 사 이 삼', expect: { fill: { form: 'corr', values: { lateralDir: 'left', lateral: '0', rangeDir: 'add', range: '100', direction: '', next: 'ffe' }, effect: null } } },
  { id: 'r3-corr-right-ffe', source: '합성', open: 'corr', said: '우로 삼십, 효력사, 이상.', heard: '로 삼 십 효력 사 이상', expect: null },
  { id: 'r3-corr-big', source: '합성', open: 'corr', said: '좌로 둘백오십, 줄이기 하나오백, 이상.', heard: '좌 로 통보 십 줄이기 하나 오 백 이 삼', expect: null },
  { id: 'r3-repeat', source: '합성', open: 'effect', said: '적 보병소대 무력화, 재효력사, 동제원, 포대 둘발, 이상.', heard: '적 보병 소대 무력화 재 효력 사 동 제원 포대 발 이상', expect: null },
  { id: 'r3-eom-destroyed', source: '합성', open: 'effect', said: '임무끝, 적 장갑차 파괴.', heard: '임무 찰리 장갑차 파괴', expect: null },
  { id: 'r3-eom-ineffective', source: '합성', open: 'effect', said: '임무끝, 적 보병 효과 미흡.', heard: '임무 찰리 보병 효과 미흡', expect: null },
  { id: 'r3-shift', source: '합성', open: 'idleShift', said: '전이, 표적번호 알파브라보 하나공공둘, 방향 공팔공공, 좌로 둘백, 늘리기 넷백, 이동중인 적 장갑차 2대, 포대 삼발, 효력사, 이상.', heard: '찰리 표적 번호 알파 브라보 하나 공격 둘 방향 공 팔 공격 좌 로 둘 백 늘리기 넷 이동 중인 장갑차 소대 포대 순발 효력 사 이상', expect: null },
  { id: 'r3-pos-report', source: '합성', open: 'pos', said: '기러기, 여기는 까마귀, 관측소 이동 끝, 현 위치 좌표 찰리호텔 넷오아홉아홉 삼오공둘, 이상.', heard: '기러기 여기 넷 까마귀 관측소 이동 끝 현 위치 좌표 찰리 호텔 넷 오 아홉 아홉 삼 아홉 둘 이 삼', expect: null },
  { id: 'r3-readback-mto', source: '합성', open: 'mto', said: '사격지휘통보, 포대, 순발신관, 삼발, 표적번호 알파브라보 하나공공하나, 잠깐대기.', heard: '사격지휘 통보 포대 순발 신관 순발 표적 번호 알파 브라보 하나 공격 하나 잠깐 대기', expect: null },
  { id: 'r3-readback-mto-vt-amc', source: '합성', open: 'mto', said: '사격지휘통보, 포대, 접근신관, 둘발, 지명사, 표적번호 알파브라보 하나공하나둘, 잠깐대기.', heard: '사격지휘 통보 포대 접근 신관 팔 지명 사 표적 번호 알파 브라보 하나 공 한 넷 잠깐 대기', expect: null },
  { id: 'r3-readback-shot', source: '합성', open: 'shot', said: '하나발 떳다, 잠깐대기.', heard: '하나 발 떳다 잠깐 대기', expect: { send: { a: 'readback', v: ['shot'] } } },
  { id: 'r3-readback-rounds-complete', source: '합성', open: 'roundsComplete', said: '마감탄 떳다, 잠깐대기.', heard: '마감 탄 떳다 잠깐 대기', expect: { send: { a: 'readback', v: ['rounds_complete'] } } },
];
