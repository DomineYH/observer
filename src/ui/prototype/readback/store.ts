// PROTOTYPE, not product code, ticket #120 (실전 복창 입력). Three read-back variants on the game page behind
// `?variant=A|B|C&show=text|brief|voice`; without `?variant=` (or in a production build) nothing here is active.
// State lives in memory only. The simulation is untouched: the read-back is screen-side, as a 실전 would see it.
import type { Fuze, MtoSlots, RadioEvent, RadioUtterance, SimEvent } from '@sim';
import { webSpeech } from '@adapters/webSpeech';
import type { LogLine } from '@ui/RadioLog';
import { radioSentence, spoken, type RadioNames } from '@ui/radio/sentence';

const params = new URLSearchParams(globalThis.location?.search ?? ''); // unit tests run without a page
export const VARIANTS = ['A', 'B', 'C'] as const;
export const SHOWS = ['text', 'brief', 'voice'] as const;
export type Variant = (typeof VARIANTS)[number];
export type Show = (typeof SHOWS)[number];
const v = params.get('variant');
/** Active only in a dev build with `?variant=`: the page is main's otherwise. */
export const PROTO: Variant | null = import.meta.env.DEV && VARIANTS.includes(v as Variant) ? (v as Variant) : null;
export const SHOW: Show = SHOWS.includes(params.get('show') as Show) ? (params.get('show') as Show) : 'text';
export const VARIANT_NAME: Record<Variant, string> = { A: '낱말·칸 고르기', B: '숫자만 받아 적기', C: '가린 뒤 후보 고르기' };
/** show=brief: how long a message needing a read-back stays written (설계, real time). */
export const BRIEF_MS = 4000;
const TICK_S = 0.05;
const FUZE_WORD: Record<Fuze, string> = { quick: '순발신관', vt: '접근신관' };

/** The FDC messages this prototype asks a read-back for (#111 claims 1, 3, 4, 15; 마감탄 claim 8 미확인 + PRD 예문 19). */
export type Kind = 'mto' | 'shot' | 'rounds_complete';
const ASKED = new Set<string>(['mto', 'shot', 'rounds_complete']);
export const KIND_LABEL: Record<Kind | 'ready', string> = { mto: '사격지휘통보', shot: '하나발 떳다', rounds_complete: '마감탄 떳다', ready: '사격준비 끝' };

/** What a player gives back: the message kind and, for 사격지휘통보, its four slots. */
export interface Entry {
  kind: Kind | 'ready' | '';
  fuze?: Fuze | '';
  rounds?: number | null;
  control?: 'ready' | 'amc' | '';
  targetNumber?: number | null;
}
export interface Attempt {
  entry: Entry;
  wrong: string[];
  tick: number;
  /** The item's taps when this attempt was sent. */
  tapsAt: number;
}
export interface Item {
  id: number;
  event: RadioEvent;
  kind: Kind;
  slots?: MtoSlots;
  tick: number;
  realAt: number;
  /** When the message (or its last 정정 resend) was last put on the radio, real ms. */
  shownAt: number;
  attempts: Attempt[];
  done: { tick: number; realAt: number } | null;
  taps: number;
  /** Variant C: the candidates are open, so the message is hidden whatever `show` says. */
  recalling: boolean;
}

let items: Item[] = [];
let version = 0;
let names: RadioNames = { callsign: '갈매기', gridLetters: 'CH' };
let tickNow = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const snapshot = () => version;
export const allItems = () => items;
export const pending = () => items.find((i) => !i.done) ?? null;

const fdcText = (u: RadioUtterance) => spoken(radioSentence(u, names));
/** The observer's 복창: same kind and slots, the 끝말 differs (GLOSSARY 복창). 이상 after 사격지휘통보 is 설계 (교범 OUT=끝). */
export const readbackUtterance = (kind: Kind | 'ready', slots?: MtoSlots): RadioUtterance =>
  kind === 'mto' ? { speaker: 'observer', ending: 'over', kind: 'mto', slots: slots! } : kind === 'ready' ? { speaker: 'observer', ending: 'wait', kind: 'ready', slots: {} } : { speaker: 'observer', ending: 'wait', kind };
export const sentenceOf = (u: RadioUtterance) => spoken(radioSentence(u, names));

/** One step's events: every FDC message needing a read-back opens an item. */
export function hear(events: readonly SimEvent[], tick: number, n: RadioNames): void {
  names = n;
  tickNow = tick;
  for (const e of events) {
    if (e.type !== 'radio' || e.utterance.speaker !== 'fdc' || !ASKED.has(e.utterance.kind)) continue;
    const now = performance.now();
    const item: Item = {
      id: items.length + 1,
      event: e,
      kind: e.utterance.kind as Kind,
      slots: e.utterance.kind === 'mto' ? { ...e.utterance.slots } : undefined,
      tick: e.tick,
      realAt: now,
      shownAt: now,
      attempts: [],
      done: null,
      taps: 0,
      recalling: false,
    };
    items = [...items, item];
    if (SHOW === 'voice') webSpeech.speak('fdc', fdcText(e.utterance));
    changed();
  }
}

/** Which parts of an entry differ from the message. */
export function wrongParts(item: Item, entry: Entry): string[] {
  const out: string[] = [];
  if (entry.kind !== item.kind) out.push('교신 종류');
  if (item.kind === 'mto' && entry.kind === 'mto') {
    const s = item.slots!;
    if (entry.fuze !== s.fuze) out.push('신관');
    if (entry.rounds !== s.rounds) out.push('발수');
    if ((entry.control || 'ready') !== s.control) out.push('지명사');
    if (entry.targetNumber !== s.targetNumber) out.push('표적번호');
  }
  return out;
}

export function tap(item: Item, n = 1): void {
  item.taps += n;
  changed();
}
export function setRecalling(item: Item, on: boolean): void {
  item.recalling = on;
  changed();
}

/** A read-back sent: right closes the item; wrong is answered by 기러기's 정정 and the message again (설계). */
export function submit(item: Item, entry: Entry): string[] {
  const wrong = wrongParts(item, entry);
  item.attempts = [...item.attempts, { entry, wrong, tick: tickNow, tapsAt: item.taps }];
  item.recalling = false;
  if (wrong.length === 0) item.done = { tick: tickNow, realAt: performance.now() };
  else {
    item.shownAt = performance.now();
    if (SHOW === 'voice') webSpeech.speak('fdc', `정정, ${fdcText(item.event.utterance)}`);
  }
  items = [...items];
  changed();
  return wrong;
}

/** Whether the message's words are on screen now. */
export function written(item: Item, now = performance.now()): boolean {
  if (item.done) return true;
  if (item.recalling) return false;
  if (SHOW === 'text') return true;
  if (SHOW === 'brief') return now - item.shownAt < BRIEF_MS;
  return false;
}

export const secs = (item: Item) => (item.done ? { sim: (item.done.tick - item.tick) * TICK_S, real: (item.done.realAt - item.realAt) / 1000 } : null);

const HIDDEN = (i: Item) => `기러기 ${KIND_LABEL[i.kind]} — ${SHOW === 'voice' ? '음성으로만' : '가려짐'} (복창하면 보입니다)`;

/** The 무전 기록 as the prototype shows it: masked FDC messages, no automatic observer read-backs, the player's
 * read-backs and 기러기's 정정 (설계) at their ticks. */
export function protoLog(lines: readonly LogLine[]): LogLine[] {
  const byEvent = new Map(items.map((i) => [i.event, i]));
  const now = performance.now();
  const out: LogLine[] = [];
  for (const l of lines) {
    if (l.type === 'radio' && l.utterance.speaker === 'observer' && (l.utterance.kind === 'shot' || l.utterance.kind === 'rounds_complete')) continue;
    const item = l.type === 'radio' ? byEvent.get(l) : undefined;
    out.push(item && !written(item, now) ? { type: 'system', tick: l.tick, text: HIDDEN(item) } : l);
  }
  const extra: LogLine[] = [];
  for (const i of items)
    for (const a of i.attempts) {
      if (a.wrong.length) {
        const last = a === i.attempts.at(-1) && !i.done;
        const words = last && !written(i, now) ? '(가려짐)' : fdcText(i.event.utterance);
        extra.push({ type: 'system', tick: a.tick, text: `기러기 정정(설계): 틀린 곳 ${a.wrong.join('·')} — ${words}` });
      } else extra.push({ type: 'radio', tick: a.tick, utterance: readbackUtterance(i.kind, i.slots) });
    }
  extra.sort((a, b) => a.tick - b.tick);
  // merge by tick, the original lines first at a tie
  const merged: LogLine[] = [];
  let j = 0;
  for (const l of out) {
    while (j < extra.length && extra[j]!.tick < l.tick) merged.push(extra[j++]!);
    merged.push(l);
  }
  return [...merged, ...extra.slice(j)];
}

/** For the debug strip and the timing script. */
export const entryText = (e: Entry) =>
  e.kind === 'mto' ? `${KIND_LABEL.mto} ${e.fuze ? FUZE_WORD[e.fuze] : '?'} ${e.rounds ?? '?'}발 ${e.control === 'amc' ? '지명사 ' : ''}AB${e.targetNumber == null ? '????' : String(e.targetNumber).padStart(4, '0')}` : e.kind ? KIND_LABEL[e.kind] : '?';
declare global {
  interface Window {
    __readback?: () => { id: number; kind: Kind; slots?: MtoSlots; attempts: number; wrong: string[][]; tapsAt: number[]; taps: number; done: boolean; sim: number | null; real: number | null }[];
  }
}
if (PROTO)
  window.__readback = () =>
    items.map((i) => ({ id: i.id, kind: i.kind, slots: i.slots, attempts: i.attempts.length, wrong: i.attempts.map((a) => a.wrong), tapsAt: i.attempts.map((a) => a.tapsAt), taps: i.taps, done: !!i.done, sim: secs(i)?.sim ?? null, real: secs(i)?.real ?? null }));
