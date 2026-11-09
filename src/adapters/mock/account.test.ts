import { expect, test } from 'vitest';
import { memoryStorage } from '../../../tests/acceptance/storage';
import { mockAccount, RESERVED } from './account';

test('F-31: 호출부호 규칙', async () => {
  const storage = memoryStorage();
  const account = mockAccount(storage);
  expect(await account.callsign()).toBeNull();
  for (const ok of ['참새12', 'Kim', '가나', '가나다라마바사아', 'ab12CD34'])
    expect(await account.claim(ok)).toEqual({ ok: true, callsign: ok });
  expect(await account.claim(' 참새 ')).toEqual({ ok: true, callsign: '참새' });
  for (const bad of ['가', '가나다라마바사아자', '참 새', '참새!', '', '   ', '<b>x</b>'])
    expect(await account.claim(bad)).toEqual({ ok: false, reason: 'format' });
  expect(await account.claim('기러기')).toEqual({ ok: false, reason: 'reserved' });
  expect(await account.claim('ADMIN')).toEqual({ ok: false, reason: 'reserved' });
  expect(await account.claim('참매')).toEqual({ ok: false, reason: 'taken' }); // a name on the mock board
  // A rejected claim keeps the callsign; the same browser is not asked again.
  expect(await account.callsign()).toBe('참새');
  expect(await mockAccount(storage).callsign()).toBe('참새');
  // A stored value that fails the rules (edited storage) counts as none.
  storage.setItem('observer.callsign', JSON.stringify('<b>x</b>'));
  expect(await mockAccount(storage).callsign()).toBeNull();
  storage.setItem('observer.callsign', '{not json');
  expect(await mockAccount(storage).callsign()).toBeNull();
});

test('B5: 송골매는 예약어', async () => {
  const account = mockAccount(memoryStorage());
  expect(RESERVED).toContain('송골매');
  expect(await account.claim('송골매')).toEqual({ ok: false, reason: 'reserved' });
  expect(await account.claim('독수리포대')).toEqual({ ok: false, reason: 'reserved' });
});
