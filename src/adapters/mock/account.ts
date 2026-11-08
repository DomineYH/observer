// 계정 mock (demo lines 1455–1466, PRD 10.1): the callsign lives in this browser's storage.
import type { Account } from '../index';
import { FAKE_RUNS } from './records';

const KEY = 'observer.callsign';
const CALLSIGN = /^[가-힣A-Za-z0-9]{2,8}$/;
/** 상급·포대·운영자 계열 이름 (B5: 송골매 added). Matched without regard to case. */
export const RESERVED: readonly string[] = ['기러기', '송골매', '독수리포대', '관측', '운영자', 'admin', 'test'];

const reason = (c: string) =>
  !CALLSIGN.test(c)
    ? 'format'
    : RESERVED.some((r) => r.toLowerCase() === c.toLowerCase())
      ? 'reserved'
      : FAKE_RUNS.some((r) => r.callsign === c) // 중복: the mock board's names are taken
        ? 'taken'
        : null;

export function mockAccount(storage: Pick<Storage, 'getItem' | 'setItem'>): Account {
  const saved = (): string | null => {
    try {
      const v: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
      return typeof v === 'string' && reason(v) === null ? v : null; // edited storage is not trusted
    } catch {
      return null;
    }
  };
  return {
    callsign: async () => saved(),
    async claim(input) {
      const callsign = input.trim();
      const why = reason(callsign);
      if (why) return { ok: false, reason: why };
      storage.setItem(KEY, JSON.stringify(callsign));
      return { ok: true, callsign };
    },
  };
}
