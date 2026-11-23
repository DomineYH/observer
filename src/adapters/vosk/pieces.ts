// 조각 표 (ADR 0023, #178): vosk small-ko 0.22 lacks some 교신 낱말; given as pieces it has, it hears them, and the 들린 글
// comes back in pieces ("효력 사"). 맞추는 규칙 drops the spacing. Both lists are this model's: `npm run voice:check`
// measures them against it, and a word added to 교신 문법 데이터 or the 듣기 자료 must pass that check again.

/** A 교신 낱말 the model lacks → the pieces it has. */
export const PIECES: Readonly<Record<string, string>> = {
  여기는: '여기 는',
  잠깐대기: '잠깐 대기',
  효력사: '효력 사',
  재효력사: '재 효력 사',
  사격지휘통보: '사격지휘 통보',
  순발신관: '순발 신관',
  접근신관: '접근 신관',
  지명사: '지명 사',
  표적번호: '표적 번호',
  하나발: '하나 발',
  마감탄: '마감 탄',
  위험근접: '위험 근접',
  공격중: '공격 중인',
  정지중: '정지 중인',
  사격중: '사격 중인',
  열한: '열 한',
  열네: '열 네',
  좌로: '좌 로',
  우로: '우 로',
  동제원: '동 제원',
  임무끝: '임무 끝',
  보병소대: '보병 소대',
  전이: '전 이',
};

/** The 교신 낱말 the model has as they are. */
// prettier-ignore
export const VOCABULARY: ReadonlySet<string> = new Set([
  '기러기', '이상', '조정', '좌표', '알파', '브라보', '찰리', '델타', '에코', '폭스트롯', '골프', '호텔', '인디아', '줄리엣', '킬로', '리마', '마이크', '노벰버',
  '오스카', '파파', '퀘벡', '로미오', '시에라', '탱고', '유니폼', '빅터', '위스키', '엑스레이', '양키', '줄루', '공', '하나', '둘', '삼', '넷', '오', '여섯',
  '칠', '팔', '아홉', '극좌표', '방위각', '거리', '준비', '쏴', '관측소', '이동', '끝', '현', '위치', '포대', '발', '떳다', '인', '적', '미상', '표적',
  '보병', '한', '개', '소대', '일', '마이너스', '분대', '명', '두', '세', '네', '다섯', '일곱', '여덟', '열', '열두', '열세', '열다섯', '열여섯',
  '열일곱', '열여덟', '열아홉', '대', '문', '장갑차', '박격포', '이동중', '방향', '줄이기', '늘리기', '백', '십', '파괴', '무력화', '효과', '미흡', '박격포반',
  '정찰조',
]);

/** 들을 낱말 as the 인식기 takes them: a word the model has as it is, one of the 조각 표 as its pieces, any other left out
 * (`lost` is told: a callsign the model does not know is the usual one). */
export function toGrammar(words: readonly string[], lost: (word: string) => void = () => {}): string[] {
  const out = new Set<string>();
  for (const word of words) {
    if (VOCABULARY.has(word)) out.add(word);
    else if (word in PIECES) for (const piece of PIECES[word]!.split(' ')) out.add(piece);
    else lost(word);
  }
  return [...out];
}
