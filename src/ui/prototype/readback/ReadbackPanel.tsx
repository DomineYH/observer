// PROTOTYPE, not product code, ticket #120. The read-back box beside the 입력기, one per variant, and the debug strip.
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Fuze, MtoSlots } from '@sim';
import { RADIO_GRAMMAR } from '@content/radio/grammar';
import { digits, rounds as roundsWord } from '@ui/radio/readings';
import {
  allItems, entryText, KIND_LABEL, pending, PROTO, readbackUtterance, secs, sentenceOf, setRecalling, SHOW, snapshot, submit, subscribe, tap, written,
  type Entry, type Item, type Kind,
} from './store';

const W = RADIO_GRAMMAR.tables;
const FUZES: Fuze[] = ['quick', 'vt'];
const ROUNDS = [1, 2, 3, 4, 5, 6];
const DIGITS = RADIO_GRAMMAR.digits.words;
const KINDS: (Kind | 'ready')[] = ['mto', 'ready', 'shot', 'rounds_complete'];
const BAD = { outline: '2px solid #e53935' } as const;
const BOX = { border: '1px solid #e8b04a', padding: 6, margin: '6px 0' } as const;

const bad = (item: Item, part: string) => (item.attempts.at(-1)?.wrong.includes(part) ? BAD : undefined);

function Feedback({ item }: { item: Item }) {
  const last = item.attempts.at(-1);
  if (!last?.wrong.length) return null;
  return (
    <p role="alert" style={{ color: '#ef9a9a' }}>
      기러기: 정정(설계). 틀린 곳: <b>{last.wrong.join(' · ')}</b>. {SHOW === 'text' ? '무전 기록을 보고' : SHOW === 'brief' ? '잠깐 다시 보이는 동안 듣고' : '다시 불러 준 것을 듣고'} 다시 복창하십시오. (시도 {item.attempts.length})
    </p>
  );
}

/** A: rebuild the message slot by slot, in its order, from pick lists (like the composer's forms). */
function VariantA({ item }: { item: Item }) {
  const [e, setE] = useState<Entry>({ kind: '', fuze: '', rounds: null, control: '', targetNumber: null });
  const [d, setD] = useState(['', '', '', '']);
  const pick = (patch: Partial<Entry>) => {
    tap(item, 2); // a native pick list: open, choose
    setE({ ...e, ...patch });
  };
  const tn = d.every((x) => x !== '') ? Number(d.join('')) : null;
  return (
    <>
      <select aria-label="복창 교신 종류" value={e.kind} style={bad(item, '교신 종류')} onChange={(ev) => pick({ kind: ev.target.value as Entry['kind'] })}>
        <option value="">— 종류 —</option>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      {e.kind === 'mto' && (
        <>
          , 포대,{' '}
          <select aria-label="복창 신관" value={e.fuze} style={bad(item, '신관')} onChange={(ev) => pick({ fuze: ev.target.value as Fuze })}>
            <option value="">— 신관 —</option>
            {FUZES.map((f) => (
              <option key={f} value={f}>
                {W.fuze[f].text}
              </option>
            ))}
          </select>
          ,{' '}
          <select aria-label="복창 발수" value={e.rounds ?? ''} style={bad(item, '발수')} onChange={(ev) => pick({ rounds: Number(ev.target.value) })}>
            <option value="">— 발수 —</option>
            {ROUNDS.map((r) => (
              <option key={r} value={r}>
                {roundsWord(r)}
              </option>
            ))}
          </select>
          ,{' '}
          <select aria-label="복창 지명사" value={e.control} style={bad(item, '지명사')} onChange={(ev) => pick({ control: ev.target.value as Entry['control'] })}>
            <option value="">(지명사 아님)</option>
            <option value="amc">지명사</option>
          </select>
          , 표적번호 {RADIO_GRAMMAR.phonetic.words.A}
          {RADIO_GRAMMAR.phonetic.words.B}{' '}
          {d.map((x, i) => (
            <select
              key={i}
              aria-label={`복창 표적번호 ${i + 1}째`}
              value={x}
              style={bad(item, '표적번호')}
              onChange={(ev) => {
                tap(item, 2);
                setD(d.map((y, j) => (j === i ? ev.target.value : y)));
              }}
            >
              <option value="">—</option>
              {DIGITS.map((w, k) => (
                <option key={k} value={k}>
                  {w}
                </option>
              ))}
            </select>
          ))}
        </>
      )}{' '}
      <SendButton item={item} entry={{ ...e, targetNumber: tn }} ready={e.kind !== '' && (e.kind !== 'mto' || (!!e.fuze && e.rounds != null && tn != null))} />
    </>
  );
}

/** B: the fixed words are written; the player types only the numbers and taps the 신관. */
function VariantB({ item }: { item: Item }) {
  const [fuze, setFuze] = useState<Fuze | ''>('');
  const [r, setR] = useState('');
  const [amc, setAmc] = useState(false);
  const [tn, setTn] = useState('');
  const typed = (old: string, now: string) => tap(item, Math.max(1, now.length - old.length));
  if (item.kind !== 'mto')
    return (
      <>
        {sentenceOf(readbackUtterance(item.kind))} <SendButton item={item} entry={{ kind: item.kind }} ready />
      </>
    );
  return (
    <>
      사격지휘통보, 포대,{' '}
      <span role="group" aria-label="복창 신관" style={bad(item, '신관')}>
        {FUZES.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={fuze === f}
            onClick={() => {
              tap(item);
              setFuze(f);
            }}
          >
            {W.fuze[f].text}
          </button>
        ))}
      </span>
      ,{' '}
      <input aria-label="복창 발수" inputMode="numeric" maxLength={1} size={1} value={r} style={bad(item, '발수')} onChange={(ev) => (typed(r, ev.target.value), setR(ev.target.value))} />
      발,{' '}
      <label>
        <input
          type="checkbox"
          checked={amc}
          style={bad(item, '지명사')}
          onChange={(ev) => {
            tap(item);
            setAmc(ev.target.checked);
          }}
        />{' '}
        지명사
      </label>
      , 표적번호 알파브라보{' '}
      <input aria-label="복창 표적번호" inputMode="numeric" maxLength={4} size={4} value={tn} style={bad(item, '표적번호')} onChange={(ev) => (typed(tn, ev.target.value), setTn(ev.target.value))} />{' '}
      <SendButton
        item={item}
        entry={{ kind: 'mto', fuze, rounds: /^\d$/.test(r) ? Number(r) : null, control: amc ? 'amc' : 'ready', targetNumber: /^\d{4}$/.test(tn) ? Number(tn) : null }}
        ready={!!fuze && /^\d$/.test(r) && /^\d{4}$/.test(tn)}
      />
    </>
  );
}

/** Four whole read-backs: the right one and three that differ in one value each. */
function candidates(item: Item): Entry[] {
  if (item.kind !== 'mto') return (['shot', 'rounds_complete', 'ready'] as const).map((kind) => ({ kind }));
  const s = item.slots!;
  const base: Entry = { kind: 'mto', ...s };
  const r = s.rounds > 1 && Math.random() < 0.5 ? s.rounds - 1 : s.rounds + 1;
  const pos = Math.floor(Math.random() * 4);
  const ds = [...String(s.targetNumber).padStart(4, '0')];
  ds[pos] = String((Number(ds[pos]) + 1 + Math.floor(Math.random() * 8)) % 10);
  return [base, { ...base, rounds: r }, { ...base, fuze: s.fuze === 'quick' ? 'vt' : 'quick' }, { ...base, targetNumber: Number(ds.join('')) }];
}
const shuffled = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const said = (e: Entry) => sentenceOf(readbackUtterance(e.kind as Kind | 'ready', e.kind === 'mto' ? (e as MtoSlots & Entry) : undefined));

/** C: one press of 복창 hides the message; then pick the whole read-back among four, from memory. */
function VariantC({ item }: { item: Item }) {
  const tries = item.attempts.length;
  const list = useMemo(() => shuffled(candidates(item)), [item, tries]); // a new set after each wrong pick
  if (!item.recalling)
    return (
      <button
        type="button"
        onClick={() => {
          tap(item);
          setRecalling(item, true);
        }}
      >
        복창 (누르면 기러기 말이 가려집니다)
      </button>
    );
  return (
    <div role="group" aria-label="복창 후보">
      {list.map((e, i) => (
        <button
          key={i}
          type="button"
          style={{ display: 'block', margin: '3px 0', textAlign: 'left', width: '100%' }}
          onClick={() => {
            tap(item);
            submit(item, e);
          }}
        >
          {said(e)}
        </button>
      ))}
    </div>
  );
}

function SendButton({ item, entry, ready }: { item: Item; entry: Entry; ready: boolean }) {
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => {
        tap(item);
        submit(item, entry);
      }}
    >
      복창 송신
    </button>
  );
}

/** The read-back box: the oldest message not yet read back. */
export function ReadbackPanel() {
  useSyncExternalStore(subscribe, snapshot);
  const item = pending();
  if (!PROTO) return null;
  const waiting = allItems().filter((i) => !i.done).length;
  let body: ReactNode = <p>복창할 기러기 교신이 없습니다.</p>;
  if (item)
    body = (
      <>
        <p>
          <b>복창 요구</b>: 기러기 {KIND_LABEL[item.kind]} {written(item) ? '(무전 기록에 보임)' : SHOW === 'voice' ? '(음성으로만 들림)' : '(가려짐)'}
          {waiting > 1 && ` · 밀린 복창 ${waiting - 1}`}
        </p>
        <div key={item.id}>
          {PROTO === 'A' && <VariantA item={item} />}
          {PROTO === 'B' && <VariantB item={item} />}
          {PROTO === 'C' && <VariantC item={item} />}
        </div>
        <Feedback item={item} />
      </>
    );
  return (
    <section aria-label="복창" style={BOX} data-prototype="readback">
      {body}
    </section>
  );
}

/** Prototype rule 5: every read-back's message, what was entered, right/wrong, seconds and taps. */
export function DebugStrip() {
  useSyncExternalStore(subscribe, snapshot);
  const [open, setOpen] = useState(true);
  if (!PROTO) return null;
  return (
    <div style={{ position: 'fixed', left: 4, bottom: 44, zIndex: 50, maxWidth: 'min(96vw, 560px)', background: '#000c', color: '#cfd8dc', font: '11px ui-monospace, monospace', padding: 4, border: '1px solid #555' }} data-prototype="debug">
      <button type="button" style={{ font: 'inherit', padding: '0 4px' }} onClick={() => setOpen(!open)}>
        복창 상태 {open ? '▾' : '▸'}
      </button>
      {open && (
        <table aria-label="복창 상태">
          <tbody>
            <tr>
              <th>#</th>
              <th>교신</th>
              <th>넣은 것</th>
              <th>판정</th>
              <th>초(게임/실제)</th>
              <th>누름</th>
            </tr>
            {allItems()
              .slice(-5)
              .map((i) => {
                const t = secs(i);
                return (
                  <tr key={i.id}>
                    <td>{i.id}</td>
                    <td>
                      {KIND_LABEL[i.kind]}
                      {i.slots && (written(i) ? ` ${W.fuze[i.slots.fuze].text} ${i.slots.rounds}발 AB${digits(i.slots.targetNumber, 4)}` : ' (가려짐)')}
                    </td>
                    <td>{i.attempts.map((a) => entryText(a.entry)).join(' / ') || '—'}</td>
                    <td>{i.done ? `맞음${i.attempts.length > 1 ? ` (${i.attempts.length - 1}번 틀림)` : ''}` : i.attempts.length ? `틀림 ${i.attempts.at(-1)!.wrong.join('·')}` : '대기'}</td>
                    <td>{t ? `${t.sim.toFixed(1)} / ${t.real.toFixed(1)}` : '—'}</td>
                    <td>{i.taps}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </div>
  );
}
