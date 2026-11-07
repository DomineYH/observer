// 호출부호 정하기 (demo lines 1440–1466, PRD 10.1): until 작전 개시, with the reason a callsign is refused.
import { useState } from 'react';
import type { Account, CallsignRejection } from '@adapters/index';

const REASON: Record<CallsignRejection, (c: string) => string> = {
  format: () => '한글·영문·숫자 2–8자로 정하십시오 (공백·기호 불가).',
  reserved: (c) => `“${c}”은(는) 예약된 호출부호입니다.`,
  taken: (c) => `“${c}”은(는) 이미 다른 관측장교가 쓰고 있습니다.`,
};

interface Props {
  callsign: string;
  /** Callsigns change only in 작전 준비. */
  editable: boolean;
  claim: Account['claim'];
}

export function CallsignForm({ callsign, editable, claim }: Props) {
  const [draft, setDraft] = useState(callsign);
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await claim(draft);
        setRefused(r.ok ? null : REASON[r.reason](draft.trim()));
      }}
    >
      <label>
        호출부호 <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!editable} />
      </label>
      <button disabled={!editable}>정하기</button> <output aria-label="현재 호출부호">{callsign}</output>
      {refused && <span role="alert">{refused}</span>}
    </form>
  );
}
