// Shape of 교신 문법 데이터 (ADR 0004): words and order only, JSON-safe values, no functions or HTML.
import type { RadioKind, SlotName } from '@sim';

/** 출처 표시: 예문 · 공개 · 미군 · 추정 · 설계. */
export type Source = 'example' | 'public' | 'us' | 'inferred' | 'design';

export interface Provenance {
  source: Source;
  needsReview: boolean;
  note?: string;
}

export interface Word extends Provenance {
  text: string;
}

/** True when the slot has a value, equal to `is` and different from `not` when given. */
export interface Cond {
  slot: SlotName;
  is?: string | number;
  not?: string | number;
}

export type TableName =
  | 'warning'
  | 'fuze'
  | 'lateralDir'
  | 'rangeDir'
  | 'effect'
  | 'activity'
  | 'targetType'
  | 'unit'
  | 'targetName'
  | 'targetNameNamed';

export type Fragment =
  /** 고정 낱말, spaces and commas included. */
  | string
  /** A slot. Without `read`: its word from `words` (default: the table named like the slot), integers as arabic. */
  | { slot: SlotName; words?: TableName; read?: 'digits' | 'rounds'; pad?: number }
  /** 수정량: (direction word slot, value slot) pairs read in hundreds and tens; `empty` when no pair has a value. */
  | { corrections: [SlotName, SlotName][]; empty?: string }
  /** The 방안 문자 passed in with the callsign, read as phonetic letters. */
  | { grid: true }
  /** Fixed letters read as phonetic letters. */
  | { spell: string }
  | { if: Cond; then: Fragment[]; else?: Fragment[] };

/** 문형: elements that render empty are dropped; the rest join with ", ". */
export interface Pattern extends Provenance {
  header: boolean;
  elements: Fragment[][];
}

export interface Grammar {
  /** 포대 호출부호. */
  battery: Word;
  /** "여기는" in the call header. */
  here: Word;
  endings: { over: Word; wait: Word };
  /** 숫자 낱말표, index = digit. */
  digits: Provenance & { words: string[] };
  /** 음성 문자 낱말표, key = capital letter. */
  phonetic: Provenance & { words: Record<string, string> };
  tables: Record<TableName, Record<string, Word>>;
  patterns: Record<RadioKind, Pattern>;
}
